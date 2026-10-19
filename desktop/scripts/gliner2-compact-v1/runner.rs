// Developer-only JSONL harness. The publisher's model implementation is unmodified.
use std::{fs, io::{self, Write}, time::Instant};
use pii_engineer_core::{GlinerSpanModel, labels::LABELS};
use regex::Regex;
use serde_json::{json, Value};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let dir = &args[1];
    let inputs: Vec<Value> = serde_json::from_str(&fs::read_to_string(&args[2])?)?;
    let t = Instant::now();
    let model = GlinerSpanModel::load(dir)?;
    let load_ms = t.elapsed().as_secs_f64() * 1000.;
    let tokenizer = tokenizers::Tokenizer::from_file(format!("{dir}/tokenizer.json"))
        .map_err(|e| io::Error::other(e.to_string()))?;
    let word_re = Regex::new(r"\w+(?:[-_]\w+)*|\S")?;
    let labels: Vec<String> = LABELS.iter().map(|s| s.to_string()).collect();
    let mut out = io::BufWriter::new(io::stdout().lock());
    for input in inputs {
        let text = input["text"].as_str().unwrap();
        let started = Instant::now();
        let words: Vec<_> = word_re.find_iter(text).collect();
        let mut entities = Vec::new();
        let mut windows = Vec::new();
        let mut error: Option<String> = None;
        let mut start = 0;
        while start < words.len() {
            let mut end = (start + 120).min(words.len());
            let token_count;
            loop {
                let mut tokens: Vec<String> = vec!["(".into(), "[P]".into(), "entities".into(), "(".into()];
                for label in &labels { tokens.extend(["[E]".into(), label.clone()]); }
                tokens.extend([")".into(), ")".into(), "[SEP_TEXT]".into()]);
                tokens.extend(words[start..end].iter().map(|w| w.as_str().to_lowercase()));
                let encoding = tokenizer.encode(tokens, false).map_err(|e| io::Error::other(e.to_string()))?;
                if encoding.len() <= 384 { token_count = encoding.len(); break; }
                if end - start <= 25 { return Err("A minimum overlap window exceeds the token budget; refusing truncation".into()); }
                end -= 1;
            }
            let offset = words[start].start();
            let stop = words[end - 1].end();
            windows.push(json!({"byteStart":offset,"byteEnd":stop,"tokens":token_count}));
            match model.detect(&text[offset..stop], &labels) {
                Ok(found) => {
                    for e in found {
                        let s = offset + e.start;
                        let z = offset + e.end;
                        assert_eq!(&text[s..z], e.text);
                        entities.push(json!({"start":text[..s].encode_utf16().count(),
                            "end":text[..z].encode_utf16().count(),"text":e.text,
                            "label":e.label,"score":e.score}));
                    }
                },
                Err(e) => { error = Some(e.to_string()); break; }
            }
            if end == words.len() { break; }
            start = end - 24;
        }
        let row = json!({"index":input["index"],"id":input["id"],"corpus":input["corpus"],
            "entities":entities,"error":error,"windows":windows,
            "durationMs":started.elapsed().as_secs_f64()*1000.,"loadMs":load_ms});
        writeln!(out, "{row}")?;
        out.flush()?;
        eprintln!("{} {} {:.0}ms", input["index"], input["id"], started.elapsed().as_secs_f64()*1000.);
    }
    Ok(())
}
