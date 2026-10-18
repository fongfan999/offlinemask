//! Selection popover (decision 0096): when the user finishes selecting text in
//! another application, the native side reads that selection and the main window
//! shows the floating panel just above it. Backends: macOS (NSEvent monitor and the
//! Accessibility API), Windows (low-level mouse hook and UI Automation). Nothing on
//! Linux yet. Only mouse button events are observed, never keys.
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Runtime};

use crate::background::MAIN_WINDOW;

pub const MADE_EVENT: &str = "selection-made";
pub const CLEARED_EVENT: &str = "selection-cleared";
/// Shorter selections are stray clicks, not requests; longer ones exceed the text limit.
pub const MIN_CHARS: usize = 2;
pub const MAX_CHARS: usize = 50_000;
/// Time the application gets to update its selection after the mouse comes up.
pub const SETTLE_MS: u64 = 160;
/// A release this far from the press counts as a drag.
pub const DRAG_PX: f64 = 4.0;

/// Logical screen points, top-left origin.
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
#[derive(Serialize, Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Selection {
    pub text: String,
    /// None when the application reports the text but no rectangle.
    pub bounds: Option<Rect>,
    /// Where the mouse came up.
    pub pointer: Point,
}

/// Shared gesture logic: a press records where it began; a release after a drag of
/// `DRAG_PX` or a multi-click counts as a selection gesture. The backends feed it.
#[derive(Default)]
pub struct Gesture {
    down: Option<Point>,
}
impl Gesture {
    pub fn pressed(&mut self, at: Point) {
        self.down = Some(at);
    }
    pub fn released(&mut self, at: Point, clicks: u32) -> bool {
        let Some(down) = self.down.take() else {
            return clicks >= 2;
        };
        clicks >= 2 || (at.x - down.x).hypot(at.y - down.y) >= DRAG_PX
    }
}
pub fn usable(text: &str) -> bool {
    let trimmed = text.trim().chars().count();
    trimmed >= MIN_CHARS && text.chars().count() <= MAX_CHARS
}

#[derive(Default)]
pub struct SelectionWatch {
    pub enabled: Arc<AtomicBool>,
    started: Mutex<bool>,
}

pub fn emit_made<R: Runtime>(app: &AppHandle<R>, selection: Selection) {
    let _ = app.emit_to(MAIN_WINDOW, MADE_EVENT, selection);
}
pub fn emit_cleared<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit_to(MAIN_WINDOW, CLEARED_EVENT, ());
}

#[cfg(target_os = "macos")]
use crate::selection_macos as backend;
#[cfg(windows)]
use crate::selection_windows as backend;
#[cfg(not(any(target_os = "macos", windows)))]
mod backend {
    use super::*;
    pub fn supported() -> bool {
        false
    }
    pub fn start(_app: AppHandle, _enabled: Arc<AtomicBool>) {}
}

#[tauri::command]
pub fn quick_selection_supported() -> bool {
    backend::supported()
}
/// Turn the popover on or off. The backend starts on the first "on" and then only
/// watches silently (gesture bookkeeping, no reads, no events) while it is off.
#[tauri::command]
pub fn quick_selection_watch(
    app: AppHandle,
    watch: tauri::State<'_, SelectionWatch>,
    enabled: bool,
) -> Result<(), String> {
    if !backend::supported() {
        return Err("unsupported".to_string());
    }
    watch.enabled.store(enabled, Ordering::Relaxed);
    let mut started = watch
        .started
        .lock()
        .map_err(|_| "io: poisoned".to_string())?;
    if enabled && !*started {
        *started = true;
        backend::start(app, watch.enabled.clone());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_drag_or_a_multi_click_is_a_gesture_and_a_click_is_not() {
        let mut gesture = Gesture::default();
        gesture.pressed(Point { x: 10.0, y: 10.0 });
        assert!(!gesture.released(Point { x: 12.0, y: 11.0 }, 1));
        gesture.pressed(Point { x: 10.0, y: 10.0 });
        assert!(gesture.released(Point { x: 40.0, y: 10.0 }, 1));
        gesture.pressed(Point { x: 10.0, y: 10.0 });
        assert!(gesture.released(Point { x: 10.0, y: 10.0 }, 2));
        // A release with no recorded press (the press happened before the watch started).
        assert!(!gesture.released(Point { x: 0.0, y: 0.0 }, 1));
        assert!(gesture.released(Point { x: 0.0, y: 0.0 }, 3));
    }

    #[test]
    fn usable_text_is_at_least_two_characters_and_within_the_limit() {
        assert!(!usable(""));
        assert!(!usable(" a "));
        assert!(usable("ab"));
        assert!(usable("Nguyễn Văn A"));
        assert!(!usable(&"x".repeat(MAX_CHARS + 1)));
    }
}
