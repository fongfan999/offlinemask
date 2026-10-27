# 0166 — The first fine-tuned candidate is measured and not shipped

Date: 27 October 2026. Status: measured; the shipping pack is unchanged. Owner: "I just downloaded here, please do it for me" (the `run-1.tgz` of the first full training run of decision 0163, done on their Windows machine).

## What was done

The pipeline's steps 4–7 on the Mac, as `scripts/train/README.md` lists them: the checkpoint exported to an INT8 ONNX graph with the shipping pack's tokenizer files, pinned as a candidate pack beside the installed OpenMed model, loaded through the pack contract against the gate fixtures (23/23), then `pnpm compare:packs --candidate … --seeds 1-7 --ablate`: the shipping pack, the candidate, and the candidate with each of the ten structural mechanisms switched off in turn, over 557 held-out documents. The numbers are in [docs/evaluations/2026-10-27-candidate-run-1.md](../evaluations/2026-10-27-candidate-run-1.md). The candidate's files stay under `desktop/artifacts/train/run-1/` (ignored by git): `checkpoint/`, `metrics.json`, `pack/` (the candidate) and `fp32/` (a diagnostic pack with the unquantized graph).

## Provenance

Base `undertheseanlp/vietnamese-ner-v1.4.0a2` at revision `a51e05fc…` (Apache-2.0), the pipeline of 0163 at the commit the owner's checkout had, the README's recipe (seeds 100–131 as train, 132–135 as dev, as far as the window counts tell; the exported set was not in the archive), 8 000 general paragraphs at ratio 0.5, three epochs on a CPU in 5 h 29 min, seed 20261027. `train.py` kept epoch 1, the best overall F1 on the dev split (0.894; the base model scores 0.096 on the same windows, and touches 35.5 % of the kept texts against 0.02 %).

## What the table says

- **Over-masking**: zero everywhere, like the shipping pack, and the candidate needs the vetoes far less. Switched off one at a time, `transactionCells` and `trims` bring nothing back (93 and 5 over-masks and 6 leaks for the shipping model); `phrases` holds back 25 spans against 192, `capitalHeadings` 22 against 167, `wordingColumns` 5 against 77, `publicBodies` 72 against 182, `issuePlaces` 25 against 85, `departments` 13 against 73, `productCells` 5 against 20. Only `singleWords` is unchanged (28 against 23): the fine-tuned model emits one-word spans without a confident score as often as the base one.
- **Leaks**: five, where the shipping pack has none. Four are the same value in four documents: a rental contract's premises address in the "Số …, Việt Nam" form, on a street named after a person, in the contract's opening sentence. The fifth is a bank's name in a draft expectation on the owner's invoices, generated from what the shipping pack masks; a bank's name is not private, and the owner's review of that draft moves it to `ignore`.

## Why the four leak

The evaluation record has the measurement: the model reads the whole address at 1.00 when the paragraph is alone or has a few paragraphs around it, and loses the front of it as the scanner's first window (1 200 characters) fills with the two parties' name, identifier, address and contact fields, down to "Bánh, Phường Hoàn Kiếm" at 0.56 for the full window. The FP32 graph does the same, so quantization is not it; the shipping model reads the whole address in the same window. The completion rule extends the fragment to the city, and ", Việt Nam" stays readable. It is a weakness of this checkpoint in exactly the context the app gives it, a long window of a document's header and fields, which the dev split, measured window by window the same way, did not catch: LOCATION recall there is 0.991 at epoch 1.

## Decision

The candidate does not ship and no mechanism retires on its account: the rule since 0152 is that a change may not leak where the shipping pack does not, on the held-out seeds and the owner's documents. The run is still the result 0163 asked for: it shows the vetoes can shrink to a fraction once the model knows these documents, and it gives the next run a precise target.

## What the next run should change

1. **Keep every epoch**, or choose by recall. `train.py` saves the epoch with the best overall F1, which the organization class's precision dominates (0.44 at every epoch: the model over-predicts organizations on dev, which the policy then absorbs, since over-masking is zero). Epoch 3 had LOCATION recall 0.998 and no kept text touched; it was discarded. `train.py --keep-epochs` now leaves `checkpoint-<n>` beside the best (`checkpoint_dirs` in `records.py`, unit-tested in `scripts/train/tests/`, exercised by `smoke.sh`), and `metrics.json` names the `best_epoch`; the comparison can then run on any epoch.
2. **Run on a GPU or on this Mac's MPS** (0163 §Device): the CPU run took 5.5 h with 8 000 general paragraphs, not the README's 20 000; the full slice and more epochs are an hour on an L4 or overnight on this Mac.
3. **Measure the exact failing shape before export**: a dev window built as the scanner builds it, the document's first 1 200 characters, with the premises address of a rental contract in it. `export-training-set.mjs` writes paragraphs; `train.py` packs them to 384 tokens, which is about the scanner's window, so the shape is in the training data, and more epochs or the full general slice may be all it takes. If not, the generator's rental layout is the place to add variants of the opening sentence.
4. The owner's draft expectation on the invoice with the bank's name is reviewed on the owner's side; the candidate's table then reads 4 leaks, not 5.
