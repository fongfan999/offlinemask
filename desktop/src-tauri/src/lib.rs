#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // One running copy (decision 0097): launching OfflineMask again while it sits in
    // the tray brings its window back instead of starting a second process that
    // would fight over the shortcut and the vault. Registered first, as required.
    // A second login-item start (`--background`) changes nothing.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if !argv.iter().any(|arg| arg == background::BACKGROUND_FLAG) {
            background::show_main(app);
        }
    }));
    let builder = builder.setup(|app| {
        // Quick actions (decision 0090): one global shortcut; the clipboard is read
        // only when the user presses it or a panel button. Nothing watches it.
        #[cfg(desktop)]
        app.handle()
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
        // Background mode (decision 0092): tray icon, optional login item that
        // starts hidden. The window hides on close from the frontend; ⌘Q and the
        // tray quit.
        #[cfg(desktop)]
        {
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![background::BACKGROUND_FLAG]),
            ))?;
            app.manage(background::ServiceFiles::default());
            app.manage(selection::SelectionWatch::default());
        }
        let root = app
            .path()
            .app_local_data_dir()?
            .join(models::pack_directory());
        // The asset scope (`$APPLOCALDATA/models/**`) is resolved before this hook and
        // requests are matched by their real path. The MSIX redirects app data to the
        // package's LocalCache, and on the first launch that folder does not exist yet,
        // so the pack was refused until a restart (decision 0117). Allowing the folder
        // again once it exists adds its redirected path.
        let models_dir = app.path().app_local_data_dir()?.join("models");
        std::fs::create_dir_all(&models_dir)?;
        app.asset_protocol_scope()
            .allow_directory(&models_dir, true)?;
        app.manage(vault::Vault::new(app.path().app_local_data_dir()?));
        let handle = app.handle().clone();
        app.manage(models::Models::with_notifier(
            root,
            Box::new(move |status| {
                // Status only: byte counts, stage and the local pack root.
                let _ = handle.emit(models::STATUS_EVENT, status.clone());
            }),
        ));
        #[cfg(feature = "minilm-desktop-prototype")]
        app.manage(minilm_prototype::Prototype::new(
            app.path()
                .app_local_data_dir()?
                .join("models/minilm-prototype"),
        ));
        #[cfg(feature = "minilm-native-desktop-prototype")]
        app.manage(minilm_native_graph::NativeGraph::new(
            app.path()
                .app_local_data_dir()?
                .join("models/minilm-prototype"),
        ));
        #[cfg(feature = "recognition-native-desktop")]
        app.manage(recognition_native::NativeRecognition::new(
            app.path()
                .resource_dir()?
                .join("native")
                .join(native_runtime::LIBRARY),
        ));
        // The webview windows come last (decision 0121). Tauri builds config windows
        // before this hook, and on a slow machine their first commands arrived before
        // the state above was managed: `vault_status` failed for the whole launch.
        for window in app.config().app.windows.clone() {
            if !window.create {
                tauri::WebviewWindowBuilder::from_config(app.handle(), &window)?.build()?;
            }
        }
        #[cfg(desktop)]
        {
            background::setup_tray(app.handle())?;
            #[cfg(target_os = "macos")]
            background::install_app_menu(app.handle())?;
            #[cfg(target_os = "macos")]
            services::install(app.handle());
            // The floating panel must take clicks without activating the app, or the
            // paste after a popover button lands in OfflineMask (decision 0096).
            #[cfg(target_os = "macos")]
            if let Some(panel) = app.get_webview_window("pill") {
                panel_macos::make_non_activating(&panel);
            }
            if background::started_in_background() {
                background::hide_main(app.handle());
            }
        }
        Ok(())
    });
    #[cfg(all(
        not(feature = "minilm-desktop-prototype"),
        not(feature = "recognition-native-desktop")
    ))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        models::recognition_encode,
        models::model_status,
        models::download_models,
        models::cancel_model_download,
        models::uninstall_models,
        vault::vault_status,
        vault::vault_create,
        vault::vault_unlock,
        vault::vault_save,
        vault::vault_change_passcode,
        vault::vault_reset,
        quick_input::quick_input_permission,
        quick_input::quick_copy_selection,
        quick_input::quick_replace_selection,
        quick_input::quick_release_clipboard,
        background::quick_quit,
        background::quick_show_main,
        background::quick_hide_main,
        background::quick_tray_offer,
        background::quick_launch_at_login,
        background::quick_set_launch_at_login,
        background::quick_read_service_file,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
        selection::quick_read_selection,
        selection::quick_set_places
    ]);
    #[cfg(all(
        feature = "minilm-desktop-prototype",
        not(feature = "minilm-native-desktop-prototype")
    ))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        models::recognition_encode,
        models::model_status,
        models::download_models,
        models::cancel_model_download,
        models::uninstall_models,
        vault::vault_status,
        vault::vault_create,
        vault::vault_unlock,
        vault::vault_save,
        vault::vault_change_passcode,
        vault::vault_reset,
        quick_input::quick_input_permission,
        quick_input::quick_copy_selection,
        quick_input::quick_replace_selection,
        quick_input::quick_release_clipboard,
        background::quick_quit,
        background::quick_show_main,
        background::quick_hide_main,
        background::quick_tray_offer,
        background::quick_launch_at_login,
        background::quick_set_launch_at_login,
        background::quick_read_service_file,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
        selection::quick_read_selection,
        selection::quick_set_places,
        minilm_prototype::minilm_encode,
        minilm_prototype::minilm_cancel,
        minilm_prototype::minilm_idle,
        minilm_prototype::minilm_active,
        minilm_prototype::minilm_graph,
        minilm_prototype::minilm_finish
    ]);
    #[cfg(feature = "minilm-native-desktop-prototype")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        models::recognition_encode,
        models::model_status,
        models::download_models,
        models::cancel_model_download,
        models::uninstall_models,
        vault::vault_status,
        vault::vault_create,
        vault::vault_unlock,
        vault::vault_save,
        vault::vault_change_passcode,
        vault::vault_reset,
        quick_input::quick_input_permission,
        quick_input::quick_copy_selection,
        quick_input::quick_replace_selection,
        quick_input::quick_release_clipboard,
        background::quick_quit,
        background::quick_show_main,
        background::quick_hide_main,
        background::quick_tray_offer,
        background::quick_launch_at_login,
        background::quick_set_launch_at_login,
        background::quick_read_service_file,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
        selection::quick_read_selection,
        selection::quick_set_places,
        minilm_prototype::minilm_encode,
        minilm_prototype::minilm_cancel,
        minilm_prototype::minilm_idle,
        minilm_prototype::minilm_active,
        minilm_prototype::minilm_graph,
        minilm_prototype::minilm_finish,
        minilm_native_graph::minilm_native_load,
        minilm_native_graph::minilm_native_run,
        minilm_native_graph::minilm_native_cancel,
        minilm_native_graph::minilm_native_running
    ]);
    #[cfg(feature = "recognition-native-desktop")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        models::recognition_encode,
        models::model_status,
        models::download_models,
        models::cancel_model_download,
        models::uninstall_models,
        vault::vault_status,
        vault::vault_create,
        vault::vault_unlock,
        vault::vault_save,
        vault::vault_change_passcode,
        vault::vault_reset,
        quick_input::quick_input_permission,
        quick_input::quick_copy_selection,
        quick_input::quick_replace_selection,
        quick_input::quick_release_clipboard,
        background::quick_quit,
        background::quick_show_main,
        background::quick_hide_main,
        background::quick_tray_offer,
        background::quick_launch_at_login,
        background::quick_set_launch_at_login,
        background::quick_read_service_file,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
        selection::quick_read_selection,
        selection::quick_set_places,
        recognition_native::recognition_native_load,
        recognition_native::recognition_native_run,
        recognition_native::recognition_native_release
    ]);
    let builder = builder.plugin(
        tauri_plugin_opener::Builder::new()
            .open_js_links_on_click(false)
            .build(),
    );
    // Spreadsheet export: the save dialog grants write access to the one file the
    // user picks; no other path is in the fs scope (decision 0076).
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init());
    builder
        .build(tauri::generate_context!())
        .expect("error while building OfflineMask")
        .run(|app, event| {
            // macOS: a click on the dock icon brings the hidden window back.
            #[cfg(target_os = "macos")]
            if matches!(event, tauri::RunEvent::Reopen { .. }) {
                background::show_main(app);
            }
            #[cfg(feature = "recognition-native-sidecar")]
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<recognition_native::NativeRecognition>()
                    .shutdown();
            }
            #[cfg(not(any(target_os = "macos", feature = "recognition-native-sidecar")))]
            let _ = (app, event);
        });
}
mod background;
mod clipboard_guard;
#[cfg(feature = "minilm-native-desktop-prototype")]
mod minilm_native_graph;
#[cfg(feature = "minilm-desktop-prototype")]
mod minilm_prototype;
mod model_pack;
mod models;
#[cfg(target_os = "macos")]
mod panel_macos;
mod quick_input;
mod recognition_tokenizer;
mod selection;
#[cfg(target_os = "macos")]
mod selection_macos;
#[cfg(windows)]
mod selection_windows;
#[cfg(target_os = "macos")]
mod services;
mod vault;
use tauri::{Emitter, Manager};

#[cfg(feature = "recognition-native-desktop")]
mod native_runtime;
#[cfg(all(
    feature = "recognition-native-desktop",
    not(feature = "recognition-native-sidecar")
))]
mod recognition_native;
#[cfg(feature = "recognition-native-sidecar")]
#[path = "recognition_sidecar.rs"]
mod recognition_native;
#[cfg(feature = "recognition-native-sidecar")]
mod recognition_process;
