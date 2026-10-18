//! Keep OfflineMask reachable while its window is closed (decision 0092): a tray
//! (menu bar) icon with the quick actions, and reopening from it or the dock. The
//! window hides instead of closing from the frontend (`onCloseRequested`).
use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const MAIN_WINDOW: &str = "main";
/// Same event and payload as the floating panel's buttons; the frontend handles both.
const COMMAND_EVENT: &str = "quick-command";
#[derive(Serialize, Clone)]
struct Command {
    command: &'static str,
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Mở OfflineMask", true, None::<&str>)?;
    let mask = MenuItem::with_id(
        app,
        "mask",
        "Ẩn thông tin trong clipboard",
        true,
        None::<&str>,
    )?;
    let restore = MenuItem::with_id(
        app,
        "restore",
        "Khôi phục trong clipboard",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Thoát OfflineMask", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &PredefinedMenuItem::separator(app)?,
            &mask,
            &restore,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("offlinemask")
        .tooltip("OfflineMask")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "mask" => {
                let _ = app.emit_to(MAIN_WINDOW, COMMAND_EVENT, Command { command: "mask" });
            }
            "restore" => {
                let _ = app.emit_to(MAIN_WINDOW, COMMAND_EVENT, Command { command: "restore" });
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    // Menu bar extras open their menu on click; Windows and Linux trays open the app.
    #[cfg(not(target_os = "macos"))]
    {
        use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
        tray = tray
            .show_menu_on_left_click(false)
            .on_tray_icon_event(|tray, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    show_main(tray.app_handle());
                }
            });
    }
    tray.build(app)?;
    Ok(())
}

/// The login item starts the app with this flag, so it begins hidden in the tray.
pub const BACKGROUND_FLAG: &str = "--background";
pub fn started_in_background() -> bool {
    std::env::args().any(|arg| arg == BACKGROUND_FLAG)
}
