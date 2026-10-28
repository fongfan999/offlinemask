# Two more mechanisms retired (28 October 2026)

The measurements of [decision 0170](../decisions/0170-two-more-mechanisms-retired.md), all on the shipped fine-tuned graph installed on the Mac (`e562a9b38c4bc14f14a2187f78fe5fd0a213d36ad0012c8d7144c0cac5af9a10`, decision 0169), on an M1 Pro. Cells read not read / leaked / over-masked / unlisted. The one count in every table is the bank's name ("Ngân hàng BIDV") in the `hide` list of a draft expectation in the owner's invoice folder, which decision 0166 explained; it is not a leak of the model's and the owner's review of that draft turns it to zero.

## Before the change: the two mechanisms switched off

`pnpm -C desktop compare:packs --pack <installed root> --seeds 1-7 --ablate transactionCells,trims`: three runs over seeds 1–7 of the wider set (546 documents) and the owner's two folders, three runs in 845 s (265–315 s each).

| Run | seed 1 (78) | seed 2 (78) | seed 3 (78) | seed 4 (78) | seed 5 (78) | seed 6 (78) | seed 7 (78) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |
| shipping without transactionCells | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |
| shipping without trims | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |

Neither mechanism brings anything back on this graph: the counts of all three runs are the shipped baseline's. (For the base model on 27 October, `transactionCells` held back 93 over-masked and 2 unlisted spans, and `trims` 6 leaked and 5 over-masked.)

## After the change

`pnpm -C desktop compare:packs --pack <installed root> --seeds 1-7`, one run in 236 s:

| Run | seed 1 (78) | seed 2 (78) | seed 3 (78) | seed 4 (78) | seed 5 (78) | seed 6 (78) | seed 7 (78) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 0 / 0 |

`pnpm -C desktop compare:packs --pack <installed root> --seeds 8-26`, one run over 1 482 documents plus the owner's sets in 660 s:

| Run | seed 8 (78) | seed 9 (78) | seed 10 (78) | seed 11 (78) | seed 12 (78) | seed 13 (78) | seed 14 (78) | seed 15 (78) | seed 16 (78) | seed 17 (78) | seed 18 (78) | seed 19 (78) | seed 20 (78) | seed 21 (78) | seed 22 (78) | seed 23 (78) | seed 24 (78) | seed 25 (78) | seed 26 (78) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 1 / 3 / 0 |

Both tables are the shipped baseline's: the per-seed row of `desktop/artifacts/compare/2026-10-28-shipped-e562a9b3/report.md` for seeds 1–7, and the candidate's row of [2026-10-28-candidate-run-2.md](2026-10-28-candidate-run-2.md) for seeds 8–26 (the same three job titles over-masked: "Chuyên viên nhân sự" in the application forms of seeds 13 and 15, "Kỹ sư phần mềm" in the labour contract of seed 20). The harness now lists eight mechanisms.
