//! Text in pictures (decision 0171): a scanned PDF page or an image is read by the
//! operating system's own text recognition, Apple's Vision framework on macOS, on this
//! machine. No model is downloaded, no file is written and nothing leaves the computer:
//! the picture comes from the web view as PNG or JPEG bytes and goes back as lines of
//! text with their places on the page. Other systems have no engine yet and report so.
use serde::Serialize;

/// One recognised word and its box, in fractions of the image (origin top left). The
/// box is the word's own across, and its line's up and down, so words of a line share a
/// baseline and a height whatever letters they hold. A whole line stands as one word
/// where the engine gives no boxes for its parts.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLine {
    pub text: String,
    pub confidence: f32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}
#[derive(Clone, Debug, Default, Serialize)]
pub struct OcrPage {
    pub lines: Vec<OcrLine>,
}

#[cfg(target_os = "macos")]
mod vision {
    use super::{OcrLine, OcrPage};
    use objc2::rc::Retained;
    use objc2::AnyThread;
    use objc2_foundation::{NSArray, NSData, NSDictionary, NSRange, NSString};
    use objc2_vision::{
        VNDetectTextRectanglesRequest, VNImageRequestHandler, VNRecognizeTextRequest,
        VNRecognizedText, VNRequest, VNRequestTextRecognitionLevel,
    };

    /// A box in fractions of the image, origin top left.
    #[derive(Clone, Copy)]
    struct Frame {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    }
    impl Frame {
        fn end(&self) -> f64 {
            self.x + self.width
        }
    }
    /// Vision's boxes have their origin at the bottom left.
    fn frame(rect: objc2_core_foundation::CGRect) -> Frame {
        Frame {
            x: rect.origin.x,
            y: 1.0 - rect.origin.y - rect.size.height,
            width: rect.size.width,
            height: rect.size.height,
        }
    }

    /// The words of a recognised line, each with its own box across, and the space the
    /// engine saw kept on the word. The recogniser's boxes for the parts of a line are
    /// even divisions of it, not the glyphs' places (checked letter by letter), so a
    /// table's cells it read as one line would stay glued. The text detector's
    /// character boxes are the glyphs' places: a gap between two of them wider than
    /// `cellGap` of their height is a cell boundary, and the words are placed cell by
    /// cell, by their share of the line's letters. `None` when the recogniser gives no
    /// box for a part, so the whole line stands as one word.
    fn words(
        candidate: &VNRecognizedText,
        text: &str,
        line: Frame,
        glyphs: &[Frame],
    ) -> Option<Vec<(String, Frame)>> {
        let mut words: Vec<(String, Frame)> = Vec::new();
        let mut current: Option<(String, Frame)> = None;
        let mut location = 0;
        for char in text.chars() {
            let length = char.len_utf16();
            let range = NSRange::new(location, length);
            location += length;
            if char.is_whitespace() {
                // The space is kept on the word, so the reader knows the engine saw one
                // whatever the gap between the boxes.
                if let Some((word, _)) = &mut current {
                    word.push(' ');
                }
                words.extend(current.take());
                continue;
            }
            let observation = unsafe { candidate.boundingBoxForRange_error(range) }.ok()?;
            let letter = frame(unsafe { observation.boundingBox() });
            match &mut current {
                Some((word, box_)) if letter.x - box_.end() <= line.height / 3.0 => {
                    word.push(char);
                    let end = box_.end().max(letter.end());
                    box_.x = box_.x.min(letter.x);
                    box_.width = end - box_.x;
                }
                _ => {
                    words.extend(current.take());
                    current = Some((
                        char.to_string(),
                        Frame {
                            x: letter.x,
                            y: line.y,
                            width: letter.width,
                            height: line.height,
                        },
                    ));
                }
            }
        }
        words.extend(current.take());
        place_by_glyphs(&mut words, line, glyphs);
        Some(words)
    }

    /// Moves the words of a line onto the glyphs the detector found: the recogniser's
    /// line box is padded (a lone short word gets a box twice its width), the glyph
    /// boxes are tight. The glyphs on the line, left to right, fall into cells at the
    /// wide gaps: wider than half the line's box height or one and a half glyph
    /// heights, whichever is more (a word space is a third of the font size, a
    /// table's cell gap two thirds or more). The line's letters are shared out over
    /// the cells in the glyphs' proportion, at word boundaries, and each cell's words
    /// are spread over the cell's true extent.
    fn place_by_glyphs(words: &mut [(String, Frame)], line: Frame, glyphs: &[Frame]) {
        let middle = line.y + line.height / 2.0;
        let mut on_line: Vec<Frame> = glyphs
            .iter()
            .filter(|glyph| {
                glyph.y <= middle
                    && glyph.y + glyph.height >= middle
                    && glyph.end() > line.x
                    && glyph.x < line.end()
            })
            .copied()
            .collect();
        on_line.sort_by(|a, b| a.x.total_cmp(&b.x));
        if on_line.is_empty() || words.is_empty() {
            return;
        }
        let mut heights: Vec<f64> = on_line.iter().map(|glyph| glyph.height).collect();
        heights.sort_by(f64::total_cmp);
        let gap = (line.height / 2.0).max(1.5 * heights[heights.len() / 2]);
        // Cells as runs of glyph indices.
        let mut cells: Vec<(usize, usize)> = vec![(0, 0)];
        for index in 1..on_line.len() {
            if on_line[index].x - on_line[index - 1].end() > gap {
                cells.push((index, index));
            } else {
                cells.last_mut().unwrap().1 = index;
            }
        }
        if cells.len() < 2 || words.len() < 2 {
            let last = on_line.last().unwrap();
            spread(words, on_line[0].x, last.end());
            return;
        }
        // Each cell gap's share of the glyphs, and the word boundary nearest to it. A
        // dash or a bullet the detector did not box leaves a gap that is not a cell's:
        // a boundary beside a word without a letter or digit is not one.
        let letters: Vec<usize> = words
            .iter()
            .map(|(word, _)| word.trim().chars().count())
            .collect();
        let total: usize = letters.iter().sum();
        let wordy = |index: usize| {
            words
                .get(index)
                .is_some_and(|(word, _)| word.chars().any(char::is_alphanumeric))
        };
        // (word boundary, last cell before it)
        let mut boundaries: Vec<(usize, usize)> = Vec::new();
        for (index, cell) in cells[..cells.len() - 1].iter().enumerate() {
            let share = (cell.1 + 1) as f64 / on_line.len() as f64;
            let target = share * total as f64;
            let mut seen = 0;
            let mut best = (f64::INFINITY, 0);
            for (word, count) in letters.iter().enumerate() {
                seen += count;
                let distance = (seen as f64 - target).abs();
                if distance < best.0 {
                    best = (distance, word + 1);
                }
            }
            let after = boundaries.last().is_none_or(|(word, _)| best.1 > *word);
            if best.1 < words.len() && after && wordy(best.1 - 1) && wordy(best.1) {
                boundaries.push((best.1, index));
            }
        }
        // Runs of cells between the boundaries place their runs of words.
        let mut first_word = 0;
        let mut first_cell = 0;
        for (word, cell) in boundaries
            .into_iter()
            .chain([(words.len(), cells.len() - 1)])
        {
            spread(
                &mut words[first_word..word],
                on_line[cells[first_cell].0].x,
                on_line[cells[cell].1].end(),
            );
            first_word = word;
            first_cell = cell + 1;
        }
    }

    /// Spreads words over `x..end` in proportion to their letters, a space's width apart.
    fn spread(words: &mut [(String, Frame)], x: f64, end: f64) {
        let letters: Vec<f64> = words
            .iter()
            .map(|(word, _)| word.trim().chars().count().max(1) as f64)
            .collect();
        let total: f64 = letters.iter().sum::<f64>() + (words.len() as f64 - 1.0) * 0.5;
        let unit = (end - x).max(0.0) / total.max(1.0);
        let mut at = x;
        for ((_, frame), count) in words.iter_mut().zip(letters) {
            frame.x = at;
            frame.width = unit * count;
            at += unit * (count + 0.5);
        }
    }

    /// The Vietnamese identifier Vision reports ("vi-VT" on macOS 26), if it reads
    /// Vietnamese at all: macOS 14 added the language.
    fn vietnamese() -> Option<Retained<NSString>> {
        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        let languages = unsafe { request.supportedRecognitionLanguagesAndReturnError() }.ok()?;
        languages
            .to_vec()
            .into_iter()
            .find(|language| language.to_string().starts_with("vi"))
    }
    pub fn available() -> bool {
        vietnamese().is_some()
    }
    pub fn recognize(image: &[u8]) -> Result<OcrPage, String> {
        let vietnamese = vietnamese().ok_or("unavailable")?;
        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(true);
        request.setRecognitionLanguages(&NSArray::from_retained_slice(&[
            vietnamese,
            NSString::from_str("en-US"),
        ]));
        // The detector's glyph boxes place the recogniser's words (`words`).
        let detector = unsafe { VNDetectTextRectanglesRequest::new() };
        unsafe { detector.setReportCharacterBoxes(true) };
        let data = NSData::with_bytes(image);
        let handler = VNImageRequestHandler::initWithData_options(
            VNImageRequestHandler::alloc(),
            &data,
            &NSDictionary::new(),
        );
        let requests: Retained<NSArray<VNRequest>> = NSArray::from_retained_slice(&[
            Retained::into_super(Retained::into_super(request.clone())),
            Retained::into_super(Retained::into_super(detector.clone())),
        ]);
        handler
            .performRequests_error(&requests)
            .map_err(|_| "unreadable")?;
        let glyphs: Vec<Frame> = unsafe { detector.results() }
            .map(|list| list.to_vec())
            .unwrap_or_default()
            .iter()
            .flat_map(|text| {
                unsafe { text.characterBoxes() }
                    .map(|boxes| boxes.to_vec())
                    .unwrap_or_default()
            })
            .map(|glyph| frame(unsafe { glyph.boundingBox() }))
            .collect();
        let mut page = OcrPage::default();
        for observation in request
            .results()
            .map(|list| list.to_vec())
            .unwrap_or_default()
        {
            let Some(candidate) = observation.topCandidates(1).firstObject() else {
                continue;
            };
            let text = candidate.string().to_string();
            if text.trim().is_empty() {
                continue;
            }
            let line = frame(unsafe { observation.boundingBox() });
            let confidence = candidate.confidence();
            let parts = words(&candidate, &text, line, &glyphs)
                .filter(|parts| !parts.is_empty())
                .unwrap_or_else(|| vec![(text.clone(), line)]);
            page.lines
                .extend(parts.into_iter().map(|(word, frame)| OcrLine {
                    text: word,
                    confidence,
                    x: frame.x,
                    y: frame.y,
                    width: frame.width,
                    height: frame.height,
                }));
        }
        Ok(page)
    }

    #[cfg(test)]
    mod tests {
        use super::{place_by_glyphs, Frame};

        fn frame(x: f64, width: f64) -> Frame {
            Frame {
                x,
                y: 0.5,
                width,
                height: 0.02,
            }
        }
        fn glyphs(x: f64, count: usize) -> Vec<Frame> {
            // Glyphs 0.008 wide, 0.002 apart, 0.01 tall around the line's middle.
            (0..count)
                .map(|index| Frame {
                    x: x + index as f64 * 0.01,
                    y: 0.505,
                    width: 0.008,
                    height: 0.01,
                })
                .collect()
        }
        fn words(texts: &[&str]) -> Vec<(String, Frame)> {
            // The recogniser's even division of a padded line box.
            let total: usize = texts.iter().map(|text| text.len()).sum();
            let mut at = 0.1;
            texts
                .iter()
                .map(|text| {
                    let width = 0.5 * text.len() as f64 / total as f64;
                    at += width;
                    (text.to_string(), frame(at - width, width))
                })
                .collect()
        }

        #[test]
        fn a_wide_glyph_gap_parts_two_cells_at_a_word_boundary() {
            let line = frame(0.1, 0.5);
            let mut words = words(&["01/10/2026 ", "FT26 ", "Nap ", "tien"]);
            let mut glyphs = glyphs(0.10, 10); // the date
            glyphs.extend(glyphs_at(0.25, 4)); // the reference, after a cell gap
            glyphs.extend(glyphs_at(0.302, 7)); // "Nap tien", a word space after it
            place_by_glyphs(&mut words, line, &glyphs);
            assert!((words[0].1.x - 0.10).abs() < 1e-9);
            assert!((words[0].1.end() - 0.198).abs() < 1e-9);
            assert!((words[1].1.x - 0.25).abs() < 1e-9);
            assert!((words[3].1.end() - 0.37).abs() < 1e-9);
            assert!(words[1].1.x - words[0].1.end() > line.height);
        }

        #[test]
        fn a_gap_beside_a_dash_is_not_a_cell() {
            let line = frame(0.1, 0.5);
            let mut words = words(&["TIẾN ", "- ", "MST:"]);
            let mut glyphs = glyphs(0.10, 4); // the dash goes unboxed
            glyphs.extend(glyphs_at(0.20, 4));
            place_by_glyphs(&mut words, line, &glyphs);
            // One cell over the glyphs' whole extent, the words in order.
            assert!((words[0].1.x - 0.10).abs() < 1e-9);
            assert!((words[2].1.end() - 0.238).abs() < 1e-9);
            assert!(words[0].1.end() < words[1].1.x && words[1].1.end() < words[2].1.x);
        }

        fn glyphs_at(x: f64, count: usize) -> Vec<Frame> {
            glyphs(x, count)
        }
    }
}

/// Whether this machine can read text in pictures.
pub fn available() -> bool {
    #[cfg(target_os = "macos")]
    {
        vision::available()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

/// The lines of text in a PNG or JPEG picture.
pub fn recognize(image: &[u8]) -> Result<OcrPage, String> {
    #[cfg(target_os = "macos")]
    {
        vision::recognize(image)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = image;
        Err("unavailable".into())
    }
}

#[tauri::command]
pub fn ocr_available() -> bool {
    available()
}

/// Reads one picture off the web view's thread. The bytes are held only for the call.
#[tauri::command]
pub async fn ocr_page(image: Vec<u8>) -> Result<OcrPage, String> {
    tauri::async_runtime::spawn_blocking(move || recognize(&image))
        .await
        .map_err(|_| "unavailable".to_string())?
}
