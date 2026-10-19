//! Exact source offsets from a pinned Hugging Face `tokenizer.json`.
//! No input logging, persistence, or network.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{io::Read, path::Path};
use tokenizers::Tokenizer;

#[derive(Serialize)]
pub struct Encoded {
    pub ids: Vec<u32>,
    pub offsets: Vec<[usize; 2]>,
}
/// Tokenizer files larger than this are not a pinned pack asset.
const TOKENIZER_LIMIT: u64 = 64 * 1024 * 1024;
pub struct RecognitionTokenizer(Tokenizer);
impl RecognitionTokenizer {
    /// Load `tokenizer.json` only when it has exactly the pinned size and SHA-256.
    pub fn load(
        path: &Path,
        expected_bytes: u64,
        expected_sha256: &str,
    ) -> Result<Self, &'static str> {
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .map_err(|_| "asset")?
            .take(TOKENIZER_LIMIT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "asset")?;
        if bytes.len() as u64 != expected_bytes
            || format!("{:x}", Sha256::digest(&bytes)) != expected_sha256
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
