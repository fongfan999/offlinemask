//! Pinned, data-only model packs. Transport bytes and installed bytes are distinct.
//! No network operation occurs during discovery; activation is a whole-directory rename.
use crate::models::{fetch_asset, partial_path, valid};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::UNIX_EPOCH,
};

/// Written into a pack root after every file hashed correctly. It records each
/// asset's digest, size and modification time, so later launches can trust an
/// unchanged install without reading 1 GB again; any change forces a full check.
const VERIFIED_STAMP: &str = ".verified";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Pack {
    /// Stable identifier; the app-local `models/<id>` directory holds installed versions.
    pub id: String,
    /// User-facing name; the frontend owns this copy.
    pub name: String,
    pub attribution: String,
    pub models: Vec<Model>,
    pub assets: Vec<Asset>,
}
/// One token-classification model of the pack. The frontend decides how it is loaded.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Model {
    pub directory: String,
    pub source: String,
    /// ONNX graph file name without the `.onnx` extension.
    pub graph: String,
    pub offsets: Offsets,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub labels: BTreeMap<String, String>,
    /// Lowest mean token probability a span may have; the frontend drops weaker spans.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_score: Option<f64>,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Offsets {
    /// Exact offsets come from the native `tokenizers` crate (`recognition_encode`).
    Native,
    /// The frontend aligns tokenizer pieces sequentially.
    Sequential,
}
/// The installed-file catalog alone identifies a pack version on disk, so adding
/// model metadata or renaming a pack never orphans an existing installation.
#[derive(Serialize)]
struct Catalog<'a> {
    assets: &'a [Asset],
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Asset {
    pub directory: String,
    pub name: String,
    pub bytes: u64,
    pub sha256: String,
    pub transport: Transport,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Transport {
    // None is allowed in unpublished developer catalogs, never substituted with a guessed URL.
    pub url: Option<String>,
    pub bytes: u64,
    pub sha256: String,
    pub encoding: Encoding,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parts: Vec<Part>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Part {
    pub url: String,
    pub bytes: u64,
    pub sha256: String,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Encoding {
    Identity,
    Zstd,
}
pub(crate) enum Progress {
    Download(u64),
    Install(u64),
}
fn cancelled(cancel: &AtomicBool) -> Result<(), String> {
    if cancel.load(Ordering::Relaxed) {
        Err("cancelled".into())
    } else {
        Ok(())
    }
}
fn component(s: &str) -> bool {
    !s.is_empty()
        && s != "."
        && s != ".."
        && s.len() <= 128
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
}
fn hash_string(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
impl Pack {
    pub fn validate(&self) -> Result<(), String> {
        // Bound counts as well as per-file sizes, so aggregate byte arithmetic is safe.
        if !component(&self.id)
            || self.name.trim().is_empty()
            || self.attribution.trim().is_empty()
            || self.models.is_empty()
            || self.models.len() > 64
            || self.assets.is_empty()
            || self.assets.len() > 256
        {
            return Err("manifest".into());
        }
        let mut directories = BTreeSet::new();
        for m in &self.models {
            if !component(&m.directory)
                || !component(&m.graph)
                || m.source.trim().is_empty()
                || !directories.insert(&m.directory)
            {
                return Err("manifest".into());
            }
        }
        let mut paths = BTreeSet::new();
        for a in &self.assets {
            if !component(&a.directory)
                || !component(&a.name)
                || !directories.contains(&a.directory)
                || !paths.insert((&a.directory, &a.name))
                || a.name == "LICENSE"
                || !hash_string(&a.sha256)
                || !hash_string(&a.transport.sha256)
                || a.bytes == 0
                || a.transport.bytes == 0
                || a.bytes > 8 * 1024 * 1024 * 1024
                || a.transport.bytes > 8 * 1024 * 1024 * 1024
                || a.transport.parts.len() > 256
            {
                return Err("manifest".into());
            }
            let mut part_bytes = 0_u64;
            for part in &a.transport.parts {
                if part.bytes == 0 || !hash_string(&part.sha256) {
                    return Err("manifest".into());
                }
                part_bytes = part_bytes.checked_add(part.bytes).ok_or("manifest")?;
            }
            if !a.transport.parts.is_empty()
                && (part_bytes != a.transport.bytes || a.transport.url.is_some())
            {
                return Err("manifest".into());
            }
            for url in a
                .transport
                .url
                .iter()
                .chain(a.transport.parts.iter().map(|p| &p.url))
            {
                let url = reqwest::Url::parse(url).map_err(|_| "manifest")?;
                if url.scheme() != "https"
                    || url.host_str().is_none()
                    || !url.username().is_empty()
                    || url.password().is_some()
                    || url.fragment().is_some()
                {
                    return Err("manifest".into());
                }
            }
            if matches!(a.transport.encoding, Encoding::Identity)
                && (a.bytes != a.transport.bytes || a.sha256 != a.transport.sha256)
            {
                return Err("manifest".into());
            }
        }
        for m in &self.models {
            if !paths.contains(&(&m.directory, &format!("{}.onnx", m.graph))) {
                return Err("manifest".into());
            }
        }
        self.installed_bytes()
            .checked_add(self.download_bytes())
            .ok_or("manifest")?;
        Ok(())
    }
    /// Content fingerprint of the installed files; names the on-disk version directory.
    pub fn fingerprint(&self) -> String {
        let catalog = Catalog {
            assets: &self.assets,
        };
        format!(
            "{:x}",
            Sha256::digest(serde_json::to_vec(&catalog).expect("serializable pack"))
        )
    }
    /// The model whose exact offsets the native tokenizer must supply, by directory.
    pub fn native_model(&self, directory: &str) -> Option<&Model> {
        self.models
            .iter()
            .find(|m| m.directory == directory && m.offsets == Offsets::Native)
    }
    pub fn asset(&self, directory: &str, name: &str) -> Option<&Asset> {
        self.assets
            .iter()
            .find(|a| a.directory == directory && a.name == name)
    }
    pub fn installed_bytes(&self) -> u64 {
        self.assets.iter().map(|a| a.bytes).sum()
    }
    pub fn download_bytes(&self) -> u64 {
        self.assets.iter().map(|a| a.transport.bytes).sum()
    }
    pub fn release_root(&self, base: &Path) -> PathBuf {
        base.join("packs").join(self.fingerprint())
    }
    fn cache_root(&self, base: &Path) -> PathBuf {
        base.join("downloads").join(self.fingerprint())
    }
    /// Metadata of every asset in `root`, or `None` when any is missing or the wrong size.
    fn stamp(&self, root: &Path) -> Option<String> {
        let mut stamp = String::new();
        for a in &self.assets {
            let metadata = fs::metadata(root.join(&a.directory).join(&a.name)).ok()?;
            if metadata.len() != a.bytes {
                return None;
            }
            let modified = metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok()?;
            stamp += &format!(
                "{} {}/{} {} {}\n",
                a.sha256,
                a.directory,
                a.name,
                a.bytes,
                modified.as_nanos()
            );
        }
        Some(stamp)
    }
    pub fn installed(&self, root: &Path, cancel: &AtomicBool) -> bool {
        let Some(stamp) = self.stamp(root) else {
            return false;
        };
        let marker = root.join(VERIFIED_STAMP);
        if fs::read_to_string(&marker).is_ok_and(|recorded| recorded == stamp) {
            return true;
        }
        let verified = self.assets.iter().all(|a| {
            valid(
                &root.join(&a.directory).join(&a.name),
                a.bytes,
                &a.sha256,
                cancel,
            )
        });
        if verified {
            // Best effort: without the stamp the next launch simply hashes again.
            let _ = fs::write(marker, stamp);
        }
        verified
    }
    pub fn discovered_root(&self, base: &Path, cancel: &AtomicBool) -> Option<PathBuf> {
        let root = self.release_root(base);
        if self.installed(&root, cancel) {
            Some(root)
        }
        // Existing development installations remain usable without moving their files.
        else if self.installed(base, cancel) {
            Some(base.to_path_buf())
        } else {
            None
        }
    }
    /// Bytes already in the download cache, for progress display only. Sizes are
    /// enough here: `install` verifies every cached file's digest before using it.
    pub fn cached_bytes(&self, base: &Path) -> u64 {
        let cache = self.cache_root(base);
        let present = |digest: &str, bytes: u64| {
            let path = cache.join(digest);
            if fs::metadata(&path).is_ok_and(|m| m.len() == bytes) {
                bytes
            } else {
                fs::metadata(partial_path(&path)).map_or(0, |m| m.len().min(bytes))
            }
        };
        self.assets
            .iter()
            .map(|a| {
                let complete = present(&a.transport.sha256, a.transport.bytes);
                if complete == a.transport.bytes || a.transport.parts.is_empty() {
                    complete
                } else {
                    a.transport
                        .parts
                        .iter()
                        .map(|part| present(&part.sha256, part.bytes))
                        .sum()
                }
            })
            .sum()
    }
    /// The caller serializes runs. Only a complete pack is exposed to inference.
    pub fn install(
        &self,
        base: &Path,
        client: &Client,
        cancel: &AtomicBool,
        progress: impl Fn(Progress),
    ) -> Result<PathBuf, String> {
        self.validate()?;
        cancelled(cancel)?;
        if let Some(root) = self.discovered_root(base, cancel) {
            return Ok(root);
        }
        fs::create_dir_all(base).map_err(|_| "storage")?;
        // Already installed previous versions are reflected in current free space.
        // Include cache, full staging and a small metadata margin; conservative on resume.
        let required = self
            .installed_bytes()
            .checked_add(self.download_bytes().checked_mul(2).ok_or("storage")?)
            .and_then(|n| n.checked_add(16 * 1024 * 1024))
            .ok_or("storage")?;
        ensure_space(required, fs2::available_space(base).map_err(|_| "storage")?)?;
        let cache = self.cache_root(base);
        fs::create_dir_all(&cache).map_err(|_| "storage")?;
        let mut downloaded = 0;
        for a in &self.assets {
            cancelled(cancel)?;
            let target = cache.join(&a.transport.sha256);
            if !valid(&target, a.transport.bytes, &a.transport.sha256, cancel) {
                if a.transport.parts.is_empty() {
                    let url = a.transport.url.as_deref().ok_or("unavailable")?;
                    fetch_asset(
                        client,
                        url,
                        &target,
                        a.transport.bytes,
                        &a.transport.sha256,
                        cancel,
                        |bytes| progress(Progress::Download(downloaded + bytes)),
                    )?;
                } else {
                    let mut completed_parts = 0;
                    for part in &a.transport.parts {
                        let path = cache.join(&part.sha256);
                        if !valid(&path, part.bytes, &part.sha256, cancel) {
                            fetch_asset(
                                client,
                                &part.url,
                                &path,
                                part.bytes,
                                &part.sha256,
                                cancel,
                                |bytes| {
                                    progress(Progress::Download(
                                        downloaded + completed_parts + bytes,
                                    ))
                                },
                            )?;
                        }
                        completed_parts += part.bytes;
                        progress(Progress::Download(downloaded + completed_parts));
                    }
                    join_parts(&cache, &target, &a.transport, cancel)?;
                }
            }
            downloaded += a.transport.bytes;
            progress(Progress::Download(downloaded));
        }
        progress(Progress::Install(0));
        let staging = base.join("staging").join(self.fingerprint());
        let mut installed = 0;
        for a in &self.assets {
            cancelled(cancel)?;
            let target = staging.join(&a.directory).join(&a.name);
            if !valid(&target, a.bytes, &a.sha256, cancel) {
                fs::create_dir_all(target.parent().ok_or("storage")?).map_err(|_| "storage")?;
                extract(
                    &cache.join(&a.transport.sha256),
                    &target,
                    a,
                    cancel,
                    |bytes| progress(Progress::Install(installed + bytes)),
                )?;
            }
            installed += a.bytes;
            progress(Progress::Install(installed));
        }
        for directory in self
            .assets
            .iter()
            .map(|a| &a.directory)
            .collect::<BTreeSet<_>>()
        {
            let mut license =
                File::create(staging.join(directory).join("LICENSE")).map_err(|_| "storage")?;
            license
                .write_all(include_bytes!("../../docs/licenses/models-Apache-2.0.txt"))
                .map_err(|_| "storage")?;
            license.sync_all().map_err(|_| "storage")?;
        }
        if !self.installed(&staging, cancel) {
            cancelled(cancel)?;
            return Err("checksum".into());
        }
        cancelled(cancel)?;
        let destination = self.release_root(base);
        fs::create_dir_all(destination.parent().ok_or("storage")?).map_err(|_| "storage")?;
        // A damaged copy of this same immutable version is not an active valid pack.
        // Never remove other version directories or the existing legacy installation.
        if destination.exists() {
            fs::remove_dir_all(&destination).map_err(|_| "storage")?;
        }
        fs::rename(&staging, &destination).map_err(|_| "storage")?;
        // Publication is the commit point; a late pause must not hide an activated pack.
        let _ = fs::remove_dir_all(cache);
        Ok(destination)
    }
}
fn ensure_space(required: u64, available: u64) -> Result<(), String> {
    if available < required {
        Err("space".into())
    } else {
        Ok(())
    }
}
fn extract(
    input: &Path,
    destination: &Path,
    asset: &Asset,
    cancel: &AtomicBool,
    progress: impl Fn(u64),
) -> Result<(), String> {
    // A frame checksum alone does not authenticate output. Verify pinned input AND output.
    if !valid(
        input,
        asset.transport.bytes,
        &asset.transport.sha256,
        cancel,
    ) {
        cancelled(cancel)?;
        return Err("checksum".into());
    }
    let temporary = destination.with_extension(format!(
        "{}.unpacking",
        destination
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
    ));
    let result = (|| {
        let source = File::open(input).map_err(|_| "storage")?;
        let mut reader: Box<dyn Read> = match asset.transport.encoding {
            Encoding::Identity => Box::new(source),
            Encoding::Zstd => {
                let mut decoder =
                    zstd::stream::read::Decoder::new(source).map_err(|_| "archive")?;
                decoder.window_log_max(27).map_err(|_| "archive")?; // 128 MiB decoder window ceiling.
                Box::new(decoder)
            }
        };
        let mut output = File::create(&temporary).map_err(|_| "storage")?;
        let mut hash = Sha256::new();
        let mut written = 0_u64;
        let mut buffer = [0_u8; 65536];
        loop {
            cancelled(cancel)?;
            let count = reader.read(&mut buffer).map_err(|_| "archive")?;
            if count == 0 {
                break;
            }
            written = written.checked_add(count as u64).ok_or("archive")?;
            if written > asset.bytes {
                return Err("archive".into());
            }
            output.write_all(&buffer[..count]).map_err(|_| "storage")?;
            hash.update(&buffer[..count]);
            progress(written);
        }
        if written != asset.bytes || format!("{:x}", hash.finalize()) != asset.sha256 {
            return Err("checksum".into());
        }
        output.sync_all().map_err(|_| "storage")?;
        drop(output);
        cancelled(cancel)?;
        if destination.exists() {
            fs::remove_file(destination).map_err(|_| "storage")?;
        }
        fs::rename(&temporary, destination).map_err(|_| "storage")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

fn join_parts(
    cache: &Path,
    target: &Path,
    transport: &Transport,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let temporary = target.with_extension("joining");
    let result = (|| {
        let mut output = File::create(&temporary).map_err(|_| "storage")?;
        let mut hash = Sha256::new();
        let mut total = 0_u64;
        let mut buffer = [0_u8; 65536];
        for part in &transport.parts {
            let path = cache.join(&part.sha256);
            if !valid(&path, part.bytes, &part.sha256, cancel) {
                cancelled(cancel)?;
                return Err("checksum".into());
            }
            let mut input = File::open(path).map_err(|_| "storage")?;
            loop {
                cancelled(cancel)?;
                let n = input.read(&mut buffer).map_err(|_| "storage")?;
                if n == 0 {
                    break;
                }
                total += n as u64;
                if total > transport.bytes {
                    return Err("checksum".into());
                }
                output.write_all(&buffer[..n]).map_err(|_| "storage")?;
                hash.update(&buffer[..n]);
            }
        }
        if total != transport.bytes || format!("{:x}", hash.finalize()) != transport.sha256 {
            return Err("checksum".into());
        }
        output.sync_all().map_err(|_| "storage")?;
        drop(output);
        cancelled(cancel)?;
        if target.exists() {
            fs::remove_file(target).map_err(|_| "storage")?;
        }
        fs::rename(&temporary, target).map_err(|_| "storage")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "offlinemask-pack-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn hash(data: &[u8]) -> String {
        format!("{:x}", Sha256::digest(data))
    }
    /// A one-model developer pack whose graph is `test-model/model.onnx`.
    fn pack(assets: Vec<Asset>) -> Pack {
        Pack {
            id: "test-pack".into(),
            name: "Test pack".into(),
            attribution: "Synthetic".into(),
            models: vec![Model {
                directory: "test-model".into(),
                source: "Test model".into(),
                graph: "model".into(),
                offsets: Offsets::Sequential,
                labels: BTreeMap::new(),
                min_score: None,
            }],
            assets,
        }
    }
    fn shipping_pack() -> Pack {
        serde_json::from_str(include_str!("../../packs/vietnamese-pii-v1.json")).unwrap()
    }
    fn asset(data: &[u8], name: &str) -> (Asset, Vec<u8>) {
        let compressed = zstd::stream::encode_all(data, 3).unwrap();
        (
            Asset {
                directory: "test-model".into(),
                name: name.into(),
                bytes: data.len() as u64,
                sha256: hash(data),
                transport: Transport {
                    url: None,
                    bytes: compressed.len() as u64,
                    sha256: hash(&compressed),
                    encoding: Encoding::Zstd,
                    parts: vec![],
                },
            },
            compressed,
        )
    }
    fn cached(pack: &Pack, base: &Path, asset: &Asset, bytes: &[u8]) {
        fs::create_dir_all(pack.cache_root(base)).unwrap();
        fs::write(pack.cache_root(base).join(&asset.transport.sha256), bytes).unwrap();
    }
    #[test]
    fn complete_cached_pack_activates_atomically_and_keeps_previous_version() {
        let f = Fixture::new();
        let (a, a_bytes) = asset(b"model bytes", "model.onnx");
        let (b, b_bytes) = asset(b"tokenizer bytes", "tokenizer.json");
        let pack = pack(vec![a.clone(), b.clone()]);
        fs::create_dir_all(f.0.join("packs/previous")).unwrap();
        fs::write(f.0.join("packs/previous/keep"), b"previous").unwrap();
        cached(&pack, &f.0, &a, &a_bytes);
        cached(&pack, &f.0, &b, &b_bytes);
        let cancel = AtomicBool::new(false);
        let root = pack
            .install(&f.0, &Client::new(), &cancel, |_| {
                assert!(!pack.release_root(&f.0).exists());
            })
            .unwrap();
        assert!(pack.installed(&root, &cancel));
        assert!(root.join("test-model/LICENSE").exists());
        assert!(!pack.cache_root(&f.0).exists());
        assert_eq!(
            fs::read(f.0.join("packs/previous/keep")).unwrap(),
            b"previous"
        );
        assert_eq!(pack.discovered_root(&f.0, &cancel), Some(root));
    }
    #[test]
    fn interrupted_extraction_resumes_from_verified_cache() {
        let f = Fixture::new();
        let (a, bytes) = asset(&vec![42; 200_000], "model.onnx");
        let pack = pack(vec![a.clone()]);
        cached(&pack, &f.0, &a, &bytes);
        let cancel = AtomicBool::new(false);
        assert_eq!(
            pack.install(&f.0, &Client::new(), &cancel, |p| {
                if matches!(p, Progress::Install(n) if n > 0) {
                    cancel.store(true, Ordering::Relaxed);
                }
            }),
            Err("cancelled".into())
        );
        assert!(!pack.release_root(&f.0).exists());
        assert!(pack.cache_root(&f.0).join(&a.transport.sha256).exists());
        cancel.store(false, Ordering::Relaxed);
        assert_eq!(pack.cached_bytes(&f.0), pack.download_bytes());
        let root = pack.install(&f.0, &Client::new(), &cancel, |_| {}).unwrap();
        assert!(pack.installed(&root, &cancel));
    }
    #[test]
    fn rejects_damaged_truncated_wrong_output_and_oversized_archives() {
        for scenario in 0..4 {
            let f = Fixture::new();
            let (mut a, mut bytes) = asset(&vec![42; 200_000], "model.onnx");
            match scenario {
                0 => bytes[0] ^= 1,
                1 => {
                    bytes.truncate(bytes.len() - 2);
                    a.transport.bytes = bytes.len() as u64;
                    a.transport.sha256 = hash(&bytes);
                }
                2 => a.sha256 = hash(b"wrong"),
                _ => a.bytes = 1,
            }
            let source = f.0.join("source");
            let output = f.0.join("model.onnx");
            fs::write(&source, bytes).unwrap();
            fs::write(&output, b"previous").unwrap();
            assert!(extract(&source, &output, &a, &AtomicBool::new(false), |_| {}).is_err());
            assert_eq!(fs::read(&output).unwrap(), b"previous");
            assert!(!output.with_extension("onnx.unpacking").exists());
        }
    }
    #[test]
    fn failed_second_asset_never_publishes_partial_pack() {
        let f = Fixture::new();
        let (a, aa) = asset(b"model", "model.onnx");
        let (mut b, bb) = asset(b"tokenizer", "tokenizer.json");
        b.sha256 = hash(b"wrong output");
        let pack = pack(vec![a.clone(), b.clone()]);
        cached(&pack, &f.0, &a, &aa);
        cached(&pack, &f.0, &b, &bb);
        assert_eq!(
            pack.install(&f.0, &Client::new(), &AtomicBool::new(false), |_| {}),
            Err("checksum".into())
        );
        assert!(!pack.release_root(&f.0).exists());
        assert!(f
            .0
            .join("staging")
            .join(pack.fingerprint())
            .join("test-model/model.onnx")
            .exists());
        assert!(pack.cache_root(&f.0).join(&b.transport.sha256).exists());
    }
    #[test]
    fn multipart_reassembly_checks_order_and_content() {
        let f = Fixture::new();
        let (a, bytes) = asset(b"model graph content", "model.onnx");
        let mut transport = a.transport;
        for chunk in bytes.chunks(8) {
            let digest = hash(chunk);
            fs::write(f.0.join(&digest), chunk).unwrap();
            transport.parts.push(Part {
                url: format!("https://example.com/{digest}"),
                bytes: chunk.len() as u64,
                sha256: digest,
            });
        }
        let output = f.0.join("joined");
        join_parts(&f.0, &output, &transport, &AtomicBool::new(false)).unwrap();
        assert_eq!(fs::read(&output).unwrap(), bytes);
        transport.parts.reverse();
        assert_eq!(
            join_parts(&f.0, &output, &transport, &AtomicBool::new(false)),
            Err("checksum".into())
        );
        assert_eq!(fs::read(&output).unwrap(), bytes);
        assert!(!output.with_extension("joining").exists());
    }
    #[test]
    fn validates_paths_counts_urls_and_space() {
        let (a, _) = asset(b"model", "model.onnx");
        for scenario in 0..6 {
            let mut invalid = a.clone();
            match scenario {
                0 => invalid.directory = "../outside".into(),
                1 => invalid.name = "/absolute".into(),
                2 => invalid.transport.url = Some("http://example.com/file".into()),
                3 => invalid.transport.url = Some("https://user:password@example.com/file".into()),
                4 => invalid.transport.encoding = Encoding::Identity,
                _ => invalid.bytes = u64::MAX,
            }
            assert!(pack(vec![invalid]).validate().is_err());
        }
        assert!(pack(vec![a.clone(), a.clone()]).validate().is_err());
        assert!(pack(vec![a.clone(); 257]).validate().is_err());
        assert!(pack(vec![a.clone()]).validate().is_ok());
        assert_eq!(ensure_space(100, 99), Err("space".into()));
        assert!(ensure_space(100, 100).is_ok());
    }
    #[test]
    fn validates_model_entries_against_the_catalog() {
        let (a, _) = asset(b"model", "model.onnx");
        let (other, _) = asset(b"other", "model.onnx");
        let mut orphan = other.clone();
        orphan.directory = "unlisted".into();
        assert!(pack(vec![a.clone(), orphan]).validate().is_err());
        let mut missing_graph = pack(vec![a.clone()]);
        missing_graph.models[0].graph = "absent".into();
        assert!(missing_graph.validate().is_err());
        let mut duplicate = pack(vec![a.clone()]);
        duplicate.models.push(duplicate.models[0].clone());
        assert!(duplicate.validate().is_err());
        let mut unsafe_id = pack(vec![a.clone()]);
        unsafe_id.id = "../elsewhere".into();
        assert!(unsafe_id.validate().is_err());
        let mut no_models = pack(vec![a]);
        no_models.models.clear();
        assert!(no_models.validate().is_err());
    }
    #[test]
    fn shipping_pack_is_valid_and_keeps_its_installed_fingerprint() {
        let pack = shipping_pack();
        pack.validate().unwrap();
        assert_eq!(pack.id, "vietnamese-pii-v1");
        // Installed before model metadata joined the manifest; must stay discoverable.
        assert_eq!(
            pack.fingerprint(),
            "65245d3fd3cb14042784f0b6b1da08f4551a2aa32ccd972a3830103af457f390"
        );
        assert!(pack.native_model("underthesea").is_some());
        assert!(pack.native_model("vietnamese-pii-multilingual").is_none());
        assert!(pack.asset("underthesea", "tokenizer.json").is_some());
    }
    #[test]
    fn recognizes_verified_legacy_install_without_network() {
        let f = Fixture::new();
        let (a, _) = asset(b"model", "model.onnx");
        fs::create_dir(f.0.join("test-model")).unwrap();
        fs::write(f.0.join("test-model/model.onnx"), b"model").unwrap();
        let pack = pack(vec![a]);
        assert_eq!(
            pack.discovered_root(&f.0, &AtomicBool::new(false)),
            Some(f.0.clone())
        );
        assert_eq!(
            pack.install(&f.0, &Client::new(), &AtomicBool::new(false), |_| {}),
            Ok(f.0.clone())
        );
    }
    #[test]
    fn verified_install_is_trusted_until_its_files_change() {
        let f = Fixture::new();
        let (a, _) = asset(b"model", "model.onnx");
        let file = f.0.join("test-model/model.onnx");
        fs::create_dir(f.0.join("test-model")).unwrap();
        fs::write(&file, b"model").unwrap();
        let pack = pack(vec![a]);
        let cancel = AtomicBool::new(false);
        assert!(pack.installed(&f.0, &cancel));
        assert!(f.0.join(VERIFIED_STAMP).exists());
        let modified = fs::metadata(&file).unwrap().modified().unwrap();
        // Same size and time: the stamp answers without hashing.
        fs::write(&file, b"MODEL").unwrap();
        File::options()
            .write(true)
            .open(&file)
            .unwrap()
            .set_modified(modified)
            .unwrap();
        assert!(pack.installed(&f.0, &cancel));
        // A changed time forces the full check, which rejects the content.
        File::options()
            .write(true)
            .open(&file)
            .unwrap()
            .set_modified(modified + std::time::Duration::from_secs(1))
            .unwrap();
        assert!(!pack.installed(&f.0, &cancel));
    }
    #[test]
    #[ignore = "downloads 712 MB from the owner-authorized public R2 bucket; explicit developer check"]
    fn public_release_pack_installs_from_r2() {
        let f = Fixture::new();
        let pack = shipping_pack();
        let client = Client::builder()
            .https_only(true)
            .connect_timeout(std::time::Duration::from_secs(15))
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap();
        let cancel = AtomicBool::new(false);
        let root = pack.install(&f.0, &client, &cancel, |_| {}).unwrap();
        assert!(pack.installed(&root, &cancel));
        assert!(!pack.cache_root(&f.0).exists());
    }
    #[test]
    #[ignore = "uses local prepared 712 MB release objects; explicit developer check"]
    fn actual_release_pack_round_trip() {
        let f = Fixture::new();
        let pack = shipping_pack();
        pack.validate().unwrap();
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../artifacts/r2-v1-upload");
        fs::create_dir_all(pack.cache_root(&f.0)).unwrap();
        for a in &pack.assets {
            let hashes: Vec<&str> = if a.transport.parts.is_empty() {
                vec![&a.transport.sha256]
            } else {
                a.transport
                    .parts
                    .iter()
                    .map(|p| p.sha256.as_str())
                    .collect()
            };
            for digest in hashes {
                fs::hard_link(
                    source.join(format!("{digest}.zst")),
                    pack.cache_root(&f.0).join(digest),
                )
                .unwrap();
            }
        }
        let root = pack
            .install(&f.0, &Client::new(), &AtomicBool::new(false), |_| {})
            .unwrap();
        assert!(pack.installed(&root, &AtomicBool::new(false)));
        assert_eq!(pack.download_bytes(), 712_190_910);
        assert_eq!(pack.installed_bytes(), 1_137_855_937);
    }
}
