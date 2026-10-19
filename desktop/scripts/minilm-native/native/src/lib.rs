//! Local-only MiniLM tokenizer prototype. No network, persistence or inference.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::Path;
use tokenizers::Tokenizer;
use unicode_normalization::UnicodeNormalization;
use unicode_segmentation::UnicodeSegmentation;

pub const MAX_SOURCE_UNITS: usize = 50_000;
pub const MAX_MODEL_TOKENS: usize = 384;
const TOKENIZER_SHA256: &str = "b74659c780d49afad7a7b9799868f75cbd3014fb6c34956e85a793028d38094a";
const MAX_TOKENIZER_BYTES: u64 = 20_000_000;

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Asset,
    SourceTooLong,
    Tokenization,
    SourceMapping,
    TokenBudget,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Encoded {
    pub ids: Vec<u32>,
    pub attention_mask: Vec<u32>,
    pub type_ids: Vec<u32>,
    pub special_mask: Vec<u32>,
    pub offsets: Vec<Option<[usize; 2]>>,
    /// Source spans for replacement, excluding edge whitespace. None also
    /// denotes a source token made only of whitespace; keep its model index.
    pub mask_offsets: Vec<Option<[usize; 2]>>,
}

struct SourceView {
    text: String,
    // One original grapheme range per normalized UTF-8 byte. The tokenizer
    // uses byte offsets, whereas the UI and masking core use UTF-16 units.
    source: Vec<[usize; 2]>,
    graphemes: Vec<([usize; 2], bool)>,
}
impl SourceView {
    fn new(original: &str) -> Result<Self, Error> {
        let mut text = String::new();
        let mut source = Vec::new();
        let mut graphemes = Vec::new();
        let mut units = 0;
        for grapheme in original.graphemes(true) {
            let start = units;
            units += grapheme.encode_utf16().count();
            if units > MAX_SOURCE_UNITS {
                return Err(Error::SourceTooLong);
            }
            let normalized: String = grapheme.nfc().collect();
            graphemes.push(([start, units], grapheme.chars().all(char::is_whitespace)));
            source.extend(std::iter::repeat_n([start, units], normalized.len()));
            text.push_str(&normalized);
        }
        Ok(Self {
            text,
            source,
            graphemes,
        })
    }
    fn span(&self, start: usize, end: usize) -> Result<[usize; 2], Error> {
        if start >= end
            || end > self.text.len()
            || !self.text.is_char_boundary(start)
            || !self.text.is_char_boundary(end)
        {
            return Err(Error::SourceMapping);
        }
        Ok([self.source[start][0], self.source[end - 1][1]])
    }
    fn mask_span(&self, [start, end]: [usize; 2]) -> Option<[usize; 2]> {
        let mut first = self.graphemes.partition_point(|(span, _)| span[1] <= start);
        let mut last = self.graphemes.partition_point(|(span, _)| span[0] < end);
        while first < last && self.graphemes[first].1 {
            first += 1;
        }
        while first < last && self.graphemes[last - 1].1 {
            last -= 1;
        }
        (first < last).then(|| [self.graphemes[first].0[0], self.graphemes[last - 1].0[1]])
    }
}

pub struct LocalTokenizer(Tokenizer);
impl LocalTokenizer {
    pub fn load(path: &Path) -> Result<Self, Error> {
        use std::io::Read;
        let file = std::fs::File::open(path).map_err(|_| Error::Asset)?;
        let mut bytes = Vec::new();
        file.take(MAX_TOKENIZER_BYTES + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| Error::Asset)?;
        if bytes.len() as u64 > MAX_TOKENIZER_BYTES
            || format!("{:x}", Sha256::digest(&bytes)) != TOKENIZER_SHA256
        {
            return Err(Error::Asset);
        }
        let tokenizer = Tokenizer::from_bytes(bytes).map_err(|_| Error::Asset)?;
        // This pinned asset must never silently truncate, pad or sample.
        if tokenizer.get_truncation().is_some() || tokenizer.get_padding().is_some() {
            return Err(Error::Asset);
        }
        Ok(Self(tokenizer))
    }
    pub fn encode(&self, original: &str, inference: bool) -> Result<Encoded, Error> {
        let view = SourceView::new(original)?;
        let encoded = self
            .0
            .encode(view.text.as_str(), true)
            .map_err(|_| Error::Tokenization)?;
        let count = encoded.get_ids().len();
        if inference && count > MAX_MODEL_TOKENS {
            return Err(Error::TokenBudget);
        }
        if !encoded.get_overflowing().is_empty()
            || encoded.get_offsets().len() != count
            || encoded.get_special_tokens_mask().len() != count
            || encoded.get_attention_mask().len() != count
            || encoded.get_type_ids().len() != count
        {
            return Err(Error::SourceMapping);
        }
        let offsets = encoded
            .get_offsets()
            .iter()
            .zip(encoded.get_special_tokens_mask())
            .map(|(&(a, b), &special)| match special {
                0 => view.span(a, b).map(Some),
                1 if a == 0 && b == 0 => Ok(None),
                _ => Err(Error::SourceMapping),
            })
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Encoded {
            ids: encoded.get_ids().to_vec(),
            attention_mask: encoded.get_attention_mask().to_vec(),
            type_ids: encoded.get_type_ids().to_vec(),
            special_mask: encoded.get_special_tokens_mask().to_vec(),
            mask_offsets: offsets
                .iter()
                .map(|span| span.and_then(|s| view.mask_span(s)))
                .collect(),
            offsets,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_decomposition_keeps_distinct_source() {
        let view = SourceView::new("Nguye\u{302}\u{303}n / Nguye\u{302}\u{303}n").unwrap();
        assert_eq!(view.text, "Nguyễn / Nguyễn");
        let second = view.text.rfind("Nguyễn").unwrap();
        assert_eq!(view.span(0, "Nguyễn".len()), Ok([0, 8]));
        assert_eq!(view.span(second, view.text.len()), Ok([11, 19]));
    }
    #[test]
    fn astral_and_zwj_offsets_preserve_whole_grapheme() {
        let view = SourceView::new("🙂a\u{301} 👩‍👩‍👧‍👦").unwrap();
        assert_eq!(view.span(0, 4), Ok([0, 2]));
        assert_eq!(view.span(4, 6), Ok([2, 4]));
        assert_eq!(view.span(7, 11), Ok([5, 16]));
        assert_eq!(view.span(1, 4), Err(Error::SourceMapping));
        assert_eq!(view.span(0, 1), Err(Error::SourceMapping));
        assert_eq!(view.span(0, 0), Err(Error::SourceMapping));
        assert_eq!(view.span(0, 999), Err(Error::SourceMapping));
    }
    #[test]
    fn limit_is_original_utf16_not_normalized_length() {
        assert!(SourceView::new(&"🙂".repeat(25_000)).is_ok());
        assert!(matches!(
            SourceView::new(&"🙂".repeat(25_001)),
            Err(Error::SourceTooLong)
        ));
        assert!(matches!(
            SourceView::new(&"a\u{301}".repeat(25_001)),
            Err(Error::SourceTooLong)
        ));
    }
    #[test]
    fn masking_preserves_edge_whitespace_without_stripping_source_symbols() {
        let view = SourceView::new(" \r\nA B\u{a0}").unwrap();
        assert_eq!(view.mask_span([0, 7]), Some([3, 6]));
        assert_eq!(view.mask_span([0, 3]), None);
        let symbol = SourceView::new("▁a").unwrap();
        assert_eq!(symbol.mask_span([0, 2]), Some([0, 2]));
    }
}
