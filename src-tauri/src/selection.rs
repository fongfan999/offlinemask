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
/// What a backend reads: the text, where it is (with whether that is only the frame of
/// the field holding it), and whether it can be typed over.
pub type Read = (String, Option<(Rect, bool)>, bool);
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Selection {
    pub text: String,
    /// None when the application reports the text but no rectangle.
    pub bounds: Option<Rect>,
    /// `bounds` is the frame of the field holding the text, not the text itself: some
    /// applications (Chromium and Electron text fields) give no geometry for a range.
    pub field: bool,
    /// Made by a mouse gesture, so `pointer` is where the drag or clicks ended; false
    /// for the keyboard poller and ⌘⇧M, where the pointer says nothing about the text.
    pub mouse: bool,
    /// Where the mouse came up.
    pub pointer: Point,
    /// The selection sits in a field the user can type in (an input, a text area, an
    /// editor). Read-only text, such as an AI's answer, is false; so is any doubt.
    pub editable: bool,
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

/// The text of the selection last announced, so the mouse path and the keyboard
/// poller never announce the same selection twice.
static LAST_SHOWN: Mutex<String> = Mutex::new(String::new());

pub fn emit_made<R: Runtime>(app: &AppHandle<R>, selection: Selection) {
    if let Ok(mut last) = LAST_SHOWN.lock() {
        last.clone_from(&selection.text);
    }
    let _ = app.emit_to(MAIN_WINDOW, MADE_EVENT, selection);
}
pub fn emit_cleared<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(mut last) = LAST_SHOWN.lock() {
        last.clear();
    }
    let _ = app.emit_to(MAIN_WINDOW, CLEARED_EVENT, ());
}

/// What one look at the front application found.
pub enum Probe {
    /// The left button is down: a mouse selection is in progress; its own path handles it.
    MouseDown,
    /// No usable selection (none, too short, this app, a password field, no permission).
    Nothing,
    Found(Selection),
}
/// Keyboard selections (⌘A, ⇧ with arrows) produce no mouse event. While the popover is
/// on, the front application's selection is read every `POLL`; a selection that holds
/// still for one look is announced, and one that disappears is cleared. No key is read.
pub const POLL: std::time::Duration = std::time::Duration::from_millis(450);
/// Decide what to announce after a look: `candidate` is the text seen on the previous
/// look. Returns the new candidate and whether to announce or clear.
pub fn after_look(
    candidate: Option<&str>,
    last_shown: &str,
    probe: &Probe,
) -> (Option<String>, Step) {
    match probe {
        Probe::MouseDown => (None, Step::Wait),
        Probe::Nothing => (
            None,
            if last_shown.is_empty() {
                Step::Wait
            } else {
                Step::Clear
            },
        ),
        Probe::Found(selection) => {
            let steady = candidate == Some(selection.text.as_str());
            let step = if steady && selection.text != last_shown {
                Step::Announce
            } else {
                Step::Wait
            };
            (Some(selection.text.clone()), step)
        }
    }
}
#[derive(Debug, PartialEq)]
pub enum Step {
    Wait,
    Announce,
    Clear,
}
fn start_poller<R: Runtime>(app: AppHandle<R>, enabled: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut candidate: Option<String> = None;
        loop {
            std::thread::sleep(POLL);
            if !enabled.load(Ordering::Relaxed) {
                candidate = None;
                continue;
            }
            let probe = backend::probe(&app);
            let last = LAST_SHOWN
                .lock()
                .map(|text| text.clone())
                .unwrap_or_default();
            let (next, step) = after_look(candidate.as_deref(), &last, &probe);
            candidate = next;
            match (step, probe) {
                (Step::Announce, Probe::Found(selection)) => emit_made(&app, selection),
                (Step::Clear, _) => emit_cleared(&app),
                _ => {}
            }
        }
    });
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
    pub fn probe<R: Runtime>(_app: &AppHandle<R>) -> Probe {
        Probe::Nothing
    }
}

#[tauri::command]
pub fn quick_selection_supported() -> bool {
    backend::supported()
}
/// The front application's current selection, read once for ⌘⇧M so the shortcut can
/// take the same path as a click on the circle (decision 0096). None when nothing
/// usable is selected, a drag is still in progress, or the platform cannot read it.
#[tauri::command]
pub async fn quick_read_selection(app: AppHandle) -> Option<Selection> {
    tauri::async_runtime::spawn_blocking(move || match backend::probe(&app) {
        Probe::Found(selection) => Some(selection),
        Probe::MouseDown | Probe::Nothing => None,
    })
    .await
    .ok()
    .flatten()
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
        backend::start(app.clone(), watch.enabled.clone());
        start_poller(app, watch.enabled.clone());
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

    fn found(text: &str) -> Probe {
        Probe::Found(Selection {
            text: text.to_string(),
            bounds: None,
            field: false,
            mouse: false,
            pointer: Point { x: 0.0, y: 0.0 },
            editable: true,
        })
    }

    #[test]
    fn a_keyboard_selection_is_announced_once_it_holds_still_and_cleared_when_gone() {
        // First look: seen, not yet steady.
        let (candidate, step) = after_look(None, "", &found("Nguyễn Văn A"));
        assert_eq!(step, Step::Wait);
        // Same text on the next look: announce.
        let (candidate, step) = after_look(candidate.as_deref(), "", &found("Nguyễn Văn A"));
        assert_eq!(step, Step::Announce);
        // Already shown (by this path or by the mouse path): never again.
        let (candidate, step) =
            after_look(candidate.as_deref(), "Nguyễn Văn A", &found("Nguyễn Văn A"));
        assert_eq!(step, Step::Wait);
        // A drag in progress waits; a vanished selection clears what was shown.
        let (_, step) = after_look(candidate.as_deref(), "Nguyễn Văn A", &Probe::MouseDown);
        assert_eq!(step, Step::Wait);
        let (_, step) = after_look(candidate.as_deref(), "Nguyễn Văn A", &Probe::Nothing);
        assert_eq!(step, Step::Clear);
        let (_, step) = after_look(None, "", &Probe::Nothing);
        assert_eq!(step, Step::Wait);
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
