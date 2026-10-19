//! Feature-gated local CPU graph comparison. Fixed assets; no URLs or logging.
use ort::{
    session::{run_options::RunOptions, Session},
    value::Tensor,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Instant,
};
use tauri::State;
type Reply<T> = Result<T, &'static str>;
struct Active {
    id: u32,
    options: Arc<RunOptions>,
    cancelled: bool,
    running: bool,
}
#[derive(Default)]
struct Inner {
    session: Option<Session>,
    active: Option<Active>,
    last: Option<u32>,
    loading: bool,
}
pub struct NativeGraph {
    root: PathBuf,
    inner: Arc<Mutex<Inner>>,
}
impl NativeGraph {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            inner: Arc::new(Mutex::new(Inner::default())),
        }
    }
}
fn verify(path: &Path, expected: &str) -> Reply<()> {
    let mut file = std::fs::File::open(path).map_err(|_| "asset")?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|_| "asset")?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err("asset");
    }
    Ok(())
}
#[tauri::command]
pub async fn minilm_native_load(
    state: State<'_, NativeGraph>,
    threads: Option<usize>,
) -> Reply<()> {
    let threads = threads.unwrap_or(1);
    if !(1..=2).contains(&threads) {
        return Err("threads");
    }
    {
        let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
        if inner.loading || inner.active.is_some() {
            return Err("busy");
        }
        // Developer variant switch: drop the previous session before loading
        // another so the comparison does not retain two model allocations.
        inner.session = None;
        inner.loading = true;
    }
    let root = state.root.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Reply<Session> {
        let library = root.join("libonnxruntime.1.24.3.dylib");
        let graph = root.join("model-gather.onnx");
        verify(
            &library,
            "76831409ce6eded92b4cb343cf422c458a60c1ea1d5f3cfa69692ab7fcc67f0f",
        )?;
        verify(
            &graph,
            "498e24d4efea4ecca4dbdedfa8356f56de89e24815196da14cb4474ef27de0c8",
        )?;
        ort::init_from(library.to_str().ok_or("asset")?)
            .with_telemetry(false)
            .commit()
            .map_err(|_| "runtime")?;
        Session::builder()
            .map_err(|_| "runtime")?
            .with_log_level(ort::logging::LogLevel::Fatal)
            .map_err(|_| "runtime")?
            .with_intra_threads(threads)
            .map_err(|_| "runtime")?
            .commit_from_file(graph)
            .map_err(|_| "runtime")
    })
    .await
    .map_err(|_| "unavailable")
    .and_then(|x| x);
    let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
    inner.loading = false;
    inner.session = Some(result?);
    Ok(())
}
#[derive(Serialize)]
pub struct Output {
    tokens: usize,
    logits: Option<Vec<f32>>,
    kernel_ms: f64,
}
#[tauri::command]
pub async fn minilm_native_run(
    state: State<'_, NativeGraph>,
    id: u32,
    ids: Vec<i64>,
    diagnostic_logits: bool,
) -> Reply<Output> {
    if !(2..=384).contains(&ids.len()) || ids.iter().any(|v| !(0..250037).contains(v)) {
        return Err("input");
    }
    let (mut session, options) = {
        let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
        if inner.loading || inner.active.is_some() {
            return Err("busy");
        }
        if inner.last.is_some_and(|last| id <= last) {
            return Err("stale");
        }
        if inner.session.is_none() {
            return Err("not_ready");
        }
        let options = Arc::new(RunOptions::new().map_err(|_| "runtime")?);
        inner.last = Some(id);
        inner.active = Some(Active {
            id,
            options: Arc::clone(&options),
            cancelled: false,
            running: false,
        });
        (inner.session.take().ok_or("not_ready")?, options)
    };
    let shared = Arc::clone(&state.inner);
    let result=tauri::async_runtime::spawn_blocking(move||{
        let result=(||->Reply<Output>{
            let shape=[1usize,ids.len()];
            let inputs=ort::inputs![
                "input_ids"=>Tensor::from_array((shape,ids.clone())).map_err(|_|"runtime")?,
                "attention_mask"=>Tensor::from_array((shape,vec![1i64;ids.len()])).map_err(|_|"runtime")?,
                "token_type_ids"=>Tensor::from_array((shape,vec![0i64;ids.len()])).map_err(|_|"runtime")?
            ];
            if let Some(active)=shared.lock().map_err(|_|"unavailable")?.active.as_mut(){active.running=true;}
            let start=Instant::now();
            let output=session.run_with_options(inputs,&options).map_err(|_|"runtime")?;
            let kernel_ms=start.elapsed().as_secs_f64()*1000.0;
            let (dims,values)=output.get("logits").ok_or("runtime")?.try_extract_tensor::<f32>().map_err(|_|"runtime")?;
            if dims.as_ref()!=[1,ids.len() as i64,39]||values.iter().any(|x|!x.is_finite()){return Err("runtime");}
            Ok(Output{tokens:ids.len(),logits:diagnostic_logits.then(||values.to_vec()),kernel_ms})
        })();
        (session,result)
    }).await;
    let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
    let cancelled = inner.active.take().is_some_and(|a| a.cancelled);
    let (session, result) = result.map_err(|_| "unavailable")?;
    inner.session = Some(session);
    if cancelled {
        return Err("cancelled");
    }
    result
}
#[tauri::command]
pub fn minilm_native_cancel(state: State<'_, NativeGraph>, id: u32) -> Reply<bool> {
    let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
    if let Some(active) = inner.active.as_mut() {
        if active.id == id {
            active.cancelled = true;
            active.options.terminate().map_err(|_| "runtime")?;
            return Ok(true);
        }
    }
    Ok(false)
}
#[tauri::command]
pub fn minilm_native_running(state: State<'_, NativeGraph>, id: u32) -> Reply<bool> {
    Ok(state
        .inner
        .lock()
        .map_err(|_| "unavailable")?
        .active
        .as_ref()
        .is_some_and(|a| a.id == id && a.running))
}
