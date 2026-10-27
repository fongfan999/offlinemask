# 0163 — Fine-tune the pack's model on the synthetic set so the vetoes can shrink

Date: 27 October 2026. Status: pipeline built and smoke-tested; no full training run yet, no pack replaced. Follows 0161's closing note: "the next step is to train or fine-tune the pack's models on the synthetic set so the vetoes shrink, with the owner's real files as the check that invented documents resemble real ones." (Numbered 0163 because 0162 is the review-step decision.)

## Why

Decisions 0154–0161 closed every measured leak and over-masking with structure: vetoes fed by vocabulary data. They work, but they exist because the models were trained on news sentences and read an official document the way they read a news story: a department's name as an organization to hide, a position as a person, a product as a place. The owner's direction is a maintainable detector, not a list that grows with every new kind of document. The open classes (positions, products, subjects, department names) are the models' job (0161 §4). The synthetic set now holds 78 documents a seed in 26 layouts with exact answers written by the generator, which is training data by construction. This decision lays the pipeline that turns it into a fine-tuned model; a later decision records the measured candidate and what vetoes it retired.

## What was built

**Export** (`desktop/scripts/export-training-set.mjs`, logic in `tests/documents/training-set.mjs`, test `tests/training-set.test.mjs`): the generator runs for a range of seeds; each document is read by the app's own PDF and Word readers, so the training text is the text the app sees, including the joined letterhead lines and the two-cell headers a real reader produces. Every paragraph becomes one JSONL record: the text, code-point spans labelled `PERSON`, `LOCATION` or `ORGANIZATION`, the keep list as `negatives`, the ignore list as `ignore`. The hide list names values, not categories; the category is read off the value with the detection vocabulary (a legal form or organization kind at the start is an organization; a house number or an address word with its tone marks is an address; letters only is a person; a phone, identifier, account, date, e-mail or code is left to the structured rules). The test checks on one seed that every labelled hidden value is covered by a span with its label, that nothing overlaps, that offsets slice back to the value, and that kept texts within one paragraph are negatives. A value whose label the vocabulary gets wrong fails the test, not the model.

**Train** (`desktop/scripts/train/`, uv project with `uv.lock`): `download_base.py` fetches the base checkpoint the shipping model was exported from (`undertheseanlp/vietnamese-ner-v1.4.0a2`, revision `a51e05fc…`, Apache-2.0 checked on the repository's metadata) into `desktop/artifacts/train/`; `prepare_general.py` labels ordinary Vietnamese paragraphs (Vietnamese Wikipedia, or any text file) with the base model itself, so training replays what it knew about news-style names, MISC included; `train.py` packs consecutive paragraphs of a document with the scanner's `"\n\n"` into 384-token windows (the window the app gives a model), labels every piece B-/I-/O with the base model's own nine labels, skips ignored spans in the loss, mixes a ratio of general windows into each epoch, measures the dev split after each epoch and keeps the best; `export_pack.py` writes the ONNX graph at opset 18, checks it against PyTorch, quantizes the MatMul weights to INT8 as the shipping graph was (`scripts/export-underthesea.py`), and lays out `config.json`, `tokenizer.json` and `tokenizer_config.json` as `packs/README.md` requires, the tokenizer files copied unchanged so the Rust and JavaScript tokenizers keep agreeing (native offsets). `README.md` there has every command.

**Check** (`check-pack.mjs --definition`, `evaluate-documents.mjs --definition`, `pack-runtime.mjs`): a candidate pack is a copy of `packs/vietnamese-pii-v1.json` with one directory re-pinned by `pnpm pack:prepare <copy> <root> underthesea`; the two scripts load it through the same contract and policy as the shipping pack without touching `pack.ts`.

## Held-out rule

Seeds 1–7 (the 0153 set) and 8–26 (the wider set of 0160) are measured by every decision since 0153 and are never exported: `seedRange` refuses them and the test checks the refusal. The owner's private sets (`~/OfflineMask-eval`, decision 0152) are real documents that are never generated, so they are held out by construction, and remain the check that invented documents resemble real ones. Training seeds start at 100; a run's dev seeds are disjoint from its train seeds.

## Smoke test

`scripts/train/smoke.sh`, on this Mac (10 cores, 16 GB, CPU only):

| Step | Result |
| --- | --- |
| Export seeds 100 (train) and 101 (dev), one variant | 52 + 52 documents, 978 + 980 paragraphs, 8 s; every labelled value found in the read text |
| General slice from a 16-line text file | 16 paragraphs, 15 with a teacher span |
| Base model on the dev windows (10 documents, 32 windows), raw predictions without the policy | exact-span F1 0.05 overall (PERSON 0.05, LOCATION 0.00, ORGANIZATION 0.15); 33.8 % of kept texts touched by a span |
| Train one epoch on the first 50 documents | 78 synthetic windows + 8 general, 12 steps of 8, 55–60 s; dev exact-span F1 0.31 overall (PERSON 0.35, LOCATION 0.32, ORGANIZATION 0.18); 16.9 % of kept texts touched |
| Export | FP32 graph matches PyTorch within 1.2e-5; INT8 graph 205 MB, the shipping graph's size |
| Candidate pack through the contract | pinned files verified, both models loaded offline in 2.8 s with fetch disabled, 23/23 gate fixtures pass |

The fixtures pass even with this throwaway model because the policy and the OpenMed model carry most of them; the dev table is the measurement that matters. It says two things: the raw base model reads these documents badly (its spans are fragments of the values, and a third of the kept texts get a span), which is what the vetoes have been compensating for; and fifty documents for one epoch already halve the kept texts touched. One epoch on 50 documents is not a candidate; it proves the pipeline end to end.

## Device

The first version of `train.py` never chose a device, so a cloud GPU would have idled while the CPU trained. `records.pick_device` now takes a CUDA GPU, then Apple's MPS, then the CPU (`--device auto`, overridable), and `metrics.json` records which one ran. On this Mac the smoke epoch (78 synthetic windows and 8 general, 12 steps of 8) takes 17 s on MPS against 55–60 s on the CPU, with the same dev F1 (0.315), so the full run of 2 496 documents is about an hour here without any cloud account. `train/README.md` has the cloud recipe (Google Cloud needs an upgraded billing account and GPU quota; Oracle trial accounts have a GPU limit of 0) and the Mac one.

## Licence and hosting

The base model is Apache-2.0 (Underthesea, Hugging Face); a fine-tuned graph is a derivative under the same licence, and the pack's `attribution` ("Underthesea + OpenMed · Nguồn: Hugging Face · Giấy phép Apache 2.0.") and the installer's `LICENSE` file stay as they are. A published candidate records in its decision the base repository and revision, the pipeline commit, the seeds and epochs, and the measurements. Wikipedia text (CC BY-SA 4.0) is training input only and is never redistributed.

A hosted model file lives where the shipping pack's files live: the Cloudflare R2 bucket of decision 0041, one Zstandard-compressed object per file named by its digest, written into the pack's `assets[].transport` by `scripts/build-r2-pack.mjs`. The install directory is the digest of the `assets` array, so a new Underthesea graph installs beside the current version and the previous one stays on disk.

## What is still needed before a pack changes

1. **A full run.** Export seeds 100–131 as train (2 496 documents) and 132–135 as dev; 20 000 Wikipedia paragraphs as the general slice; three epochs. On this Mac's CPU a 384-token window costs about 0.57 s forward and backward at batch 8, so a full epoch (about 3 750 synthetic windows plus 1 875 general) is close to an hour and three epochs about three hours: longer than the 30 minutes this decision allowed itself, so it was not run here. On one T4- or L4-class GPU the same run takes 10–20 minutes; `uv sync` on a CUDA machine installs the matching torch.
2. **Measurements that must not regress**, with `--definition` on the candidate: `pnpm eval:documents` on the 0153 set (189 documents: 0 not read, 0 leaked, 0 over-masked), the wider set seeds 1–26 (2 028 documents: 0, 0, 0, 6 unlisted) and the owner's sets (`~/OfflineMask-eval/invoices`, `~/OfflineMask-eval/decisions`: all counts 0); `pnpm test:models` 23/23 with the gate fixtures; the dev split's exact-span table and share of kept texts touched, which `train.py` prints.
3. **Then the vetoes shrink**, one mechanism at a time, each removal measured on the same sets; the vocabulary files stay as data for whatever the model still gets wrong.
4. **Publish** through `build-r2-pack.mjs`, fill in the transports, re-pin `packs/vietnamese-pii-v1.json`, and record the evaluation under `docs/evaluations/`.
