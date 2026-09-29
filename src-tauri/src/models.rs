use crate::model_pack::{Pack, Progress};
use crate::recognition_tokenizer::{Encoded, RecognitionTokenizer};
use reqwest::{blocking::Client, header::RANGE, StatusCode};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

fn pack() -> Pack {
    let pack: Pack = serde_json::from_str(include_str!("../../scripts/release-pack-v1.json"))
        .expect("pinned recognition pack");
    pack.validate().expect("valid recognition pack");
    pack
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    stage: String,
    downloaded: u64,
    total: u64,
    installed_bytes: u64,
    installed: u64,
    error: Option<String>,
    root: Option<String>,
}
struct Inner {
    root: PathBuf,
    pack: Pack,
    status: Mutex<ModelStatus>,
    cancel: AtomicBool,
    tokenizer: Mutex<Option<RecognitionTokenizer>>,
}
#[derive(Clone)]
pub struct Models(Arc<Inner>);

pub(crate) fn digest(path: &Path, cancel: &AtomicBool) -> Result<String, String> {
    let mut file = File::open(path).map_err(|_| "file")?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        let n = file.read(&mut buffer).map_err(|_| "file")?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
pub(crate) fn valid(path: &Path, bytes: u64, expected: &str, cancel: &AtomicBool) -> bool {
    fs::metadata(path).is_ok_and(|m| m.len() == bytes)
        && digest(path, cancel).is_ok_and(|hash| hash == expected)
}

impl Models {
    #[cfg(feature = "recognition-native-desktop")]
    pub(crate) fn ready_root(&self) -> Result<PathBuf, &'static str> {
        let status = self.0.status.lock().map_err(|_| "unavailable")?;
        if status.stage != "ready" {
            return Err("unavailable");
        }
        Ok(PathBuf::from(status.root.as_ref().ok_or("unavailable")?))
    }

    pub fn new(root: PathBuf) -> Self {
        let pack = pack();
        let total = pack.download_bytes();
        let installed_bytes = pack.installed_bytes();
        let manager = Self(Arc::new(Inner {
            root,
            pack,
            status: Mutex::new(ModelStatus {
                stage: "checking".into(),
                downloaded: 0,
                total,
                installed_bytes,
                installed: 0,
                error: None,
                root: None,
            }),
            cancel: AtomicBool::new(false),
            tokenizer: Mutex::new(None),
        }));
        let check = manager.clone();
        std::thread::spawn(move || {
            if let Some(root) = check.0.pack.discovered_root(&check.0.root, &check.0.cancel) {
                check.finish(Ok(root));
            } else {
                let downloaded = check.0.pack.cached_bytes(&check.0.root, &check.0.cancel);
                check.0.status.lock().unwrap().downloaded = downloaded;
                check.finish(Err(if downloaded > 0 {
                    "cancelled"
                } else {
                    "missing"
                }
                .into()));
            }
        });
        manager
    }
    fn finish(&self, result: Result<PathBuf, String>) {
        let mut status = self.0.status.lock().unwrap();
        match result {
            Ok(root) => {
                status.stage = "ready".into();
                status.downloaded = status.total;
                status.installed = status.installed_bytes;
                status.root = Some(root.to_string_lossy().into_owned());
                status.error = None;
            }
            Err(reason) => {
                status.stage = if reason == "cancelled" {
                    "paused"
                } else if reason == "missing" {
                    "missing"
                } else {
                    "error"
                }
                .into();
                status.error = if reason == "missing" || reason == "cancelled" {
                    None
                } else {
                    Some(reason)
                };
                status.root = None;
            }
        }
    }
    fn download(&self) -> Result<PathBuf, String> {
        let client = Client::builder()
            .https_only(true)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(60))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .map_err(|_| "network")?;
        self.0
            .pack
            .install(&self.0.root, &client, &self.0.cancel, |event| {
                let mut status = self.0.status.lock().unwrap();
                match event {
                    Progress::Download(bytes) => status.downloaded = bytes,
                    Progress::Install(bytes) => {
                        if status.stage != "cancelling" {
                            status.stage = "installing".into();
                        }
                        status.installed = bytes;
                    }
                }
            })
    }
}

pub(crate) fn partial_path(destination: &Path) -> PathBuf {
    destination.with_extension(format!(
        "{}.part",
        destination
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
    ))
}

/// Resume only pinned byte ranges; activate files only after their complete SHA-256 matches.
pub(crate) fn fetch_asset(
    client: &Client,
    url: &str,
    destination: &Path,
    bytes: u64,
    expected: &str,
    cancel: &AtomicBool,
    progress: impl Fn(u64),
) -> Result<(), String> {
    let partial = partial_path(destination);
    let mut offset = fs::metadata(&partial).map_or(0, |m| m.len());
    if offset > bytes {
        fs::remove_file(&partial).map_err(|_| "storage")?;
        offset = 0;
    }
    while offset < bytes {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        let end = (offset + 8 * 1024 * 1024 - 1).min(bytes - 1);
        let mut response = client
            .get({
                let mut request_url = reqwest::Url::parse(url).map_err(|_| "network")?;
                request_url
                    .query_pairs_mut()
                    .append_pair("offset", &offset.to_string());
                request_url
            })
            .header(RANGE, format!("bytes={offset}-{end}"))
            .send()
            .map_err(|_| "network")?;
        let expected_range = format!("bytes {offset}-{end}/{bytes}");
        if response.status() != StatusCode::PARTIAL_CONTENT
            || response
                .headers()
                .get("content-range")
                .and_then(|h| h.to_str().ok())
                != Some(expected_range.as_str())
        {
            // Small Hub metadata files may be returned in full. Never append a full response.
            if !(offset == 0 && response.status() == StatusCode::OK && end + 1 == bytes) {
                return Err("range".into());
            }
        }
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&partial)
            .map_err(|_| "storage")?;
        let mut buffer = [0; 65536];
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let n = response.read(&mut buffer).map_err(|_| "network")?;
            if n == 0 {
                break;
            }
            if offset + n as u64 > end + 1 {
                return Err("range".into());
            }
            file.write_all(&buffer[..n]).map_err(|_| "storage")?;
            offset += n as u64;
            progress(offset);
        }
        file.sync_all().map_err(|_| "storage")?;
        if offset != end + 1 {
            return Err("network".into());
        }
    }
    if cancel.load(Ordering::Relaxed) {
        return Err("cancelled".into());
    }
    if digest(&partial, cancel)? != expected {
        fs::remove_file(&partial).map_err(|_| "storage")?;
        return Err("checksum".into());
    }
    // An invalid prior copy is never considered installed; replace only after verification.
    if destination.exists() {
        fs::remove_file(destination).map_err(|_| "storage")?;
    }
    fs::rename(partial, destination).map_err(|_| "storage")?;
    Ok(())
}

#[tauri::command]
pub async fn recognition_encode(
    models: tauri::State<'_, Models>,
    text: String,
) -> Result<Encoded, String> {
    if text.len() > 200_000 {
        return Err("length".into());
    }
    let manager = models.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let root = {
            let status = manager.0.status.lock().map_err(|_| "unavailable")?;
            if status.stage != "ready" {
                return Err("unavailable".into());
            }
            PathBuf::from(status.root.as_ref().ok_or("unavailable")?)
        };
        let mut tokenizer = manager.0.tokenizer.lock().map_err(|_| "unavailable")?;
        if tokenizer.is_none() {
            *tokenizer = Some(RecognitionTokenizer::load(&root).map_err(str::to_owned)?);
        }
        tokenizer
            .as_ref()
            .ok_or("unavailable")?
            .encode(&text)
            .map_err(str::to_owned)
    })
    .await
    .map_err(|_| "unavailable".to_owned())?
}

#[tauri::command]
pub fn model_status(models: tauri::State<'_, Models>) -> ModelStatus {
    models.0.status.lock().unwrap().clone()
}
#[tauri::command]
pub fn download_models(models: tauri::State<'_, Models>) -> Result<(), String> {
    {
        let mut status = models.0.status.lock().unwrap();
        if matches!(
            status.stage.as_str(),
            "checking" | "downloading" | "installing" | "cancelling" | "ready"
        ) {
            return Err("busy".into());
        }
        if status.stage != "paused" {
            status.downloaded = 0;
        }
        status.installed = 0;
        status.stage = "downloading".into();
        status.error = None;
        models.0.cancel.store(false, Ordering::Relaxed);
    }
    let manager = models.inner().clone();
    std::thread::spawn(move || {
        let result = manager.download();
        manager.finish(
            if result.is_err() && manager.0.cancel.load(Ordering::Relaxed) {
                Err("cancelled".into())
            } else {
                result
            },
        );
    });
    Ok(())
}
#[tauri::command]
pub fn cancel_model_download(models: tauri::State<'_, Models>) {
    let mut status = models.0.status.lock().unwrap();
    if matches!(status.stage.as_str(), "downloading" | "installing") {
        models.0.cancel.store(true, Ordering::Relaxed);
        status.stage = "cancelling".into();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::atomic::AtomicUsize;

    static FIXTURE_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let id = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let dir = std::env::temp_dir().join(format!(
                "offlinemask-download-{}-{id}-{sequence}",
                std::process::id()
            ));
            fs::create_dir(&dir).unwrap();
            Self(dir)
        }
        fn path(&self) -> PathBuf {
            self.0.join("model.onnx")
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn server(status: &str, headers: &str, body: &'static [u8], range: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/model", listener.local_addr().unwrap());
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\n{headers}Connection: close\r\n\r\n",
            body.len()
        );
        let range = range.to_owned();
        std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 1024];
            while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                let n = socket.read(&mut buffer).unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..n]);
            }
            assert!(String::from_utf8_lossy(&request)
                .to_lowercase()
                .contains(&format!("range: {range}")));
            socket.write_all(response.as_bytes()).unwrap();
            socket.write_all(body).unwrap();
        });
        url
    }
    fn hash(value: &[u8]) -> String {
        format!("{:x}", Sha256::digest(value))
    }
    fn client() -> Client {
        Client::builder()
            .timeout(Duration::from_secs(4))
            .build()
            .unwrap()
    }

    #[test]
    fn resumes_partial_and_only_activates_verified_bytes() {
        let fixture = Fixture::new();
        let path = fixture.path();
        fs::write(partial_path(&path), b"abc").unwrap();
        let url = server(
            "206 Partial Content",
            "Content-Range: bytes 3-5/6\r\n",
            b"def",
            "bytes=3-5",
        );
        fetch_asset(
            &client(),
            &url,
            &path,
            6,
            &hash(b"abcdef"),
            &AtomicBool::new(false),
            |_| {},
        )
        .unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"abcdef");
        assert!(!partial_path(&path).exists());
    }
    #[test]
    fn rejects_full_response_when_resuming_without_damaging_partial() {
        let fixture = Fixture::new();
        let path = fixture.path();
        fs::write(partial_path(&path), b"abc").unwrap();
        let url = server("200 OK", "", b"abcdef", "bytes=3-5");
        assert_eq!(
            fetch_asset(
                &client(),
                &url,
                &path,
                6,
                &hash(b"abcdef"),
                &AtomicBool::new(false),
                |_| {}
            ),
            Err("range".into())
        );
        assert!(!path.exists());
        assert_eq!(fs::read(partial_path(&path)).unwrap(), b"abc");
    }
    #[test]
    fn rejects_corrupt_download_and_keeps_prior_file() {
        let fixture = Fixture::new();
        let path = fixture.path();
        fs::write(&path, b"previous").unwrap();
        let url = server("200 OK", "", b"broken", "bytes=0-5");
        assert_eq!(
            fetch_asset(
                &client(),
                &url,
                &path,
                6,
                &hash(b"abcdef"),
                &AtomicBool::new(false),
                |_| {}
            ),
            Err("checksum".into())
        );
        assert_eq!(fs::read(&path).unwrap(), b"previous");
        assert!(!partial_path(&path).exists());
    }
    #[test]
    fn cancellation_preserves_partial_and_does_not_activate() {
        let fixture = Fixture::new();
        let path = fixture.path();
        let cancel = AtomicBool::new(false);
        let url = server("200 OK", "", b"abcdef", "bytes=0-5");
        assert_eq!(
            fetch_asset(&client(), &url, &path, 6, &hash(b"abcdef"), &cancel, |_| {
                cancel.store(true, Ordering::Relaxed)
            }),
            Err("cancelled".into())
        );
        assert!(!path.exists());
        assert_eq!(fs::read(partial_path(&path)).unwrap(), b"abcdef");
    }
    #[test]
    fn incomplete_install_never_exposes_a_model_root() {
        let fixture = Fixture::new();
        let manager = Models::new(fixture.0.clone());
        let deadline = std::time::Instant::now() + Duration::from_secs(3);
        loop {
            let status = manager.0.status.lock().unwrap().clone();
            if status.stage != "checking" {
                assert_eq!(status.stage, "missing");
                assert!(status.root.is_none());
                break;
            }
            assert!(std::time::Instant::now() < deadline);
            std::thread::yield_now();
        }
    }
}
