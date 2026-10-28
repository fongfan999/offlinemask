//! Explicit evaluation harness; never bundled by the default app build. Reads one JSON
//! object per line, `{"path": …, "width": …, "height": …}` for a PNG or JPEG file and
//! its size in pixels, and prints the lines the app's own text recognition finds in it
//! (decision 0171), one JSON object per input line.
use std::io::{BufRead, Write};
#[derive(serde::Deserialize)]
struct Picture {
    path: String,
    width: u32,
    height: u32,
}
fn main() {
    let run = || -> Result<(), Box<dyn std::error::Error>> {
        let mut out = std::io::stdout().lock();
        for line in std::io::stdin().lock().lines() {
            let picture: Picture = serde_json::from_str(&line?)?;
            let image = std::fs::read(&picture.path)?;
            let page = offlinemask_lib::ocr::recognize(&image, picture.width, picture.height)?;
            writeln!(out, "{}", serde_json::to_string(&page)?)?;
            out.flush()?;
        }
        Ok(())
    };
    if !offlinemask_lib::ocr::available() {
        eprintln!("Text recognition is not available on this machine");
        std::process::exit(2);
    }
    if run().is_err() {
        eprintln!("Text recognition failed");
        std::process::exit(1);
    }
}
