//! Opt-in isolated native backend. Host never loads the inference library.
use crate::{
    models::Models,
    recognition_process::{Reply, Supervisor},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[cfg(not(feature = "recognition-native-release"))]
use std::sync::atomic::AtomicBool;
use std::{collections::BTreeMap, path::PathBuf};
use tauri::State;
pub struct NativeRecognition {
    library: PathBuf,
    supervisor: Supervisor,
}
impl NativeRecognition {
    pub fn shutdown(&self) {
        self.supervisor.shutdown();
    }
    pub fn new(library: PathBuf) -> Self {
        Self {
            library,
            supervisor: Supervisor::default(),
        }
    }
}
#[derive(Deserialize)]
struct Ready {
    ready: bool,
    labels: BTreeMap<String, String>,
}
#[derive(Serialize)]
pub struct Loaded {
    epoch: u32,
    labels: Vec<BTreeMap<String, String>>,
}
#[tauri::command]
pub async fn recognition_native_load(
    state: State<'_, NativeRecognition>,
    models: State<'_, Models>,
) -> Reply<Loaded> {
    let root = models.ready_root()?;
    let library = state.library.clone();
    let supervisor = state.supervisor.clone();
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(feature = "recognition-native-release")]
        verify_bundle()?;
        #[cfg(not(feature = "recognition-native-release"))]
        if !crate::models::valid(
            &library,
            35937208,
            "76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f",
            &AtomicBool::new(false),
        ) {
            return Err("runtime");
        }
        let executable = library.parent().ok_or("runtime")?.join(if cfg!(windows) {
            "recognition-sidecar.exe"
        } else {
            "recognition-sidecar"
        });
        let count = crate::models::pack().models.len();
        let (epoch, values) = supervisor.load(&executable, &library, &root, count)?;
        let result = (|| {
            let mut labels = Vec::new();
            for value in values {
                let ready: Ready = serde_json::from_value(value).map_err(|_| "protocol")?;
                if !ready.ready || ready.labels.is_empty() {
                    return Err("protocol");
                }
                labels.push(ready.labels);
            }
            Ok(Loaded { epoch, labels })
        })();
        if result.is_err() {
            supervisor.release(epoch)?;
        }
        result
    })
    .await
    .map_err(|_| "unavailable")?
}

// Signing legitimately changes the dylib bytes. Release builds verify its pinned
// upstream hash before staging, then seal the complete bundle. Check that seal
// locally before loading executable resources; do not contact a trust service.
#[cfg(all(feature = "recognition-native-release", target_os = "macos"))]
fn verify_bundle() -> Reply<()> {
    use std::process::{Command, Stdio};
    let executable = std::env::current_exe().map_err(|_| "runtime")?;
    let bundle = executable
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .filter(|path| path.extension().is_some_and(|extension| extension == "app"))
        .ok_or("runtime")?;
    let status = Command::new("/usr/bin/codesign")
        .args(["--verify", "--deep", "--strict", "--all-architectures"])
        .arg(bundle)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|_| "runtime")?;
    if status.success() {
        Ok(())
    } else {
        Err("runtime")
    }
}

#[cfg(all(feature = "recognition-native-release", not(target_os = "macos")))]
compile_error!("The native release package is currently qualified only on macOS arm64");
#[tauri::command]
pub async fn recognition_native_run(
    state: State<'_, NativeRecognition>,
    epoch: u32,
    model: usize,
    ids: Vec<i64>,
) -> Reply<Value> {
    if !(2..=384).contains(&ids.len()) {
        return Err("input");
    }
    let supervisor = state.supervisor.clone();
    tauri::async_runtime::spawn_blocking(move || supervisor.run(epoch, model, &ids))
        .await
        .map_err(|_| "unavailable")?
}
#[tauri::command]
pub async fn recognition_native_release(
    state: State<'_, NativeRecognition>,
    epoch: u32,
) -> Reply<()> {
    let supervisor = state.supervisor.clone();
    tauri::async_runtime::spawn_blocking(move || supervisor.release(epoch))
        .await
        .map_err(|_| "unavailable")?
}
