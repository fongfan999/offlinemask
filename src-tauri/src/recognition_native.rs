//! Isolated desktop qualification backend. Not enabled in normal builds.
use crate::models::Models;
use ort::{session::Session, value::Tensor};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{atomic::AtomicBool, Arc, Mutex},
};
use tauri::State;
type Reply<T> = Result<T, &'static str>;
#[derive(Deserialize)]
struct Catalog {
    assets: Vec<Asset>,
}
#[derive(Deserialize)]
struct Asset {
    directory: String,
    name: String,
    bytes: u64,
    sha256: String,
}
#[derive(Deserialize)]
struct Config {
    vocab_size: i64,
    id2label: BTreeMap<String, String>,
}
#[derive(Default)]
struct Inner {
    epoch: u32,
    sessions: Vec<(Session, Config)>,
}
pub struct NativeRecognition {
    library: PathBuf,
    inner: Arc<Mutex<Inner>>,
}
impl NativeRecognition {
    pub fn new(library: PathBuf) -> Self {
        Self {
            library,
            inner: Arc::new(Mutex::new(Inner::default())),
        }
    }
}
#[derive(Serialize)]
pub struct Loaded {
    epoch: u32,
    labels: Vec<BTreeMap<String, String>>,
}
#[derive(Serialize)]
pub struct Logits {
    dims: Vec<i64>,
    data: Vec<f32>,
}
#[tauri::command]
pub async fn recognition_native_load(
    state: State<'_, NativeRecognition>,
    models: State<'_, Models>,
) -> Reply<Loaded> {
    let root = models.ready_root()?;
    let library = state.library.clone();
    let shared = Arc::clone(&state.inner);
    tauri::async_runtime::spawn_blocking(move || {
        let mut inner = shared.lock().map_err(|_| "unavailable")?;
        // Serialize loading, inference and release. Old requests cannot use new sessions.
        inner.epoch = inner.epoch.checked_add(1).ok_or("unavailable")?;
        inner.sessions.clear();
        let cancel = AtomicBool::new(false);
        if !crate::models::valid(
            &library,
            35937208,
            "76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f",
            &cancel,
        ) {
            return Err("runtime");
        }
        ort::init_from(library.to_str().ok_or("runtime")?)
            .with_telemetry(false)
            .commit()
            .map_err(|_| "runtime")?;
        let catalog: Catalog =
            serde_json::from_str(include_str!("../../scripts/release-pack-v1.json"))
                .map_err(|_| "asset")?;
        let mut sessions = Vec::new();
        for directory in ["underthesea", "vietnamese-pii-multilingual"] {
            for asset in catalog.assets.iter().filter(|a| a.directory == directory) {
                if !crate::models::valid(
                    &root.join(directory).join(&asset.name),
                    asset.bytes,
                    &asset.sha256,
                    &cancel,
                ) {
                    return Err("asset");
                }
            }
            let config: Config = serde_json::from_reader(
                std::fs::File::open(root.join(directory).join("config.json"))
                    .map_err(|_| "asset")?,
            )
            .map_err(|_| "asset")?;
            let session = Session::builder()
                .map_err(|_| "runtime")?
                .with_log_level(ort::logging::LogLevel::Fatal)
                .map_err(|_| "runtime")?
                .with_intra_threads(4)
                .map_err(|_| "runtime")?
                .commit_from_file(root.join(directory).join("model_int8.onnx"))
                .map_err(|_| "runtime")?;
            sessions.push((session, config));
        }
        let labels = sessions.iter().map(|(_, c)| c.id2label.clone()).collect();
        inner.sessions = sessions;
        Ok(Loaded {
            epoch: inner.epoch,
            labels,
        })
    })
    .await
    .map_err(|_| "unavailable")?
}
fn validate_ids(ids: &[i64], vocab: i64) -> Reply<()> {
    if !(2..=384).contains(&ids.len()) || ids.iter().any(|v| *v < 0 || *v >= vocab) {
        return Err("input");
    }
    Ok(())
}
#[tauri::command]
pub async fn recognition_native_run(
    state: State<'_, NativeRecognition>,
    epoch: u32,
    model: usize,
    ids: Vec<i64>,
) -> Reply<Logits> {
    if model > 1 || !(2..=384).contains(&ids.len()) {
        return Err("input");
    }
    let shared = Arc::clone(&state.inner);
    tauri::async_runtime::spawn_blocking(move || {
        let mut inner = shared.lock().map_err(|_| "unavailable")?;
        if inner.epoch != epoch {
            return Err("stale");
        }
        let (session, config) = inner.sessions.get_mut(model).ok_or("not_ready")?;
        validate_ids(&ids, config.vocab_size)?;
        let shape = [1usize, ids.len()];
        let mut inputs = Vec::new();
        for input in &session.inputs {
            let data = match input.name.as_str() {
                "input_ids" => ids.clone(),
                "attention_mask" => vec![1; ids.len()],
                "token_type_ids" => vec![0; ids.len()],
                _ => return Err("input"),
            };
            inputs.push((
                input.name.clone(),
                Tensor::from_array((shape, data))
                    .map_err(|_| "runtime")?
                    .into_dyn(),
            ));
        }
        let outputs = session.run(inputs).map_err(|_| "runtime")?;
        let (dims, data) = outputs
            .get("logits")
            .ok_or("runtime")?
            .try_extract_tensor::<f32>()
            .map_err(|_| "runtime")?;
        if dims.as_ref() != [1, ids.len() as i64, config.id2label.len() as i64]
            || data.iter().any(|v| !v.is_finite())
        {
            return Err("runtime");
        }
        Ok(Logits {
            dims: dims.to_vec(),
            data: data.to_vec(),
        })
    })
    .await
    .map_err(|_| "unavailable")?
}
#[tauri::command]
pub async fn recognition_native_release(
    state: State<'_, NativeRecognition>,
    epoch: u32,
) -> Reply<()> {
    let shared = Arc::clone(&state.inner);
    tauri::async_runtime::spawn_blocking(move || {
        let mut inner = shared.lock().map_err(|_| "unavailable")?;
        if inner.epoch == epoch {
            inner.sessions.clear();
        }
        Ok(())
    })
    .await
    .map_err(|_| "unavailable")?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_token_ids() {
        for ids in [vec![], vec![1], vec![0; 385], vec![-1, 0], vec![0, 10]] {
            assert!(validate_ids(&ids, 10).is_err());
        }
        assert!(validate_ids(&[0, 9], 10).is_ok());
    }
}
