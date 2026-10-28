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
| 1. Export | `mise exec -- node scripts/export-training-set.mjs <set> --train 100-131 --dev 132-135` | Runs the generator for the seeds named, reads every PDF and Word file with the app's own readers and writes `train.jsonl`, `dev.jsonl` and `summary.json`: one record per paragraph with letters, with code-point spans labelled `PERSON`, `LOCATION` or `ORGANIZATION` from the hide list, the keep list as `negatives`, the ignore list as `ignore`. The lists are matched on the document's paragraphs joined with the scanner's `"\n\n"`, so a value the PDF reader wrapped across two paragraphs is labelled in both, each piece marked `clipped` (decision 0167). Seeds 1–26 are refused (held out, see below). `--keep <folder>` also writes the documents for `pnpm eval:documents`. |
| 2. General slice | `uv run --project desktop/scripts/train prepare_general.py <general.jsonl> --wikipedia 20000` | Labels ordinary Vietnamese paragraphs with the base model itself (PER, LOC, ORG and MISC), so training replays what the model knew about news text. `--text <file>` takes one paragraph per line instead. |
| 3. Train | `uv run --project desktop/scripts/train train.py --train <set>/train.jsonl --dev <set>/dev.jsonl --general <general.jsonl> --out desktop/artifacts/train/run-1` | Packs consecutive paragraphs with the scanner's `"\n\n"` into 384-token windows (the two `clipped` pieces of a wrapped value become one span again, separator inside), labels every piece B-/I-/O with the base model's nine labels, skips ignored spans in the loss, mixes `--general-ratio` general windows per synthetic window each epoch, measures the dev split after every epoch (exact spans per label, and the share of kept texts a predicted span touches) and saves the best epoch to `<out>/checkpoint` with `metrics.json` (`best_epoch` names it). `--keep-epochs` also saves every epoch as `<out>/checkpoint-<n>`, so step 4 can export the epoch the comparison prefers rather than the best overall F1 (decision 0166). |
| 4. Export | `uv run --project desktop/scripts/train export_pack.py <out>/checkpoint <root>/underthesea --tokenizer-from <installed pack>/underthesea` | ONNX at opset 18 (TorchScript exporter, checked against PyTorch), dynamic INT8 of the MatMul weights as `scripts/export-underthesea.py` did for the base model, `config.json` with `id2label`, and the unchanged tokenizer files. |
| 5. Pin and check | `cp packs/vietnamese-pii-v1.json <root>/candidate.json && mise exec -- pnpm pack:prepare <root>/candidate.json <root> underthesea && mise exec -- node scripts/check-pack.mjs <root> --definition <root>/candidate.json` | The candidate pack keeps the OpenMed model (link or copy its directory into `<root>`) and pins the new files; `check-pack.mjs --definition` loads it through the pack contract, offline, against the gate fixtures. |
| 6. Measure | `mise exec -- pnpm eval:documents <folder> --pack <root> --definition <root>/candidate.json` | The same report as the shipping pack on the 0153 set, the wider set and the owner's private sets. |
| 7. Compare | `mise exec -- pnpm compare:packs --candidate <root>/candidate.json --candidate-root <root> --seeds 1-7 --ablate` | One table: the shipping pack, the candidate, and the candidate with each structural mechanism switched off in turn, on the held-out seeds and the owner's sets; the mechanisms that bring nothing back when off are the ones the candidate no longer needs (decision 0164). About ten minutes per run on seeds 1–7. |

`smoke.sh` runs steps 1–5 on two seeds, 50 documents and one epoch with `--keep-epochs`: minutes on a laptop CPU, proving the pipeline, not the model. It starts with the unit tests of `records.py` (`tests/`, standard-library `unittest`, no test dependency in `uv.lock`):

```sh
uv run --project desktop/scripts/train python -m unittest discover -s desktop/scripts/train/tests
```

Run 1 (27 October 2026, three epochs on a CPU) went through steps 4–7 on the Mac and did not ship: zero over-masking and far less need for the vetoes, but a rental contract's address leaks in the scanner's first window ([decision 0166](../../../docs/decisions/0166-first-fine-tuned-candidate-measured.md), with what the next run should change). The cause was in the exported set, not the windows: the PDF reader wraps that sentence and the address went out unlabelled, fixed in [decision 0167](../../../docs/decisions/0167-wrapped-values-labelled-across-paragraphs.md); run 2 exports the set again before training. Run 2 (28 October 2026, the same recipe on the corrected set) measured clean on seeds 1–26 and the owner's sets ([decision 0168](../../../docs/decisions/0168-second-candidate-measured-clean.md), with what shipping it takes).

## A full run on a cloud GPU

Only steps 2 and 3 need the GPU. Step 1 needs the repository, Node and the app's readers, and steps 4–6 need the installed shipping pack, so they run on the Mac; the GPU machine receives a bundle and returns a checkpoint. `train.py` and `prepare_general.py` pick the device themselves (`--device auto`: a CUDA GPU, then Apple's MPS, then the CPU), so the commands are the same everywhere.

**On the Mac: export and bundle.**

```sh
cd desktop
mise exec -- node scripts/export-training-set.mjs artifacts/train/run-1/set --train 100-131 --dev 132-135
tar -C .. -czf ~/offlinemask-train.tgz \
  --exclude desktop/scripts/train/.venv \
  desktop/scripts/train desktop/artifacts/train/base desktop/artifacts/train/run-1/set
```

The bundle is the pipeline, the base checkpoint (about 440 MB) and the exported set; it holds no real document, only generated ones.

**Google Cloud.** The free trial cannot attach a GPU: upgrade the billing account first (the remaining trial credit stays and is spent first), then under IAM → Quotas request `GPUs (all regions)` ≥ 1 and `NVIDIA L4 GPUs` ≥ 1 in one region (`asia-southeast1`, Singapore, is the nearest). New accounts are often refused or kept at 0 for a while; a refusal is the signal to use another provider, not to retry. With the quota granted, one L4 VM from a Deep Learning VM image with the driver preinstalled (the pinned torch 2.14 ships CUDA 13 libraries, which need driver 580 or newer; check the family still exists with `gcloud compute images describe-from-family`):

```sh
gcloud compute instances create offlinemask-train --zone=asia-southeast1-b \
  --machine-type=g2-standard-4 --accelerator=type=nvidia-l4,count=1 \
  --image-project=deeplearning-platform-release --image-family=common-cu129-ubuntu-2204-nvidia-580 \
  --boot-disk-size=100GB --maintenance-policy=TERMINATE --metadata=install-nvidia-driver=True
gcloud compute scp ~/offlinemask-train.tgz offlinemask-train:~ --zone=asia-southeast1-b
gcloud compute ssh offlinemask-train --zone=asia-southeast1-b
```

A g2-standard-4 costs under a dollar an hour; the run below is well under an hour, so the trial credit covers it many times over. Delete the VM when the checkpoint is back (`gcloud compute instances delete offlinemask-train --zone=asia-southeast1-b`).

**Oracle Cloud.** GPU shapes (`VM.GPU.A10.1`) have a service limit of 0 on trial accounts and the increase is usually refused until the account is upgraded to pay-as-you-go; if it is granted, the steps on the machine are the same as below with an Ubuntu GPU image.

**On the GPU machine.**

```sh
nvidia-smi                                            # driver 580 or newer
curl -LsSf https://astral.sh/uv/install.sh | sh && source ~/.local/bin/env
tar -xzf ~/offlinemask-train.tgz && cd desktop
uv sync --project scripts/train --extra general        # CUDA wheels, from uv.lock
uv run --project scripts/train scripts/train/prepare_general.py artifacts/train/run-1/general.jsonl --wikipedia 20000
uv run --project scripts/train scripts/train/train.py \
  --train artifacts/train/run-1/set/train.jsonl --dev artifacts/train/run-1/set/dev.jsonl \
  --general artifacts/train/run-1/general.jsonl --out artifacts/train/run-1 --epochs 3 --batch 16 --keep-epochs
tar -czf ~/run-1.tgz artifacts/train/run-1/checkpoint* artifacts/train/run-1/metrics.json
```

`train.py` prints `device: cuda` first; if it prints `cpu`, stop and fix the driver, since the run would take hours. The three epochs take 10–20 minutes on an L4. `metrics.json` holds the base model's dev table and every epoch's, which the decision for the candidate quotes; with `--keep-epochs` the archive holds every epoch (about 460 MB each), and steps 4–7 can be run on `checkpoint-<n>` as well as on `checkpoint`.

**Back on the Mac: export, pin, measure** (steps 4–6 above with `<out>` = `artifacts/train/run-1` after `gcloud compute scp offlinemask-train:~/run-1.tgz . && tar -xzf run-1.tgz`), then `pnpm eval:documents` on the 0153 set, the wider set and the owner's sets with `--definition`, and the gate. Those numbers decide whether the candidate ships; the dev table only says whether training worked.

**Without any cloud quota.** This Mac's GPU runs the same commands through MPS (`--device auto` picks it): the smoke epoch that took 55–60 s on the CPU takes under 20 s there, so the full run above is about an hour, overnight-safe, with no account at all. A free Google Colab T4 also runs the "on the GPU machine" block as is.

## Held-out rule

Seeds 1–7 (the 0153 set) and 8–26 (the wider set of 0160) are measured by every decision since; `tests/documents/training-set.mjs` refuses to export them and `tests/training-set.test.mjs` checks that it does. The owner's private sets are never generated and so never exported. A training run uses seeds from 100 up; dev seeds are separate from train seeds within the run.

## Labels

The hide list names values, not categories. `labelOf` in `tests/documents/training-set.mjs` reads the category off the value with the detection vocabulary (`src/core/detection/vocabulary/`): a value starting with a legal form or organization kind is an `ORGANIZATION`; a value starting with a house number or holding an address word (with its tone marks: "Ngô" is a family name, "ngõ" a lane) is a `LOCATION`; letters only, up to six syllables, is a `PERSON`; anything else (phones, identifiers, accounts, dates, e-mails, codes) is left unlabelled because the structured rules hide those, not the models. `summary.json` counts each class and lists any labelled value the reader did not reproduce.

## Licence

The base model and the fine-tuned result are Apache-2.0; the pack's `attribution` and the installer's `LICENSE` file stay as they are, and a published candidate records its provenance (repository, revision, this pipeline, the seeds) in its decision. Wikipedia text is CC BY-SA 4.0 and is used as training input only; it is never redistributed, and no model file carries it.
