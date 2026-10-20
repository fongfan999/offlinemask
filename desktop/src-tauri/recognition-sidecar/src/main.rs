//! Feature-gated recognition child for isolated desktop qualification. No network or UI.
//! Token IDs arrive over bounded stdin frames; only logits leave over stdout.
//! Normal builds do not bundle it. The opt-in sidecar backend owns its lifetime.
use ort::{session::Session, value::Tensor};
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::File,
    io::{self, BufRead, Read, Write},
    path::{Path, PathBuf},
};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
#[derive(Deserialize)]
struct Manifest {
    models: Vec<Model>,
    assets: Vec<Asset>,
}
#[derive(Deserialize)]
struct Model {
    directory: String,
    graph: String,
}
#[derive(Deserialize)]
struct Asset {
    directory: String,
    name: String,
    sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    id: u32,
    model: usize,
    input_ids: Option<Vec<i64>>,
}
#[derive(Deserialize)]
struct Config {
    vocab_size: i64,
    id2label: BTreeMap<String, String>,
}

fn validate_ids(ids: &[i64], vocab_size: i64) -> Result<()> {
    if !(2..=384).contains(&ids.len()) || ids.iter().any(|id| *id < 0 || *id >= vocab_size) {
        return Err("Invalid input".into());
    }
    Ok(())
}
fn verify(path: &Path, expected: &str) -> Result<()> {
    let mut file = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != expected {
        return Err("Invalid model asset".into());
    }
    Ok(())
}
fn run() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let runtime = args.next().ok_or("Local runtime path required")?;
    let root = PathBuf::from(args.next().ok_or("Local model root required")?);
    let threads: usize = args.next().ok_or("Thread count required")?.parse()?;
    if args.next().is_some() || !(1..=8).contains(&threads) {
        return Err("Invalid arguments".into());
    }
    // Explicit local path only. Runtime provenance/hash is checked by the launcher.
    if !Path::new(&runtime).is_file() {
        return Err("Local runtime missing".into());
    }
    // Keep pipe liveness separate from inference: parent death or shutdown must
    // stop even a hung graph. The host keeps stdin open while awaiting replies.
    let (frames, requests) = std::sync::mpsc::sync_channel(1);
    std::thread::spawn(move || {
        let mut stdin = io::stdin().lock();
        loop {
            let mut frame = Vec::new();
            if (&mut stdin)
                .take(16385)
                .read_until(b'\n', &mut frame)
                .is_err()
            {
                std::process::exit(1);
            }
            if frame.is_empty() {
                std::process::exit(0);
            }
            if frame.len() > 16384 || !frame.ends_with(b"\n") {
                std::process::exit(1);
            }
            if frames.send(frame).is_err() {
                return;
            }
        }
    });
    ort::init_from(runtime).with_telemetry(false).commit()?;
    let manifest: Manifest =
        serde_json::from_str(include_str!("../../../packs/vietnamese-pii-v1.json"))?;
    let mut sessions: Vec<Option<(Session, Config)>> =
        (0..manifest.models.len()).map(|_| None).collect();
    let mut stdout = io::stdout().lock();
    for frame in requests {
        let request: Request = serde_json::from_slice(&frame)?;
        let result = (|| -> Result<serde_json::Value> {
            let model = manifest.models.get(request.model).ok_or("Invalid model")?;
            let directory = &model.directory;
            if sessions[request.model].is_none() {
                for asset in manifest.assets.iter().filter(|a| &a.directory == directory) {
                    verify(&root.join(directory).join(&asset.name), &asset.sha256)?;
                }
                let config: Config =
                    serde_json::from_reader(File::open(root.join(directory).join("config.json"))?)?;
                let session = Session::builder()?
                    .with_log_level(ort::logging::LogLevel::Fatal)?
                    .with_intra_threads(threads)?
                    .commit_from_file(root.join(directory).join(format!("{}.onnx", model.graph)))?;
                sessions[request.model] = Some((session, config));
            }
            let (session, config) = sessions[request.model]
                .as_mut()
                .ok_or("Model unavailable")?;
            let Some(ids) = request.input_ids else {
                return Ok(json!({"ready":true,"labels":config.id2label}));
            };
            validate_ids(&ids, config.vocab_size)?;
            let shape = [1usize, ids.len()];
            let mut inputs = Vec::new();
            for input in &session.inputs {
                let data = match input.name.as_str() {
                    "input_ids" => ids.clone(),
                    "attention_mask" => vec![1; ids.len()],
                    "token_type_ids" => vec![0; ids.len()],
                    _ => return Err("Unsupported input".into()),
                };
                inputs.push((
                    input.name.clone(),
                    Tensor::from_array((shape, data))?.into_dyn(),
                ));
            }
            let outputs = session.run(inputs)?;
            let (dims, data) = outputs
                .get("logits")
                .ok_or("Missing logits")?
                .try_extract_tensor::<f32>()?;
            if dims.as_ref() != [1, ids.len() as i64, config.id2label.len() as i64]
                || data.iter().any(|x| !x.is_finite())
            {
                return Err("Invalid output".into());
            }
            Ok(json!({"dims":dims.as_ref(),"data":data}))
        })();
        let response = match result {
            Ok(value) => json!({"id":request.id,"result":value}),
            Err(_) => json!({"id":request.id,"error":"Native inference failed"}),
        };
        serde_json::to_writer(&mut stdout, &response)?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }
    Ok(())
}
fn main() {
    // Never print provider errors, requests, token IDs, or source content.
    if run().is_err() {
        eprintln!("Native prototype failed");
        std::process::exit(1);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounds_reject_empty_oversized_and_out_of_vocabulary_input() {
        assert!(validate_ids(&[0, 1], 10).is_ok());
        for ids in [vec![], vec![0], vec![0; 385], vec![-1, 0], vec![0, 10]] {
            assert!(validate_ids(&ids, 10).is_err());
        }
    }
    #[test]
    fn protocol_rejects_unknown_fields_and_paths() {
        assert!(
            serde_json::from_str::<Request>(r#"{"id":1,"model":0,"path":"elsewhere"}"#).is_err()
        );
        assert!(
            serde_json::from_str::<Request>(r#"{"id":1,"model":0,"input_ids":[1.5]}"#).is_err()
        );
    }
}
