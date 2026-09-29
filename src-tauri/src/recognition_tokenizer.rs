//! Pinned Underthesea source alignment. No input logging, persistence, or network.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{io::Read, path::Path};
use tokenizers::Tokenizer;

#[derive(Serialize)]
pub struct Encoded {
    pub ids: Vec<u32>,
    pub offsets: Vec<[usize; 2]>,
}
pub struct RecognitionTokenizer(Tokenizer);
impl RecognitionTokenizer {
    pub fn load(root: &Path) -> Result<Self, &'static str> {
        let catalog: serde_json::Value =
            serde_json::from_str(include_str!("../../scripts/release-pack-v1.json"))
                .map_err(|_| "asset")?;
        let asset = catalog["assets"]
            .as_array()
            .ok_or("asset")?
            .iter()
            .find(|a| a["directory"] == "underthesea" && a["name"] == "tokenizer.json")
            .ok_or("asset")?;
        let mut bytes = Vec::new();
        std::fs::File::open(root.join("underthesea/tokenizer.json"))
            .map_err(|_| "asset")?
            .take(2_000_001)
            .read_to_end(&mut bytes)
            .map_err(|_| "asset")?;
        if bytes.len() as u64 != asset["bytes"].as_u64().ok_or("asset")?
            || format!("{:x}", Sha256::digest(&bytes)) != asset["sha256"].as_str().ok_or("asset")?
        {
            return Err("asset");
        }
        let mut tokenizer = Tokenizer::from_bytes(bytes).map_err(|_| "asset")?;
        tokenizer.with_truncation(None).map_err(|_| "asset")?;
        tokenizer.with_padding(None);
        Ok(Self(tokenizer))
    }
    pub fn encode(&self, text: &str) -> Result<Encoded, &'static str> {
        if text.encode_utf16().count() > 50_000 {
            return Err("length");
        }
        let encoded = self.0.encode(text, false).map_err(|_| "tokenization")?;
        if encoded.get_ids().len() > 510 || !encoded.get_overflowing().is_empty() {
            return Err("length");
        }
        // Rust offsets are UTF-8 bytes; the masking UI uses UTF-16 code units.
        let mut map = vec![None; text.len() + 1];
        let mut units = 0;
        for (byte, character) in text.char_indices() {
            map[byte] = Some(units);
            units += character.len_utf16();
        }
        map[text.len()] = Some(units);
        let offsets = encoded
            .get_offsets()
            .iter()
            .map(|&(a, b)| {
                if a >= b {
                    return Err("offset");
                }
                Ok([
                    map.get(a).copied().flatten().ok_or("offset")?,
                    map.get(b).copied().flatten().ok_or("offset")?,
                ])
            })
            .collect::<Result<Vec<_>, &'static str>>()?;
        Ok(Encoded {
            ids: encoded.get_ids().to_vec(),
            offsets,
        })
    }
}
