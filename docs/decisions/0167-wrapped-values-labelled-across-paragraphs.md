# 0167 — A value the reader wraps across two paragraphs is labelled in both

Date: 28 October 2026. Status: done in the training exporter and packer; the shipping pack, the generator and the measured sets are unchanged. Owner: "yes check it" (the open item of decision 0166: check that the training windows match the scanner's window before run 2).

## What was checked

Decision 0166 left one diagnosis open: the candidate of run 1 leaks a rental contract's premises address in the opening sentence ("Hôm nay, ngày …, tại Số 48 Huỳnh Văn Bánh, Phường Hoàn Kiếm, Thành phố Hà Nội, Việt Nam, chúng tôi gồm:"), and the span shrank as the scanner's first window filled. The suspicion was a window-shape mismatch between training and the app. Four probes, all on this Mac, with the run 1 checkpoint and the exported set rebuilt from the same seeds:

1. **The windows match.** For the leaking document of seed 1, the scanner's first window (the app's path: unique paragraphs joined with `"\n\n"`, cut at 1 200 characters or 384 tokens) and the trainer's first packed window (`pack_documents`, whole paragraphs joined with the same separator up to 384 tokens) both carry the sentence at characters 132–198, with the same parties' fields after it. Shape is not the cause.
2. **The app is not the cause.** The PyTorch checkpoint on the scanner's exact first window gives the same fragment as the INT8 graph in the app ("B", "ường Hoàn Kiếm", "phố").
3. **The failure is one sentence shape, not a street name.** On the first windows of the seven held-out rental contracts (seeds 1–7), every address in the generator's second form ("Số …, Việt Nam") is fragmented (coverage 0.27–0.51, four of four) and every address in the plain form ("217 Huỳnh Văn Bánh, Phường Hải Châu, Thành phố Đà Nẵng") is found whole (three of three), person-named streets in both groups. The same checkpoint on its own training seeds 100–101 fails the same sentence (coverage 0.43 and 0.22) while it finds the other 71 of 74 "Số …" spans, and on the dev seed 132 it finds all 108 location spans. A model that cannot learn a training example is being taught the opposite somewhere.
4. **The opposite is in the training set.** The PDF reader wraps that sentence at the line break and yields two paragraphs, "…, Thành phố Hà Nội, Việt" and "Nam, chúng tôi gồm:". The exporter matched hide values paragraph by paragraph, so the wrapped address matched neither and the sentence went out with no span: an explicit negative of exactly the shape the Word version labels. The tally of unmatched values did not notice because the same address appears again in Điều 1 of the same document. Across 16 training seeds, 15 of 8 192 labelled occurrences cross a paragraph break, and all 15 are this sentence in the rental contract's PDF; over the 32 seeds of the README's recipe that is about one negative for every Word positive.

## What changed

- `desktop/tests/documents/training-set.mjs`: `paragraphSpans(texts, expect)` matches the hide, keep and ignore lists on the document's paragraphs joined with the scanner's separator, then clips each span to the paragraphs it touches; a piece of a value that crosses a break carries `clipped: true`. `trainingRecords` uses it, counts unmatched values on the joined text, and numbers records over the paragraphs with letters (the ones the scanner sends to the models), as before for every document that does not wrap.
- `desktop/scripts/train/records.py`: `Span.clipped` survives the JSONL round trip, and `pack_documents` joins the two clipped pieces of one value back into one span with the separator inside it, which is what the app's models see at inference (the base model itself predicts "Việt\n\nNam" as one location there). A window boundary between the pieces leaves them clipped.
- Tests: `tests/training-set.test.mjs` has the wrapped sentence as a unit case, and its whole-seed case now runs seed 101 with two variants (the seed whose rental PDF wraps) and asserts that every occurrence of every labelled value in the joined document text is covered, in one span or in adjoining pieces. `scripts/train/tests/test_records.py` covers the merge, the no-merge of whole neighbours, the window boundary and the round trip. `smoke.sh` runs the pipeline end to end on the changed exporter and packer.

## Measured

Re-exported seeds 100–115 (two variants) with the change: 0 unmatched values, 30 clipped pieces; packed with the base tokenizer, 1 932 windows, 15 spans with the separator inside and no piece left clipped. `pnpm test` 430/430, the Python unit tests 7/7, `pnpm lint` clean. The held-out sets, the generator and the shipping pack did not change, so nothing was re-measured against them; the pack gate and `pnpm test:models` are unaffected.

## What this does not claim

The fix removes the only contradiction found in the training data for the leaking shape. Whether it is sufficient is run 2's measurement: the pipeline's steps 4–7 on the new checkpoint, on seeds 1–7 and the owner's documents, as 0166 describes. The candidate of run 1 stays unshipped.
