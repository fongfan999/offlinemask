#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().setup(|app| {
        // Quick actions (decision 0090): one global shortcut; the clipboard is read
        // only when the user presses it or a panel button. Nothing watches it.
        #[cfg(desktop)]
        app.handle()
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
        // Background mode (decision 0092): tray icon, optional login item that
        // starts hidden. The window hides on close from the frontend.
        #[cfg(desktop)]
        {
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![background::BACKGROUND_FLAG]),
            ))?;
            background::setup_tray(app.handle())?;
            app.manage(background::ServiceFiles::default());
            app.manage(clipboard_watch::ClipboardWatch::default());
            app.manage(selection::SelectionWatch::default());
            #[cfg(target_os = "macos")]
            services::install(app.handle());
            // The floating panel must take clicks without activating the app, or the
            // paste after a popover button lands in OfflineMask (decision 0096).
            #[cfg(target_os = "macos")]
            if let Some(panel) = app.get_webview_window("pill") {
                panel_macos::make_non_activating(&panel);
            }
            if background::started_in_background() {
                if let Some(window) = app.get_webview_window(background::MAIN_WINDOW) {
                    let _ = window.hide();
                }
            }
        }
        let root = app
            .path()
            .app_local_data_dir()?
            .join(models::pack_directory());
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
        quick_input::quick_paste_result,
        background::quick_quit,
        background::quick_show_main,
        background::quick_read_service_file,
        clipboard_watch::quick_watch_supported,
        clipboard_watch::quick_watch_clipboard,
        selection::quick_selection_supported,
        selection::quick_selection_watch
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
        quick_input::quick_paste_result,
        background::quick_quit,
        background::quick_show_main,
        background::quick_read_service_file,
        clipboard_watch::quick_watch_supported,
        clipboard_watch::quick_watch_clipboard,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
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
        quick_input::quick_paste_result,
        background::quick_quit,
        background::quick_show_main,
        background::quick_read_service_file,
        clipboard_watch::quick_watch_supported,
        clipboard_watch::quick_watch_clipboard,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
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
        quick_input::quick_paste_result,
        background::quick_quit,
        background::quick_show_main,
        background::quick_read_service_file,
        clipboard_watch::quick_watch_supported,
        clipboard_watch::quick_watch_clipboard,
        selection::quick_selection_supported,
        selection::quick_selection_watch,
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
mod clipboard_watch;
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
