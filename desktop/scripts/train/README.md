# Fine-tuning the pack's Underthesea model

The scripts here take the synthetic document set (decisions 0153 and 0160) and turn it into a fine-tuned version of the pack's first model, so the structural vetoes of decisions 0159–0161 can shrink ([decision 0163](../../../docs/decisions/0163-fine-tune-the-pack-model.md)). Nothing here runs in the app; it is developer tooling, like `scripts/check-pack.mjs`.

## Environment

[uv](https://docs.astral.sh/uv/) manages a Python 3.12 environment from `pyproject.toml`; `uv.lock` pins every wheel (torch 2.14.1, transformers 4.57.6, onnxruntime 1.31.1, onnx 1.23.2 at the time of writing). The virtual environment lives in `.venv/` here and is ignored by git.

```sh
uv sync --project desktop/scripts/train                   # once; add --extra general for Wikipedia
uv run --project desktop/scripts/train download_base.py   # the base checkpoint, pinned revision, Apache-2.0
```

`download_base.py` fetches `undertheseanlp/vietnamese-ner-v1.4.0a2` at revision `a51e05fc…`, the checkpoint the shipping pack was exported from (`scripts/build-r2-pack.mjs`), into `desktop/artifacts/train/base/underthesea/` and refuses to continue if the repository no longer declares Apache-2.0. Weights never enter git (`artifacts/` is ignored).

## Pipeline

| Step | Command | What it does |
| --- | --- | --- |
| 1. Export | `mise exec -- node scripts/export-training-set.mjs <set> --train 100-131 --dev 132-135` | Runs the generator for the seeds named, reads every PDF and Word file with the app's own readers and writes `train.jsonl`, `dev.jsonl` and `summary.json`: one record per paragraph with code-point spans labelled `PERSON`, `LOCATION` or `ORGANIZATION` from the hide list, the keep list as `negatives`, the ignore list as `ignore`. Seeds 1–26 are refused (held out, see below). `--keep <folder>` also writes the documents for `pnpm eval:documents`. |
| 2. General slice | `uv run --project desktop/scripts/train prepare_general.py <general.jsonl> --wikipedia 20000` | Labels ordinary Vietnamese paragraphs with the base model itself (PER, LOC, ORG and MISC), so training replays what the model knew about news text. `--text <file>` takes one paragraph per line instead. |
| 3. Train | `uv run --project desktop/scripts/train train.py --train <set>/train.jsonl --dev <set>/dev.jsonl --general <general.jsonl> --out desktop/artifacts/train/run-1` | Packs consecutive paragraphs with the scanner's `"\n\n"` into 384-token windows, labels every piece B-/I-/O with the base model's nine labels, skips ignored spans in the loss, mixes `--general-ratio` general windows per synthetic window each epoch, measures the dev split after every epoch (exact spans per label, and the share of kept texts a predicted span touches) and saves the best epoch to `<out>/checkpoint` with `metrics.json`. |
| 4. Export | `uv run --project desktop/scripts/train export_pack.py <out>/checkpoint <root>/underthesea --tokenizer-from <installed pack>/underthesea` | ONNX at opset 18 (TorchScript exporter, checked against PyTorch), dynamic INT8 of the MatMul weights as `scripts/export-underthesea.py` did for the base model, `config.json` with `id2label`, and the unchanged tokenizer files. |
| 5. Pin and check | `cp packs/vietnamese-pii-v1.json <root>/candidate.json && mise exec -- pnpm pack:prepare <root>/candidate.json <root> underthesea && mise exec -- node scripts/check-pack.mjs <root> --definition <root>/candidate.json` | The candidate pack keeps the OpenMed model (link or copy its directory into `<root>`) and pins the new files; `check-pack.mjs --definition` loads it through the pack contract, offline, against the gate fixtures. |
| 6. Measure | `mise exec -- pnpm eval:documents <folder> --pack <root> --definition <root>/candidate.json` | The same report as the shipping pack on the 0153 set, the wider set and the owner's private sets. |

`smoke.sh` runs steps 1–5 on two seeds, 50 documents and one epoch: minutes on a laptop CPU, proving the pipeline, not the model.

## Held-out rule

Seeds 1–7 (the 0153 set) and 8–26 (the wider set of 0160) are measured by every decision since; `tests/documents/training-set.mjs` refuses to export them and `tests/training-set.test.mjs` checks that it does. The owner's private sets are never generated and so never exported. A training run uses seeds from 100 up; dev seeds are separate from train seeds within the run.

## Labels

The hide list names values, not categories. `labelOf` in `tests/documents/training-set.mjs` reads the category off the value with the detection vocabulary (`src/core/detection/vocabulary/`): a value starting with a legal form or organization kind is an `ORGANIZATION`; a value starting with a house number or holding an address word (with its tone marks: "Ngô" is a family name, "ngõ" a lane) is a `LOCATION`; letters only, up to six syllables, is a `PERSON`; anything else (phones, identifiers, accounts, dates, e-mails, codes) is left unlabelled because the structured rules hide those, not the models. `summary.json` counts each class and lists any labelled value the reader did not reproduce.

## Licence

The base model and the fine-tuned result are Apache-2.0; the pack's `attribution` and the installer's `LICENSE` file stay as they are, and a published candidate records its provenance (repository, revision, this pipeline, the seeds) in its decision. Wikipedia text is CC BY-SA 4.0 and is used as training input only; it is never redistributed, and no model file carries it.
