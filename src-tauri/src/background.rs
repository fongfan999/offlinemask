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
/// Text or files handed over by a macOS Service (decision 0094).
pub const SERVICE_EVENT: &str = "quick-service";
#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum ServiceRequest {
    Text { text: String },
    Files { paths: Vec<String> },
}
/// Paths a Service handed over, each readable once by `quick_read_service_file`. The
/// webview cannot read any other path through this command.
#[derive(Default)]
pub struct ServiceFiles(std::sync::Mutex<Vec<String>>);
impl ServiceFiles {
    pub fn offer(&self, paths: &[String]) {
        if let Ok(mut list) = self.0.lock() {
            list.extend(paths.iter().cloned());
        }
    }
    fn take(&self, path: &str) -> bool {
        let Ok(mut list) = self.0.lock() else {
            return false;
        };
        match list.iter().position(|item| item == path) {
            Some(index) => {
                list.remove(index);
                true
            }
            None => false,
        }
    }
}
#[tauri::command]
pub fn quick_read_service_file(
    files: tauri::State<'_, ServiceFiles>,
    path: String,
) -> Result<tauri::ipc::Response, String> {
    if !files.take(&path) {
        return Err("denied".to_string());
    }
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|error| format!("io: {error}"))
}
#[derive(Serialize, Clone)]
struct Command {
    command: &'static str,
}

/// The window comes back with its Dock icon; hidden, the app lives only in the menu
/// bar, like a VPN app (decision 0092).
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "macos")]
    let _ = app.set_dock_visibility(true);
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
            "quit" => request_quit(app),
            _ => {}
        });
    // The macOS menu bar takes a template: the mark in black with the eye holes
    // transparent, which the system recolours for light and dark bars. Windows
    // and Linux trays show the coloured app icon.
    #[cfg(target_os = "macos")]
    {
        let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
        tray = tray.icon(icon).icon_as_template(true);
    }
    #[cfg(not(target_os = "macos"))]
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

/// macOS: ⌘Q closes the window to the menu bar like ⌘W, the way VPN apps stay
/// running (decision 0092); only the menu bar icon's "Thoát OfflineMask" quits.
/// The default app menu is kept, with its Quit item swapped for this one.
#[cfg(target_os = "macos")]
const CLOSE_TO_TRAY: &str = "close-to-tray";
#[cfg(target_os = "macos")]
pub fn install_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = Menu::default(app)?;
    if let Some(tauri::menu::MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
        let last = app_menu.items()?.len();
        if last > 0 {
            app_menu.remove_at(last - 1)?;
        }
        app_menu.append(&MenuItem::with_id(
            app,
            CLOSE_TO_TRAY,
            "Đóng OfflineMask",
            true,
            Some("CmdOrCtrl+Q"),
        )?)?;
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id.as_ref() == CLOSE_TO_TRAY {
            // Closing goes through the frontend's close handler, which hides the
            // window and says the app keeps running.
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                let _ = window.close();
            }
        }
    });
    Ok(())
}

/// Quitting goes through the frontend first, so a pending vault save (debounced
/// 300 ms in the shell) is written before the process ends. The frontend answers
/// with `quick_quit`; if it never does, the app exits anyway after a grace period.
const QUIT_GRACE: std::time::Duration = std::time::Duration::from_secs(2);
pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    let _ = app.emit_to(MAIN_WINDOW, COMMAND_EVENT, Command { command: "quit" });
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_GRACE);
        handle.exit(0);
    });
}
#[tauri::command]
pub fn quick_quit(app: AppHandle) {
    app.exit(0);
}
pub fn hide_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_dock_visibility(false);
}
/// Closing the window (red button, ⌘W, ⌘Q): hide it and its Dock icon, quietly.
#[tauri::command]
pub fn quick_hide_main(app: AppHandle) {
    hide_main(&app);
}
/// "Mở trong OfflineMask" from the restore preview: bring the main window back.
#[tauri::command]
pub fn quick_show_main(app: AppHandle) {
    show_main(&app);
}

/// The login item starts the app with this flag, so it begins hidden in the tray.
pub const BACKGROUND_FLAG: &str = "--background";
pub fn started_in_background() -> bool {
    std::env::args().any(|arg| arg == BACKGROUND_FLAG)
}
