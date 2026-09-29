//! Explicit synthetic evaluation harness; never bundled by the default app build.
#[path = "../recognition_tokenizer.rs"]
mod recognition_tokenizer;
use std::io::{BufRead, Write};
fn main() {
    let run = || -> Result<(), Box<dyn std::error::Error>> {
        let root = std::env::args().nth(1).ok_or("root")?;
        let tokenizer =
            recognition_tokenizer::RecognitionTokenizer::load(std::path::Path::new(&root))?;
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
