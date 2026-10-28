# Fine-tuned candidate, run 2 (28 October 2026)

The second full training run of decision 0163, done by the owner on the same Windows machine as run 1, on a set exported after the exporter fix of decision 0167, measured on the Mac with the pipeline's steps 4–7 ([decision 0168](../decisions/0168-second-candidate-measured-clean.md)). No leak and no over-masking on 2 050 held-out documents; the one count left is a bank's name in a draft expectation.

## The run

`train.py` on the CPU again (12 threads, no GPU found), the README's recipe: seeds 100–131 as train (2 496 documents, 46 996 paragraphs, two variants) and 132–135 as dev (312 documents), exported on 28 October at 00:16 (+07), twelve minutes after decision 0167 landed, so the wrapped rental addresses are labelled; `summary.json` reports no unmatched value. 3 873 packed training windows, 486 dev windows, run 1's 8 000 general paragraphs reused at ratio 0.5 (1 937 an epoch), batch 8, learning rate 3e-5, seed 20261027, `--keep-epochs`. Three epochs of 7 213, 7 098 and 7 104 s: 5 h 57 min. `metrics.json`, dev split, exact spans:

| Epoch | All P / R / F1 | PERSON F1 | LOCATION P / R / F1 | ORGANIZATION P / R / F1 | Kept texts touched |
| --- | --- | --- | --- | --- | --- |
| 0 (base model) | 0.057 / 0.316 / 0.096 | 0.138 | 0.000 / 0.000 / 0.000 | 0.064 / 0.339 / 0.108 | 35.5 % |
| 1 | 0.794 / 1.000 / 0.885 | 0.995 | 0.767 / 1.000 / 0.868 | 0.418 / 1.000 / 0.590 | 0.04 % |
| 2 | 0.786 / 1.000 / 0.880 | 0.996 | 0.695 / 1.000 / 0.820 | 0.437 / 1.000 / 0.608 | 0 |
| 3 | 0.793 / 1.000 / 0.885 | 0.998 | 0.696 / 1.000 / 0.821 | 0.449 / 1.000 / 0.620 | 0 |

Recall is 1.000 for every label at every epoch; `best_epoch` is 1 (overall F1 0.885, with epoch 3 a hair behind), and `checkpoint-1`, `-2` and `-3` are all in the archive. Precision on dev stays where run 1 had it: the model over-predicts organizations and, less, locations on dev, and the policy absorbs that in the app (no over-masking below).

Before export, the PyTorch checkpoints of epoch 1 and epoch 3 were run on the first packed window of the rental contracts of seeds 1, 2, 3, 5, 6 and 100, the shape that leaked in run 1: every premises address is found whole, in the Word files and in the PDFs where the span now runs across the paragraph separator ("…, Việt\n\nNam").

## Export and gate

`export_pack.py` on `checkpoint` (epoch 1): ONNX at opset 18, INT8 graph of 204.6 MB, the shipping graph's size (the PyTorch comparison lines were not kept in this run's log). `pack:prepare` pinned four files into `candidate.json` with the installed pack's OpenMed directory linked beside them; `check-pack.mjs --definition` passed 23/23 fixtures. The candidate's files stay under `desktop/artifacts/train/run-2/` (ignored by git): `checkpoint*/`, `metrics.json`, `set/summary.json` and `pack/`.

## Comparison on seeds 1–7 with ablation

`pnpm -C desktop compare:packs --candidate artifacts/train/run-2/pack/candidate.json --candidate-root artifacts/train/run-2/pack --seeds 1-7 --ablate`: twelve runs in 2 803 s on an M1 Pro over seeds 1–7 of the wider set (546 documents) and the owner's invoices and decision. Cells read not read / leaked / over-masked / unlisted.

| Run | seeds 1–7 (546) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| candidate | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |
| candidate without phrases | 0 / 0 / 24 / 3 | 0 / 0 / 1 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 25 / 3 |
| candidate without publicBodies | 0 / 0 / 73 / 0 | 0 / 0 / 4 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 77 / 0 |
| candidate without issuePlaces | 0 / 0 / 26 / 1 | 0 / 0 / 1 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 27 / 1 |
| candidate without productCells | 0 / 0 / 6 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 6 / 0 |
| candidate without wordingColumns | 0 / 0 / 5 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 5 / 0 |
| candidate without transactionCells | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |
| candidate without capitalHeadings | 0 / 0 / 21 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 21 / 0 |
| candidate without departments | 0 / 0 / 14 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 14 / 0 |
| candidate without trims | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |
| candidate without singleWords | 0 / 0 / 28 / 11 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 3 | 0 / 1 / 28 / 14 |

The per-seed table is in `desktop/artifacts/compare/2026-10-28-candidate-run-2/report.md`. What each mechanism holds back (over-masked / unlisted over all sets), beside the shipping pack's ablation of 27 October and run 1's:

| Mechanism | Shipping pack | Run 1 | Run 2 |
| --- | --- | --- | --- |
| phrases | 192 / 117 | 25 / 4 | 25 / 3 |
| publicBodies | 182 / 0 | 72 / 0 | 77 / 0 |
| issuePlaces | 85 / 1 | 25 / 1 | 27 / 1 |
| productCells | 20 / 3 | 5 / 0 | 6 / 0 |
| wordingColumns | 77 / 0 | 5 / 0 | 5 / 0 |
| transactionCells | 93 / 2 | 0 / 0 | 0 / 0 |
| capitalHeadings | 167 / 0 | 22 / 0 | 21 / 0 |
| departments | 73 / 1 | 13 / 0 | 14 / 0 |
| trims | 6 leaked, 5 / 0 | 0 / 0 | 0 / 0 |
| singleWords | 23 / 16 | 28 / 13 | 28 / 14 |

The same picture as run 1 within a few counts: `transactionCells` and `trims` bring nothing back, seven mechanisms hold back a fraction of what they hold back for the shipping model, `singleWords` is unchanged.

## The wider set, seeds 8–26

`compare:packs --candidate … --seeds 8-26` without ablation: two runs in 1 093 s over 1 482 documents plus the owner's sets (1 493 in all).

| Run | seeds 8–26 (1 482) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 5 / 6 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 5 / 6 |
| candidate | 0 / 0 / 3 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 3 / 0 |

The candidate's three over-masked texts are three of the shipping pack's five, the same job titles in the same documents ("Chuyên viên nhân sự" in the application forms of seeds 13 and 15, "Kỹ sư phần mềm" in the labour contract of seed 20). The shipping pack's other two ("Nhân viên kho", "Hoàn tạm ứng công tác") and its six unlisted one-word masks ("phòng" five times, "LẦN") do not occur with the candidate.

## The one count

The owner's invoice folder: a bank's name ("Ngân hàng BIDV") in the `hide` list of a draft expectation that `--draft` generated from what the shipping pack masks (0166 §The five leaks). The reviewed expectations list banks under `ignore`; the owner's review of that draft turns the table to all zeros. It is not a leak of the model's.
