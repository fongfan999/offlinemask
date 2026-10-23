//! Keystrokes for the in-place quick action (decision 0091): one copy chord to
//! take the selection of the front application and one paste chord to put the
//! result back, each around a saved and restored clipboard (decision 0130); native
//! macOS text views need neither. Both are sent only while handling the user's own
//! click or shortcut; nothing is ever read from the keyboard and no event tap is
//! installed.
use enigo::{Direction, Enigo, InputError, Key, Keyboard, NewConError, Settings};
use std::sync::{mpsc, Mutex, PoisonError};
use std::thread::sleep;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};

use crate::clipboard_guard;
#[cfg(target_os = "macos")]
use crate::selection_macos::focused_state;
#[cfg(windows)]
use crate::selection_windows::focused_state;

#[cfg(target_os = "macos")]
const MODIFIER: Key = Key::Meta;
#[cfg(not(target_os = "macos"))]
const MODIFIER: Key = Key::Control;

fn settings(prompt: bool) -> Settings {
    Settings {
        // macOS: ask for the Accessibility permission only when Settings says so;
        // the shortcut itself must never pop a system dialog mid-flow.
        open_prompt_to_get_permissions: prompt,
        // macOS: the user's own ⌘ and ⇧ may still be down; our chords carry their own flags.
        independent_of_keyboard_state: true,
        ..Settings::default()
    }
}
fn connect(prompt: bool) -> Result<Enigo, String> {
    Enigo::new(&settings(prompt)).map_err(|error| match error {
        NewConError::NoPermission => "denied".to_string(),
        other => format!("unsupported: {other}"),
    })
}
fn io(error: InputError) -> String {
    format!("io: {error}")
}
/// Wait for the shortcut's own modifiers to come up, so a copy chord sent while
/// ⇧ is still physically down cannot turn into ⌘⇧C in the front application.
#[cfg(target_os = "macos")]
fn wait_for_modifiers() {
    use core_graphics::event::{CGEvent, CGEventFlags};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    let held = CGEventFlags::CGEventFlagCommand
        | CGEventFlags::CGEventFlagShift
        | CGEventFlags::CGEventFlagControl
        | CGEventFlags::CGEventFlagAlternate;
    for _ in 0..80 {
        let down = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
            .ok()
            .and_then(|source| CGEvent::new(source).ok())
            .map(|event| event.get_flags().intersects(held))
            .unwrap_or(false);
        if !down {
            return;
        }
        sleep(Duration::from_millis(10));
    }
}
#[cfg(not(target_os = "macos"))]
fn wait_for_modifiers() {
    // No cheap modifier query here; the explicit releases below cover the usual case.
    sleep(Duration::from_millis(120));
}
/// The letter of the chord as a key the front application reads as an accelerator.
/// Windows: the virtual-key code (`VK_C` = 0x43), because a Unicode text event with
/// Control held is typing, not Ctrl+C. macOS and X11 map the character through the
/// current layout to a key code.
#[cfg(windows)]
fn letter_key(letter: char) -> Key {
    Key::Other(letter.to_ascii_uppercase() as u32)
}
#[cfg(not(windows))]
fn letter_key(letter: char) -> Key {
    Key::Unicode(letter)
}
/// The key presses themselves. On macOS enigo resolves the letter through Text Input
/// Services, which asserts the main thread (a worker thread traps), so this runs via
/// `on_main_thread`; the waits around it stay off the main thread.
fn press(enigo: &mut Enigo, letter: char) -> Result<(), String> {
    enigo.key(Key::Shift, Direction::Release).map_err(io)?;
    enigo.key(MODIFIER, Direction::Release).map_err(io)?;
    enigo.key(MODIFIER, Direction::Press).map_err(io)?;
    let typed = enigo.key(letter_key(letter), Direction::Click).map_err(io);
    enigo.key(MODIFIER, Direction::Release).map_err(io)?;
    typed
}
/// Run `work` on the main thread and wait for its result (bounded, so a stuck main
/// thread cannot hang the command forever).
fn on_main_thread<R: Runtime>(
    app: &AppHandle<R>,
    work: impl FnOnce() -> Result<(), String> + Send + 'static,
) -> Result<(), String> {
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = sender.send(work());
    })
    .map_err(|error| format!("io: {error}"))?;
    receiver
        .recv_timeout(Duration::from_secs(3))
        .map_err(|_| "io: main thread did not answer".to_string())?
}
/// Wait for the user's modifiers, then send the chord on the main thread.
fn chord<R: Runtime>(app: &AppHandle<R>, letter: char) -> Result<(), String> {
    // Fail early, off the main thread, when keys cannot be sent at all.
    drop(connect(false)?);
    wait_for_modifiers();
    on_main_thread(app, move || {
        let mut enigo = connect(false)?;
        press(&mut enigo, letter)
    })
}

/// "granted", "denied" (macOS Accessibility not given) or "unsupported" (no way to
/// send keys here, e.g. Wayland). With `prompt`, macOS shows its permission dialog.
#[tauri::command]
pub fn quick_input_permission(app: AppHandle, prompt: bool) -> String {
    let state = match connect(prompt) {
        Ok(_) => "granted".to_string(),
        Err(error) if error == "denied" => error,
        Err(_) => "unsupported".to_string(),
    };
    // macOS shows its own dialog at most once per app identity; after a dismissed or
    // removed grant it stays silent, so an explicit request also opens the pane itself.
    #[cfg(target_os = "macos")]
    if prompt && state == "denied" {
        use tauri_plugin_opener::OpenerExt;
        let _ = app.opener().open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            None::<&str>,
        );
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, prompt);
    state
}
/// How long the front application gets to answer the copy chord.
const COPY_WAIT: Duration = Duration::from_millis(600);
/// How long a pasted result stays on the clipboard before the user's own contents come
/// back. Applications read it while handling the chord (decision 0130).
const PASTE_HOLD: Duration = Duration::from_millis(500);
/// How long a pasted field gets to show the new text before the paste counts as
/// dropped (decisions 0131, 0133).
const PASTE_CONFIRM: Duration = Duration::from_millis(400);
/// A clipboard borrowed by a copy that a paste will follow (decision 0131): Chrome drops
/// a paste when the clipboard was put back between its own copy and that paste, so it
/// is put back once, after the paste, or by `quick_release_clipboard` when no paste
/// comes. Nothing keeps it longer than `BORROW_LIMIT`.
struct Borrowed {
    saved: clipboard_guard::Saved,
    left: clipboard_guard::Stamp,
    serial: u64,
}
static BORROWED: Mutex<Option<Borrowed>> = Mutex::new(None);
static SERIAL: Mutex<u64> = Mutex::new(0);
const BORROW_LIMIT: Duration = Duration::from_secs(20);
/// The restore after a paste runs while the user already sees the result. The next copy
/// or paste waits for it, so it never saves the pasted text as the user's clipboard.
static RESTORING: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
fn finish_restore() {
    let pending = RESTORING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take();
    if let Some(pending) = pending {
        let _ = pending.join();
    }
}
fn take_borrowed() -> Option<Borrowed> {
    BORROWED
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take()
}
/// Keep the clipboard borrowed for the paste to come; put it back after `BORROW_LIMIT`
/// if none comes.
fn lend<R: Runtime>(
    app: &AppHandle<R>,
    saved: clipboard_guard::Saved,
    left: clipboard_guard::Stamp,
) {
    let serial = {
        let mut serial = SERIAL.lock().unwrap_or_else(PoisonError::into_inner);
        *serial += 1;
        *serial
    };
    *BORROWED.lock().unwrap_or_else(PoisonError::into_inner) = Some(Borrowed {
        saved,
        left,
        serial,
    });
    let app = app.clone();
    std::thread::spawn(move || {
        sleep(BORROW_LIMIT);
        let mut borrowed = BORROWED.lock().unwrap_or_else(PoisonError::into_inner);
        if borrowed.as_ref().is_some_and(|b| b.serial == serial) {
            if let Some(b) = borrowed.take() {
                clipboard_guard::restore(&app, b.saved, b.left);
            }
        }
    });
}

/// The front application's selection. A native macOS text view is read through
/// Accessibility; anything else with the copy chord, the user's clipboard saved before
/// and put back right after (decision 0130), or, with `keep`, after the paste that will
/// follow (decision 0131). None when nothing answered.
#[tauri::command]
pub async fn quick_copy_selection(app: AppHandle, keep: bool) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        if let Some(text) = crate::selection_macos::native_selection(&app) {
            return Ok(Some(text));
        }
        finish_restore();
        // A second look while borrowed (the check before a paste) keeps the first save.
        let earlier = take_borrowed();
        let saved = match &earlier {
            Some(_) => None,
            None => Some(clipboard_guard::save(&app)),
        };
        // An empty private item first, so any change after the chord is the copy.
        let marked = clipboard_guard::write_private(&app, "")?;
        let sent = chord(&app, 'c');
        let mut left = marked;
        if sent.is_ok() {
            let started = Instant::now();
            while left == marked && started.elapsed() < COPY_WAIT {
                sleep(Duration::from_millis(15));
                left = clipboard_guard::stamp(&app);
            }
            if left != marked {
                // Some applications write the copy in steps.
                sleep(Duration::from_millis(30));
                left = clipboard_guard::stamp(&app);
            }
        }
        let text = (left != marked)
            .then(|| clipboard_guard::read_text(&app))
            .flatten();
        let saved = saved.or(earlier.map(|b| b.saved)).unwrap_or_default();
        if keep && sent.is_ok() {
            lend(&app, saved, left);
        } else {
            clipboard_guard::restore(&app, saved, left);
        }
        sent?;
        Ok(text.filter(|text| !text.trim().is_empty()))
    })
    .await
    .map_err(|error| format!("io: {error}"))?
}
/// Put back a clipboard a copy kept for a paste that is not coming (decision 0131).
#[tauri::command]
pub async fn quick_release_clipboard(app: AppHandle) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        if let Some(borrowed) = take_borrowed() {
            clipboard_guard::restore(&app, borrowed.saved, borrowed.left);
        }
    })
    .await;
}
/// Put `text` over the front application's selection: through Accessibility in a native
/// macOS text view, otherwise with the paste chord and the user's clipboard put back
/// once the application has taken the text (decisions 0130, 0131). On macOS and Windows
/// the field must show the change, or the paste counts as dropped and the call fails
/// (decisions 0131, 0133).
#[tauri::command]
pub async fn quick_replace_selection(app: AppHandle, text: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        if crate::selection_macos::replace_native(&app, &text) {
            if let Some(borrowed) = take_borrowed() {
                clipboard_guard::restore(&app, borrowed.saved, borrowed.left);
            }
            return Ok(());
        }
        finish_restore();
        let borrowed = take_borrowed();
        // A copy made by the user since the borrow is theirs now: nothing to put back.
        let saved = match borrowed {
            Some(b) if clipboard_guard::stamp(&app) == b.left => Some(b.saved),
            Some(_) => None,
            None => Some(clipboard_guard::save(&app)),
        };
        #[cfg(any(target_os = "macos", windows))]
        let before = focused_state(&app);
        let left = clipboard_guard::write_private(&app, &text)?;
        let sent = chord(&app, 'v');
        #[cfg(any(target_os = "macos", windows))]
        let landed = sent.is_ok() && {
            let started = Instant::now();
            let mut changed = before.is_none();
            while !changed && started.elapsed() < PASTE_CONFIRM {
                sleep(Duration::from_millis(25));
                changed = focused_state(&app) != before;
            }
            changed
        };
        #[cfg(not(any(target_os = "macos", windows)))]
        let landed = sent.is_ok();
        let restorer = app.clone();
        let pending = std::thread::spawn(move || {
            if landed {
                sleep(PASTE_HOLD);
            }
            if let Some(saved) = saved {
                clipboard_guard::restore(&restorer, saved, left);
            }
        });
        *RESTORING.lock().unwrap_or_else(PoisonError::into_inner) = Some(pending);
        sent?;
        if landed {
            Ok(())
        } else {
            Err("io: paste not taken".into())
        }
    })
    .await
    .map_err(|error| format!("io: {error}"))?
}
