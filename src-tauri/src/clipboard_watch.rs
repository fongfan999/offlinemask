//! Opt-in clipboard watch (decision 0095). While the user has turned it on, a thread
//! polls the system's clipboard *change counter* (no content) and tells the main
//! window when it moved; the window then reads the text once and checks it with the
//! built-in rules. Off by default; nothing is read while it is off.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

use crate::background::MAIN_WINDOW;

pub const CHANGED_EVENT: &str = "clipboard-changed";
const POLL: Duration = Duration::from_millis(500);

#[derive(Default)]
pub struct ClipboardWatch {
    enabled: Arc<AtomicBool>,
    started: Mutex<bool>,
}

#[cfg(target_os = "macos")]
fn change_token() -> Option<u64> {
    Some(objc2_app_kit::NSPasteboard::generalPasteboard().changeCount() as u64)
}
#[cfg(windows)]
fn change_token() -> Option<u64> {
    // SAFETY: a plain Win32 query with no arguments.
    Some(u64::from(unsafe {
        windows_sys::Win32::System::DataExchange::GetClipboardSequenceNumber()
    }))
}
#[cfg(not(any(target_os = "macos", windows)))]
fn change_token() -> Option<u64> {
    // No change counter without reading the content; the watch is unsupported here.
    None
}

pub fn supported() -> bool {
    change_token().is_some()
}

fn start<R: Runtime>(app: AppHandle<R>, enabled: Arc<AtomicBool>) {
    thread::spawn(move || {
        let mut last = change_token();
        loop {
            thread::sleep(POLL);
            let token = change_token();
            if token != last {
                last = token;
                if enabled.load(Ordering::Relaxed) {
                    let _ = app.emit_to(MAIN_WINDOW, CHANGED_EVENT, ());
                }
            }
        }
    });
}

#[tauri::command]
pub fn quick_watch_supported() -> bool {
    supported()
}
/// Turn the watch on or off. The thread starts on the first "on" and then idles,
/// tracking the counter without telling anyone, while the watch is off.
#[tauri::command]
pub fn quick_watch_clipboard(
    app: AppHandle,
    watch: tauri::State<'_, ClipboardWatch>,
    enabled: bool,
) -> Result<(), String> {
    if !supported() {
        return Err("unsupported".to_string());
    }
    watch.enabled.store(enabled, Ordering::Relaxed);
    let mut started = watch
        .started
        .lock()
        .map_err(|_| "io: poisoned".to_string())?;
    if enabled && !*started {
        *started = true;
        start(app, watch.enabled.clone());
    }
    Ok(())
}
