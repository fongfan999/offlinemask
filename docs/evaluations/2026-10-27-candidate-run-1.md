# First fine-tuned candidate, run 1 (27 October 2026)

The first full training run of decision 0163, done by the owner on a Windows machine, measured on the Mac with the pipeline's steps 4–7 ([decision 0166](../decisions/0166-first-fine-tuned-candidate-measured.md)). Nothing shipped: the candidate leaks.

## The run

`train.py` on the CPU (12 threads; `--device auto` found no GPU), 3 873 synthetic windows (the README's recipe: seeds 100–131 as train, 132–135 as dev; the exported set itself was not in the archive, the window count matches it), 486 dev windows, 8 000 general paragraphs mixed at 0.5 a synthetic window (1 937 an epoch), batch 8, learning rate 3e-5, 384-token windows, three epochs of 6 688, 6 728 and 6 316 s: 5 h 29 min. `metrics.json`, dev split, exact spans:

| Epoch | All P / R / F1 | PERSON F1 | LOCATION P / R / F1 | ORGANIZATION P / R / F1 | Kept texts touched |
| --- | --- | --- | --- | --- | --- |
| 0 (base model) | 0.057 / 0.316 / 0.096 | 0.138 | 0.000 / 0.000 / 0.000 | 0.064 / 0.339 / 0.108 | 35.5 % |
| 1 | 0.810 / 0.997 / 0.894 | 0.995 | 0.796 / 0.991 / 0.883 | 0.438 / 1.000 / 0.609 | 0.02 % |
| 2 | 0.780 / 1.000 / 0.877 | 0.996 | 0.730 / 1.000 / 0.844 | 0.406 / 1.000 / 0.577 | 0 |
| 3 | 0.805 / 0.9995 / 0.892 | 0.996 | 0.772 / 0.998 / 0.870 | 0.436 / 1.000 / 0.607 | 0 |

`train.py` keeps the epoch with the best overall F1, so the checkpoint is epoch 1.

## Export and gate

`export_pack.py`: the FP32 graph matches PyTorch within 1.3e-5; the INT8 graph differs from PyTorch by up to 1.1 in logits on one random window (the smoke test of 0163 did not record this number for comparison); 204.6 MB, the shipping graph's size. `pack:prepare` pinned four files into `candidate.json` with the installed pack's OpenMed directory linked beside them; `check-pack.mjs --definition` loaded both models offline in 3.65 s and passed 23/23 fixtures.

## Comparison

`pnpm -C desktop compare:packs --candidate artifacts/train/run-1/pack/candidate.json --candidate-root artifacts/train/run-1/pack --seeds 1-7 --ablate`: twelve runs in 2 904 s on an M1 Pro over seeds 1–7 of the wider set (546 documents) and the owner's invoices and decision. Cells read not read / leaked / over-masked / unlisted.

| Run | seed 1 (78) | seed 2 (78) | seed 3 (78) | seed 4 (78) | seed 5 (78) | seed 6 (78) | seed 7 (78) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| candidate | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 0 / 0 |
| candidate without phrases | 0 / 1 / 1 / 0 | 0 / 0 / 2 / 0 | 0 / 1 / 2 / 0 | 0 / 0 / 2 / 1 | 0 / 1 / 7 / 1 | 0 / 1 / 4 / 0 | 0 / 0 / 6 / 2 | 0 / 0 / 1 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 25 / 4 |
| candidate without publicBodies | 0 / 1 / 12 / 0 | 0 / 0 / 7 / 0 | 0 / 1 / 10 / 0 | 0 / 0 / 6 / 0 | 0 / 1 / 13 / 0 | 0 / 1 / 10 / 0 | 0 / 0 / 10 / 0 | 0 / 0 / 4 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 72 / 0 |
| candidate without issuePlaces | 0 / 1 / 4 / 0 | 0 / 0 / 1 / 0 | 0 / 1 / 4 / 0 | 0 / 0 / 4 / 0 | 0 / 1 / 3 / 0 | 0 / 1 / 6 / 1 | 0 / 0 / 2 / 0 | 0 / 0 / 1 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 25 / 1 |
| candidate without productCells | 0 / 1 / 3 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 1 / 0 | 0 / 1 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 5 / 0 |
| candidate without wordingColumns | 0 / 1 / 2 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 1 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 1 / 0 | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 5 / 0 |
| candidate without transactionCells | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 0 / 0 |
| candidate without capitalHeadings | 0 / 1 / 3 / 0 | 0 / 0 / 6 / 0 | 0 / 1 / 3 / 0 | 0 / 0 / 5 / 0 | 0 / 1 / 3 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 22 / 0 |
| candidate without departments | 0 / 1 / 3 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 3 / 0 | 0 / 1 / 3 / 0 | 0 / 1 / 2 / 0 | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 13 / 0 |
| candidate without trims | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 5 / 0 / 0 |
| candidate without singleWords | 0 / 1 / 3 / 0 | 0 / 0 / 6 / 2 | 0 / 1 / 3 / 0 | 0 / 0 / 4 / 3 | 0 / 1 / 4 / 4 | 0 / 1 / 2 / 0 | 0 / 0 / 6 / 1 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 3 | 0 / 5 / 28 / 13 |

What each mechanism holds back for the candidate, against the shipping pack's ablation of the same day (over-masked / unlisted over all sets):

| Mechanism | Shipping pack | Candidate |
| --- | --- | --- |
| phrases | 192 / 117 | 25 / 4 |
| publicBodies | 182 / 0 | 72 / 0 |
| issuePlaces | 85 / 1 | 25 / 1 |
| productCells | 20 / 3 | 5 / 0 |
| wordingColumns | 77 / 0 | 5 / 0 |
| transactionCells | 93 / 2 | 0 / 0 |
| capitalHeadings | 167 / 0 | 22 / 0 |
| departments | 73 / 1 | 13 / 0 |
| trims | 6 leaked, 5 / 0 | 0 / 0 |
| singleWords | 23 / 16 | 28 / 13 |

Two mechanisms bring nothing back for this model (`transactionCells`, `trims`), seven hold back a fraction of what they hold back for the shipping model, and `singleWords` is unchanged: a one-word span without a confident score is as frequent from the fine-tuned model as from the base one.

## The five leaks

Four are one document each on seeds 1, 3, 5 and 6: the rental contract, the premises' address in the form "Số 48 Huỳnh Văn Bánh, Phường Hoàn Kiếm, Thành phố Hà Nội, Việt Nam" (the generator's second address form, with "Số" and the country), in the opening sentence "Hôm nay, ngày …, tại <address>, chúng tôi gồm:". The same address in Điều 1 of the same document is masked whole. Every leaked street is named after a person (Huỳnh Văn Bánh, Lê Lợi, Nguyễn Thị Minh Khai, Phan Đình Phùng).

The fifth is the owner's invoice folder: a bank's name, in the `hide` list of a draft expectation that `--draft` generated from what the shipping pack masks. A bank's name is not private and the reviewed expectations list banks under `ignore`; the owner's review of that draft resolves it. It is not a leak of the model's, but the count stays in the table because the folder is measured as it is.

Diagnosis of the four, with the fine-tuned Underthesea model loaded alone through the pack contract:

| Text given to the model | Its span for the address | Score |
| --- | --- | --- |
| the paragraph alone | the whole address | 1.00 |
| with 1–4 paragraphs before (the national header, the title, the number) | the whole address | 0.96–1.00 |
| with 2 paragraphs after | the whole address | 1.00 |
| the first 300–400 characters of the scanner's first window | "Huỳnh Văn Bánh, …, Việt Nam" | 0.83–0.86 |
| the first 600 | "Bánh, Phường Hoàn Kiếm, Thành phố Hà Nội" | 0.64 |
| the first 800 | "Bánh, Phường Hoàn Kiếm, Thành phố" | 0.58 |
| the scanner's whole first window (1 198 characters: the header, this sentence, both parties' name, identifier, address, phone, e-mail and account fields, Điều 1) | "Bánh, Phường Hoàn Kiếm" | 0.56 |

The shipping model gives the whole address at 1.00 in the same window; the FP32 graph of the candidate gives the same fragment as the INT8 one, so quantization is not the cause. The span shrinks from the front as the window fills with the parties' name fields: the model reads the person-named street less and less as an address. The address completion rule then extends the fragment to "Số 48 … Hà Nội"; the trailing ", Việt Nam" stays readable, and the value counts as leaked.
