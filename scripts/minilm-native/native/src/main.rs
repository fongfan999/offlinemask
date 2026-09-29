//! Developer-only protocol harness. The shipping app neither starts nor bundles it.
use offlinemask_minilm_tokenizer_prototype::LocalTokenizer;
use serde::Deserialize;
use serde_json::json;
use std::{
    io::{self, BufRead, Read, Write},
    path::Path,
    time::Instant,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    id: u32,
    text: String,
    inference: bool,
}
const MAX_FRAME: u64 = 400_000;
fn run() -> Result<(), ()> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 1 {
        return Err(());
    }
    let start = Instant::now();
    let tokenizer = LocalTokenizer::load(Path::new(&args[0])).map_err(|_| ())?;
    let mut output = io::stdout().lock();
    writeln!(
        output,
        "{}",
        json!({"ready":true,"loadMs":start.elapsed().as_secs_f64()*1000.0})
    )
    .map_err(|_| ())?;
    output.flush().map_err(|_| ())?;
    let mut input = io::stdin().lock();
    loop {
        let mut frame = Vec::new();
        (&mut input)
            .take(MAX_FRAME + 1)
            .read_until(b'\n', &mut frame)
            .map_err(|_| ())?;
        if frame.is_empty() {
            break;
        }
        if frame.len() as u64 > MAX_FRAME || !frame.ends_with(b"\n") {
            return Err(());
        }
        let request: Request = serde_json::from_slice(&frame).map_err(|_| ())?;
        let start = Instant::now();
        let response = match tokenizer.encode(&request.text, request.inference) {
            Ok(encoding) => {
                json!({"id":request.id,"encoding":encoding,"durationMs":start.elapsed().as_secs_f64()*1000.0})
            }
            Err(error) => json!({"id":request.id,"error":format!("{error:?}")}),
        };
        writeln!(output, "{response}").map_err(|_| ())?;
        output.flush().map_err(|_| ())?;
    }
    Ok(())
}
fn main() {
    if run().is_err() {
        // Never echo source text, filesystem paths or parser diagnostics.
        eprintln!("Tokenizer request failed");
        std::process::exit(1);
    }
}
