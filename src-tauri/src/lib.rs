#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().setup(|app| {
        let root = app
            .path()
            .app_local_data_dir()?
            .join(models::pack_directory());
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
                .join("native/libonnxruntime.1.24.3.dylib"),
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
        models::cancel_model_download
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
        recognition_native::recognition_native_load,
        recognition_native::recognition_native_run,
        recognition_native::recognition_native_release
    ]);
    let builder = builder.plugin(
        tauri_plugin_opener::Builder::new()
            .open_js_links_on_click(false)
            .build(),
    );
    #[cfg(not(feature = "recognition-native-sidecar"))]
    builder
        .run(tauri::generate_context!())
        .expect("error while running OfflineMask");
    #[cfg(feature = "recognition-native-sidecar")]
    builder
        .build(tauri::generate_context!())
        .expect("error while building OfflineMask")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<recognition_native::NativeRecognition>()
                    .shutdown();
            }
        });
}
#[cfg(feature = "minilm-native-desktop-prototype")]
mod minilm_native_graph;
#[cfg(feature = "minilm-desktop-prototype")]
mod minilm_prototype;
mod model_pack;
mod models;
mod recognition_tokenizer;
use tauri::{Emitter, Manager};

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
