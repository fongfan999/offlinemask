//! Keystrokes for the in-place quick action (decision 0091): one copy chord to
//! take the selection of the front application and one paste chord to put the
//! result back. Both are sent only while handling the user's own shortcut
//! press; nothing is ever read from the keyboard and no event tap is installed.
use enigo::{Direction, Enigo, InputError, Key, Keyboard, NewConError, Settings};
use std::sync::mpsc;
use std::thread::sleep;
use std::time::Duration;
use tauri::{AppHandle, Runtime};

#[cfg(target_os = "macos")]
const MODIFIER: Key = Key::Meta;
#[cfg(not(target_os = "macos"))]
const MODIFIER: Key = Key::Control;
/// How long the front application gets to serve the copy before the clipboard is read.
const SETTLE: Duration = Duration::from_millis(160);

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
pub fn quick_input_permission(prompt: bool) -> String {
    match connect(prompt) {
        Ok(_) => "granted".to_string(),
        Err(error) if error == "denied" => error,
        Err(_) => "unsupported".to_string(),
    }
}
/// Copy the front application's selection to the clipboard, then wait for it to land.
#[tauri::command]
pub async fn quick_copy_selection(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        chord(&app, 'c')?;
        sleep(SETTLE);
        Ok(())
    })
    .await
    .map_err(|error| format!("io: {error}"))?
}
/// Paste the clipboard over the front application's selection.
#[tauri::command]
pub async fn quick_paste_result(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || chord(&app, 'v'))
        .await
        .map_err(|error| format!("io: {error}"))?
}
