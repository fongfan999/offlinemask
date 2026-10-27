# Pack comparison harness, smoke run (27 October 2026)

`pnpm -C desktop compare:packs --seeds 1-1 --folder ~/OfflineMask-eval/invoices --ablate capitalHeadings,wordingColumns` (decision 0164), with the installed shipping pack `vietnamese-pii-v1` and no candidate: seed 1 of the wider synthetic set (78 documents, decision 0160) and the owner's ten invoices (decision 0152). Three runs in 152 s on an M1 Pro (43–57 s each). Cells read not read / leaked / over-masked / unlisted.

| Run | seed 1 (78) | invoices (10) | All |
| --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| shipping without capitalHeadings | 0 / 0 / 25 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 25 / 0 |
| shipping without wordingColumns | 0 / 0 / 12 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 12 / 0 |

Both mechanisms are still needed by the shipping pack: without `capitalHeadings` the headings in capitals of 0156 and 0160 come back (a statement's title, a CV's section headings, a confirmation letter's title, a utility bill's title, a police officer's role in capitals), and without `wordingColumns` the cells under "Quan hệ", "Chức vụ", "Tên hàng hóa" and a transcript's subject column come back (relations, positions, goods, subjects, blood-test items). The invoices were untouched by either ablation. No leak came back in either run.

The run is a smoke test of the harness, not a measurement of a candidate: it shows the table a candidate's decision will quote and that the per-mechanism verdict says which values returned. The real run waits for the first fine-tuned candidate of 0163, with `--candidate`, seeds 1–7 and every private set.
