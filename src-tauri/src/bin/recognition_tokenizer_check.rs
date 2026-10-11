//! Explicit synthetic evaluation harness; never bundled by the default app build.
//! Usage: `recognition-tokenizer-check <pack root> [model directory]`. Without a
//! directory, the first pack model that declares native offsets is used.
#[path = "../recognition_tokenizer.rs"]
mod recognition_tokenizer;
use std::io::{BufRead, Write};
fn main() {
    let run = || -> Result<(), Box<dyn std::error::Error>> {
        let root = std::env::args().nth(1).ok_or("root")?;
        let pack: serde_json::Value =
            serde_json::from_str(include_str!("../../../packs/vietnamese-pii-v1.json"))?;
        let models = pack["models"].as_array().ok_or("pack")?;
        let directory = match std::env::args().nth(2) {
            Some(directory) => directory,
            None => models
                .iter()
                .find(|m| m["offsets"] == "native")
                .and_then(|m| m["directory"].as_str())
                .ok_or("no native model")?
                .to_owned(),
        };
        if !models
            .iter()
            .any(|m| m["directory"] == directory.as_str() && m["offsets"] == "native")
        {
            return Err("model".into());
        }
        let asset = pack["assets"]
            .as_array()
            .ok_or("pack")?
            .iter()
            .find(|a| a["directory"] == directory.as_str() && a["name"] == "tokenizer.json")
            .ok_or("asset")?;
        let tokenizer = recognition_tokenizer::RecognitionTokenizer::load(
            &std::path::Path::new(&root)
                .join(&directory)
                .join("tokenizer.json"),
            asset["bytes"].as_u64().ok_or("asset")?,
            asset["sha256"].as_str().ok_or("asset")?,
        )?;
        let mut out = std::io::stdout().lock();
        for line in std::io::stdin().lock().lines() {
            let text: String = serde_json::from_str(&line?)?;
            let value = tokenizer.encode(&text)?;
            writeln!(out, "{}", serde_json::to_string(&value)?)?;
            out.flush()?;
        }
        Ok(())
    };
    if run().is_err() {
        eprintln!("Tokenizer check failed");
        std::process::exit(1);
    }
}
