//! Selection popover (decision 0096): when the user finishes selecting text in
//! another application, the native side reads that selection and the main window
//! shows the floating panel just above it. Backends: macOS (NSEvent monitor and the
//! Accessibility API), Windows (low-level mouse hook and UI Automation). Nothing on
//! Linux yet. Only mouse button events are observed, never keys.
use serde::Serialize;
use std::collections::HashSet;
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
/// the field holding it), whether it can be typed over, and where it was made.
pub type Read = (String, Option<(Rect, bool)>, bool, Spot);
/// Where a selection was made (decision 0135): an application by its identifier, or in a
/// browser the host of the page. A browser selection outside any page (the address bar)
/// has none.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Place {
    pub kind: &'static str,
    pub id: String,
    pub name: String,
}
/// The place of a selection and whether the circle shows there by itself.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Spot {
    pub place: Option<Place>,
    pub listed: bool,
}
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
    /// Where it was made; None where the platform cannot tell (decision 0135).
    pub place: Option<Place>,
    /// The circle shows there by itself. Only ⌘⇧M reports a selection that is not.
    pub listed: bool,
}

/// The AI places the circle shows in by itself (decision 0135), set by the front end
/// from its list: application identifiers, browsers whose page host is read, and hosts.
#[derive(Default, Debug)]
pub struct Places {
    pub apps: HashSet<String>,
    pub browsers: HashSet<String>,
    pub hosts: Vec<String>,
}
pub static PLACES: Mutex<Option<Places>> = Mutex::new(None);
impl Places {
    /// A host counts when it is a listed host or one of its subdomains.
    pub fn host_listed(&self, host: &str) -> bool {
        let host = host.trim_end_matches('.').to_ascii_lowercase();
        self.hosts.iter().any(|listed| {
            host == *listed
                || host
                    .strip_suffix(listed.as_str())
                    .is_some_and(|rest| rest.ends_with('.'))
        })
    }
}
/// Whether the circle may look at this application at all (decision 0135): a listed AI
/// application or a known browser. Anything else is not asked a thing.
pub fn may_look(app: &str) -> bool {
    PLACES.lock().is_ok_and(|places| {
        places
            .as_ref()
            .is_some_and(|places| places.apps.contains(app) || places.browsers.contains(app))
    })
}
/// Where a selection is and whether the circle shows there by itself: in a known browser
/// the page's host, listed when it is an AI host; elsewhere the application, listed when
/// it is an AI application. Never in a dialog (where files are named and saved), and
/// never in a browser outside any page (the address bar).
pub fn spot_for(app: Option<&str>, name: Option<&str>, page: Option<&str>, dialog: bool) -> Spot {
    let Ok(places) = PLACES.lock() else {
        return Spot::default();
    };
    let places = places.as_ref();
    let id = app.unwrap_or_default();
    if places.is_some_and(|places| places.browsers.contains(id)) {
        let host = page.and_then(url_host);
        return Spot {
            listed: !dialog
                && host
                    .as_deref()
                    .is_some_and(|host| places.is_some_and(|places| places.host_listed(host))),
            place: host.map(|host| Place {
                kind: "host",
                name: host.clone(),
                id: host,
            }),
        };
    }
    Spot {
        listed: !dialog && places.is_some_and(|places| places.apps.contains(id)),
        place: app.map(|id| Place {
            kind: "app",
            name: name.unwrap_or(id).to_string(),
            id: id.to_string(),
        }),
    }
}
/// The host of a page address, lowercased; None for anything but http(s).
pub fn url_host(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let host = authority.rsplit('@').next()?;
    let host = host.split(':').next()?;
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
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
/// Short enough that a keyboard selection gets its circle within half a second
/// (decision 0131); each look is one Accessibility query.
pub const POLL: std::time::Duration = std::time::Duration::from_millis(250);
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
            let probe = backend::probe(&app, true);
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
    pub fn probe<R: Runtime>(_app: &AppHandle<R>, _gate: bool) -> Probe {
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
/// ⌘⇧M is deliberate, so it reads in any application, AI place or not (decision 0135).
#[tauri::command]
pub async fn quick_read_selection(app: AppHandle) -> Option<Selection> {
    tauri::async_runtime::spawn_blocking(move || match backend::probe(&app, false) {
        Probe::Found(selection) => Some(selection),
        Probe::MouseDown | Probe::Nothing => None,
    })
    .await
    .ok()
    .flatten()
}
/// The AI places from the front end's list (decision 0135). True where the backend
/// honours them (macOS, Windows); elsewhere the circle still shows in every application.
#[tauri::command]
pub fn quick_set_places(apps: Vec<String>, browsers: Vec<String>, hosts: Vec<String>) -> bool {
    if let Ok(mut places) = PLACES.lock() {
        *places = Some(Places {
            apps: apps.into_iter().collect(),
            browsers: browsers.into_iter().collect(),
            hosts: hosts
                .into_iter()
                .map(|host| host.trim_end_matches('.').to_ascii_lowercase())
                .collect(),
        });
    }
    cfg!(any(target_os = "macos", windows))
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
            place: None,
            listed: true,
        })
    }

    #[test]
    fn a_listed_host_counts_with_its_subdomains_only() {
        let places = Places {
            hosts: vec!["chatgpt.com".into(), "claude.ai".into()],
            ..Places::default()
        };
        assert!(places.host_listed("chatgpt.com"));
        assert!(places.host_listed("www.ChatGPT.com."));
        assert!(!places.host_listed("notchatgpt.com"));
        assert!(!places.host_listed("chatgpt.com.evil.net"));
        assert!(!places.host_listed("example.com"));
    }

    #[test]
    fn a_browser_counts_by_its_page_an_app_by_itself_and_a_dialog_never() {
        *PLACES.lock().unwrap() = Some(Places {
            apps: ["claude.exe".to_string()].into(),
            browsers: ["msedge.exe".to_string()].into(),
            hosts: vec!["chatgpt.com".into()],
        });
        let page = Some("https://chatgpt.com/c/1");
        assert!(spot_for(Some("msedge.exe"), None, page, false).listed);
        assert_eq!(
            spot_for(Some("msedge.exe"), None, page, false)
                .place
                .map(|place| place.id),
            Some("chatgpt.com".to_string())
        );
        // The address bar: no page above it, so no place and no circle.
        let bar = spot_for(Some("msedge.exe"), None, None, false);
        assert!(!bar.listed && bar.place.is_none());
        assert!(!spot_for(Some("msedge.exe"), None, Some("https://example.com"), false).listed);
        assert!(spot_for(Some("claude.exe"), Some("Claude"), None, false).listed);
        assert!(!spot_for(Some("claude.exe"), Some("Claude"), None, true).listed);
        let zalo = spot_for(Some("zalo.exe"), Some("Zalo"), None, false);
        assert!(!zalo.listed);
        assert_eq!(zalo.place.map(|place| place.name), Some("Zalo".to_string()));
        assert!(may_look("claude.exe") && may_look("msedge.exe") && !may_look("zalo.exe"));
        *PLACES.lock().unwrap() = None;
    }

    #[test]
    fn a_page_host_is_read_from_http_addresses_only() {
        assert_eq!(
            url_host("https://chatgpt.com/c/1?x=2").as_deref(),
            Some("chatgpt.com")
        );
        assert_eq!(
            url_host("http://user@Claude.ai:8080").as_deref(),
            Some("claude.ai")
        );
        assert_eq!(url_host("file:///tmp/a.html"), None);
        assert_eq!(url_host("about:blank"), None);
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
