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
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const SERVICE_EVENT: &str = "quick-service";
#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub enum ServiceRequest {
    Text { text: String },
    Files { paths: Vec<String> },
}
/// Paths a Service handed over, each readable once by `quick_read_service_file`. The
/// webview cannot read any other path through this command.
#[derive(Default)]
pub struct ServiceFiles(std::sync::Mutex<Vec<String>>);
impl ServiceFiles {
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
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

/// "Bật Ẩn nhanh…" in the tray menu, present only while Ẩn nhanh is off; the
/// frontend says when (decision 0098). It opens Cài đặt, where the feature lives.
pub struct TrayOffer<R: Runtime> {
    menu: Menu<R>,
    item: MenuItem<R>,
    shown: std::sync::Mutex<bool>,
}
#[tauri::command]
pub fn quick_tray_offer(
    offer: tauri::State<'_, TrayOffer<tauri::Wry>>,
    on: bool,
) -> Result<(), String> {
    let mut shown = offer.shown.lock().map_err(|_| "io: poisoned".to_string())?;
    if *shown == on {
        return Ok(());
    }
    if on {
        offer.menu.insert(&offer.item, 1)
    } else {
        offer.menu.remove(&offer.item)
    }
    .map_err(|error| error.to_string())?;
    *shown = on;
    Ok(())
}

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Mở OfflineMask", true, None::<&str>)?;
    let enable = MenuItem::with_id(app, "enable", "Bật Ẩn nhanh…", true, None::<&str>)?;
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
            "enable" => {
                let _ = app.emit_to(
                    MAIN_WINDOW,
                    COMMAND_EVENT,
                    Command {
                        command: "settings",
                    },
                );
            }
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
    app.manage(TrayOffer {
        menu,
        item: enable,
        shown: std::sync::Mutex::new(false),
    });
    Ok(())
}

/// macOS: ⌘W hides the window to the menu bar and ⌘Q quits for good (decision 0092).
/// The default app menu is kept, with its Quit item, which calls `terminate:` and
/// would skip the pending vault save, swapped for one that quits like the tray does.
#[cfg(target_os = "macos")]
const QUIT_APP: &str = "quit-app";
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
            QUIT_APP,
            "Thoát OfflineMask",
            true,
            Some("CmdOrCtrl+Q"),
        )?)?;
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id.as_ref() == QUIT_APP {
            request_quit(app);
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
/// A login start: the flag from the Run key or LaunchAgent, or the MSIX startup task,
/// which starts the app without arguments.
pub fn started_in_background() -> bool {
    std::env::args().any(|arg| arg == BACKGROUND_FLAG) || startup_task::activated()
}

/// The error when Windows keeps the startup task off because the user turned it off
/// in Task Manager; the frontend shows where to turn it back on.
#[cfg_attr(not(windows), allow(dead_code))]
const DISABLED_BY_USER: &str = "disabled-by-user";

/// Whether OfflineMask starts at login, read from the system (decision 0092).
#[tauri::command]
pub async fn quick_launch_at_login(app: AppHandle) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        if startup_task::packaged() {
            return startup_task::enabled();
        }
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .is_enabled()
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn quick_set_launch_at_login(app: AppHandle, on: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        if startup_task::packaged() {
            return startup_task::set(on);
        }
        use tauri_plugin_autostart::ManagerExt;
        let launcher = app.autolaunch();
        if on {
            launcher.enable()
        } else {
            launcher.disable()
        }
        .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// The Microsoft Store build (decision 0117). A packaged app's writes to the `Run`
/// registry key stay inside the package, so Windows never starts it from there; the
/// manifest declares a startup task that the app turns on and off instead.
#[cfg(windows)]
mod startup_task {
    use windows::core::HSTRING;
    use windows::ApplicationModel::{
        Activation::ActivationKind, AppInstance, Package, StartupTask, StartupTaskState,
    };

    /// The `TaskId` of the `windows.startupTask` extension in `store/AppxManifest.xml`.
    const TASK_ID: &str = "OfflineMaskStartup";

    /// Only a packaged process has a package identity.
    pub fn packaged() -> bool {
        Package::Current().is_ok()
    }

    pub fn activated() -> bool {
        packaged()
            && AppInstance::GetActivatedEventArgs()
                .and_then(|args| args.Kind())
                .is_ok_and(|kind| kind == ActivationKind::StartupTask)
    }

    fn task() -> Result<StartupTask, String> {
        StartupTask::GetAsync(&HSTRING::from(TASK_ID))
            .and_then(|operation| operation.join())
            .map_err(|error| error.message())
    }

    fn on(state: StartupTaskState) -> bool {
        state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy
    }

    pub fn enabled() -> Result<bool, String> {
        task()?.State().map(on).map_err(|error| error.message())
    }

    pub fn set(enable: bool) -> Result<(), String> {
        let task = task()?;
        if !enable {
            return task.Disable().map_err(|error| error.message());
        }
        let state = task
            .RequestEnableAsync()
            .and_then(|operation| operation.join())
            .map_err(|error| error.message())?;
        // Turned off in Task Manager or by policy: only the user or an administrator
        // can turn it back on there, so the switch reports the failure.
        if on(state) {
            Ok(())
        } else if state == StartupTaskState::DisabledByUser {
            Err(super::DISABLED_BY_USER.to_string())
        } else {
            Err(format!("startup task state {}", state.0))
        }
    }
}

#[cfg(not(windows))]
mod startup_task {
    pub fn activated() -> bool {
        false
    }
}
