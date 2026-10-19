//! Compile-time opt-in only. No production routing, downloads or input logging.
use minilm_tokenizer::{Encoded, LocalTokenizer, MAX_SOURCE_UNITS};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Instant,
};
use tauri::{Manager, State};

type Reply<T> = Result<T, &'static str>;
#[derive(Default)]
struct Inner {
    tokenizer: Option<Arc<LocalTokenizer>>,
    active: Option<(u32, Arc<AtomicBool>)>,
    last_id: Option<u32>,
}
pub struct Prototype {
    root: PathBuf,
    inner: Arc<Mutex<Inner>>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimedEncoding {
    #[serde(flatten)]
    encoding: Encoded,
    native_ms: f64,
}
impl Prototype {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            inner: Arc::new(Mutex::new(Inner::default())),
        }
    }
}

#[tauri::command]
pub async fn minilm_encode(
    state: State<'_, Prototype>,
    id: u32,
    text: String,
    inference: bool,
) -> Reply<TimedEncoding> {
    if text.len() > MAX_SOURCE_UNITS * 4 || text.encode_utf16().count() > MAX_SOURCE_UNITS {
        return Err("input_limit");
    }
    let cancelled = Arc::new(AtomicBool::new(false));
    let cached = {
        let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
        if inner.active.is_some() {
            return Err("busy");
        }
        if inner.last_id.is_some_and(|last| id <= last) {
            return Err("stale");
        }
        inner.last_id = Some(id);
        inner.active = Some((id, Arc::clone(&cancelled)));
        inner.tokenizer.clone()
    };
    let root = state.root.clone();
    let flag = Arc::clone(&cancelled);
    let result = tauri::async_runtime::spawn_blocking(
        move || -> Reply<(Arc<LocalTokenizer>, TimedEncoding)> {
            let start = Instant::now();
            if flag.load(Ordering::Acquire) {
                return Err("cancelled");
            }
            let tokenizer = match cached {
                Some(value) => value,
                None => Arc::new(
                    LocalTokenizer::load(&root.join("tokenizer.json")).map_err(|_| "asset")?,
                ),
            };
            if flag.load(Ordering::Acquire) {
                return Err("cancelled");
            }
            let encoding = tokenizer.encode(&text, inference).map_err(|_| "encoding")?;
            Ok((
                tokenizer,
                TimedEncoding {
                    encoding,
                    native_ms: start.elapsed().as_secs_f64() * 1000.0,
                },
            ))
        },
    )
    .await
    .map_err(|_| "unavailable")
    .and_then(|value| value);
    let mut inner = state.inner.lock().map_err(|_| "unavailable")?;
    inner.active = None;
    if cancelled.load(Ordering::Acquire) {
        return Err("cancelled");
    }
    let (tokenizer, encoding) = result?;
    inner.tokenizer = Some(tokenizer);
    Ok(encoding)
}

#[tauri::command]
pub fn minilm_cancel(state: State<'_, Prototype>, id: u32) -> Reply<bool> {
    let inner = state.inner.lock().map_err(|_| "unavailable")?;
    if let Some((active, flag)) = &inner.active {
        if *active == id {
            flag.store(true, Ordering::Release);
            return Ok(true);
        }
    }
    Ok(false)
}

#[tauri::command]
pub fn minilm_idle(state: State<'_, Prototype>) -> Reply<bool> {
    Ok(state
        .inner
        .lock()
        .map_err(|_| "unavailable")?
        .active
        .is_none())
}

#[tauri::command]
pub fn minilm_active(state: State<'_, Prototype>, id: u32) -> Reply<bool> {
    Ok(state
        .inner
        .lock()
        .map_err(|_| "unavailable")?
        .active
        .as_ref()
        .is_some_and(|(active, _)| *active == id))
}

#[tauri::command]
pub async fn minilm_graph(state: State<'_, Prototype>) -> Reply<String> {
    let path = state.root.join("model-gather.onnx");
    tauri::async_runtime::spawn_blocking(move || {
        let mut file = File::open(&path).map_err(|_| "asset")?;
        if file.metadata().map_err(|_| "asset")?.len() != 181_713_967 {
            return Err("asset");
        }
        let mut hash = Sha256::new();
        let mut buffer = [0; 65536];
        loop {
            let n = file.read(&mut buffer).map_err(|_| "asset")?;
            if n == 0 {
                break;
            }
            hash.update(&buffer[..n]);
        }
        if format!("{:x}", hash.finalize())
            != "498e24d4efea4ecca4dbdedfa8356f56de89e24815196da14cb4474ef27de0c8"
        {
            return Err("asset");
        }
        path.to_str().map(str::to_owned).ok_or("asset")
    })
    .await
    .map_err(|_| "unavailable")?
}

// Metrics only: this diagnostic sink cannot accept text, paths, offsets or logits.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Parity,
    Cold,
    Warm,
    Long,
    CancelAck,
    CancelDrain,
    WorkerCancel,
    Recovery,
    Boundaries,
    Busy,
    Stale,
    Heartbeat,
    Network,
    Tokenize,
    EncodeWall,
    Kernel,
    InferenceWall,
    Planning,
    PhaseHeartbeat,
    Cache,
    CancellationCompleted,
    ThreadVariant,
    WindowParity,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Metric {
    kind: Kind,
    duration_ms: f64,
    count: u32,
    max_error: f64,
    passed: bool,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Report {
    completed: bool,
    metrics: Vec<Metric>,
}
#[tauri::command]
pub fn minilm_finish(app: tauri::AppHandle, report: Report) -> Reply<()> {
    if report.metrics.len() > 128
        || report.metrics.iter().any(|m| {
            !m.duration_ms.is_finite()
                || m.duration_ms < 0.0
                || !m.max_error.is_finite()
                || m.max_error < 0.0
        })
    {
        return Err("report");
    }
    let root = app.path().app_local_data_dir().map_err(|_| "report")?;
    std::fs::create_dir_all(&root).map_err(|_| "report")?;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join("minilm-desktop-report.json"))
        .map_err(|_| "report")?;
    let bytes = serde_json::to_vec_pretty(&report).map_err(|_| "report")?;
    file.write_all(&bytes).map_err(|_| "report")?;
    file.sync_all().map_err(|_| "report")?;
    app.exit(if report.completed { 0 } else { 1 });
    Ok(())
}
