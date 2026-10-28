# 0168 — The second fine-tuned candidate is measured clean; shipping it is the owner's call

Date: 28 October 2026. Status: measured; the shipping pack is unchanged until the owner decides. Owner: "downloaded the run-2" (the `run-2.tgz` of the second full training run of decision 0163, done on their Windows machine after the exporter fix of decision 0167).

## What was done

The pipeline's steps 4–7 on the Mac as for run 1 (0166): the epoch-1 checkpoint exported to an INT8 ONNX graph with the shipping pack's tokenizer files, pinned as a candidate pack beside the installed OpenMed model, loaded through the pack contract against the gate fixtures (23/23), then `pnpm compare:packs` with full ablation on seeds 1–7 and the owner's sets, and, new for this run, the same comparison without ablation on the wider set, seeds 8–26. The numbers are in [docs/evaluations/2026-10-28-candidate-run-2.md](../evaluations/2026-10-28-candidate-run-2.md). Before export, the PyTorch checkpoints were run on the exact window shape that leaked in run 1; every rental address is found whole.

## Provenance

Base `undertheseanlp/vietnamese-ner-v1.4.0a2` at revision `a51e05fc…` (Apache-2.0); the pipeline at commit a0ee489 (0167); seeds 100–131 as train and 132–135 as dev, two variants, exported on 28 October 00:16 (+07); run 1's 8 000 general paragraphs at ratio 0.5; three epochs on a CPU in 5 h 57 min; seed 20261027; `--keep-epochs`, best epoch 1 by overall dev F1 (0.885), recall 1.000 on every label at every epoch.

## What the tables say

- Seeds 1–7 and the owner's sets, 557 documents: the candidate reads 0 not read, 0 leaked on the synthetic seeds, 0 over-masked, 0 unlisted. The one count in the table is the bank's name in the owner's draft invoice expectation, which 0166 already explained: a bank's name is not private and belongs under `ignore` once the owner reviews that draft.
- The wider set, seeds 8–26, 1 482 documents: the shipping pack over-masks 5 texts and leaves 6 one-word masks unlisted; the candidate over-masks 3 of those same 5 and nothing else. No leak.
- Ablation: as in run 1, `transactionCells` and `trims` bring nothing back when switched off; the other eight still hold something back, seven of them a fraction of what they hold back for the shipping model.

So run 2 meets the rule of 0152 on every held-out set: it leaks nowhere the shipping pack does not, and over-masks nowhere the shipping pack does not. Decision 0167's fix was sufficient for the shape it targeted.

## Decision

The candidate is fit to ship on the evidence; whether and when it ships is the owner's decision, since it is the first replacement of a shipping model and it changes what every installation downloads. Nothing in the repository changed for it: the shipping pack definition, the mechanisms and the privacy page are as they were. The run's files stay under `desktop/artifacts/train/run-2/` (ignored by git).

## What shipping would take

1. The owner reviews the draft invoice expectation (the bank's name to `ignore`), so the measured tables read all zeros and the baseline for later changes is exact.
2. Publish the new Underthesea files the way the current ones were published (0163 §Hosting, `scripts/build-r2-pack.mjs`): `model_int8.onnx` and `config.json` from `artifacts/train/run-2/pack/underthesea/`, the tokenizer files unchanged, into the R2 bucket by digest, and the new transport entries into `desktop/packs/vietnamese-pii-v1.json`. The new install directory is the digest of the new `assets` array, so the current version stays on disk beside it.
3. `pnpm test` and `pnpm test:models` against the newly installed root, and the pack's decision records this provenance (base revision, pipeline commit, seeds, run facts, the dev table) as 0163 requires.
4. In a separate, measured change: retire `transactionCells` and `trims` as 0165 retired two mechanisms, with the seven others left in place; their word lists go with them, and the held-out tables must stay at the shipped baseline.
5. A release (the `release` skill) carries the new pack version to users.

## What this does not claim

The fine-tuned model has not been measured on real documents beyond the owner's two small sets (an invoice folder and one decision). The next real documents the owner adds to `~/OfflineMask-eval` are the first test of it outside the generator's layouts.
