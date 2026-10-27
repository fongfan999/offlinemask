# Pack comparison harness, smoke run (27 October 2026)

`pnpm -C desktop compare:packs --seeds 1-1 --folder ~/OfflineMask-eval/invoices --ablate capitalHeadings,wordingColumns` (decision 0164), with the installed shipping pack `vietnamese-pii-v1` and no candidate: seed 1 of the wider synthetic set (78 documents, decision 0160) and the owner's ten invoices (decision 0152). Three runs in 152 s on an M1 Pro (43–57 s each). Cells read not read / leaked / over-masked / unlisted.

| Run | seed 1 (78) | invoices (10) | All |
| --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| shipping without capitalHeadings | 0 / 0 / 25 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 25 / 0 |
| shipping without wordingColumns | 0 / 0 / 12 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 12 / 0 |

Both mechanisms are still needed by the shipping pack: without `capitalHeadings` the headings in capitals of 0156 and 0160 come back (a statement's title, a CV's section headings, a confirmation letter's title, a utility bill's title, a police officer's role in capitals), and without `wordingColumns` the cells under "Quan hệ", "Chức vụ", "Tên hàng hóa" and a transcript's subject column come back (relations, positions, goods, subjects, blood-test items). The invoices were untouched by either ablation. No leak came back in either run.

The run is a smoke test of the harness, not a measurement of a candidate: it shows the table a candidate's decision will quote and that the per-mechanism verdict says which values returned. The real run waits for the first fine-tuned candidate of 0163, with `--candidate`, seeds 1–7 and every private set.

## Full ablation of the shipping pack (27 October 2026)

`pnpm -C desktop compare:packs --seeds 1-7 --ablate` with no candidate: the shipping pack, then each of the twelve mechanisms switched off in turn, on seeds 1–7 of the wider set (546 documents) and the owner's two private folders (ten invoices, one decision). Thirteen runs in 2 939 s on an M1 Pro, 209–251 s each. Cells read not read / leaked / over-masked / unlisted.

| Run | seed 1 (78) | seed 2 (78) | seed 3 (78) | seed 4 (78) | seed 5 (78) | seed 6 (78) | seed 7 (78) | decisions (1) | invoices (10) | All |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| shipping | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| shipping without phrases | 0 / 0 / 22 / 19 | 0 / 0 / 30 / 17 | 0 / 0 / 27 / 14 | 0 / 0 / 26 / 15 | 0 / 0 / 26 / 17 | 0 / 0 / 27 / 14 | 0 / 0 / 29 / 21 | 0 / 0 / 3 / 0 | 0 / 0 / 2 / 0 | 0 / 0 / 192 / 117 |
| shipping without publicBodies | 0 / 0 / 24 / 0 | 0 / 0 / 27 / 0 | 0 / 0 / 23 / 0 | 0 / 0 / 27 / 0 | 0 / 0 / 22 / 0 | 0 / 0 / 26 / 0 | 0 / 0 / 26 / 0 | 0 / 0 / 7 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 182 / 0 |
| shipping without issuePlaces | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 1 | 0 / 0 / 12 / 0 | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 85 / 1 |
| shipping without productCells | 0 / 0 / 9 / 1 | 0 / 0 / 2 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 5 / 0 | 0 / 0 / 4 / 2 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 20 / 3 |
| shipping without wordingColumns | 0 / 0 / 12 / 0 | 0 / 0 / 12 / 0 | 0 / 0 / 17 / 0 | 0 / 0 / 11 / 0 | 0 / 0 / 5 / 0 | 0 / 0 / 9 / 0 | 0 / 0 / 11 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 77 / 0 |
| shipping without transactionCells | 0 / 0 / 12 / 1 | 0 / 0 / 14 / 0 | 0 / 0 / 13 / 0 | 0 / 0 / 14 / 0 | 0 / 0 / 14 / 0 | 0 / 0 / 12 / 1 | 0 / 0 / 14 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 93 / 2 |
| shipping without capitalHeadings | 0 / 0 / 25 / 0 | 0 / 0 / 28 / 0 | 0 / 0 / 20 / 0 | 0 / 0 / 27 / 0 | 0 / 0 / 18 / 0 | 0 / 0 / 22 / 0 | 0 / 0 / 27 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 167 / 0 |
| shipping without departments | 0 / 0 / 13 / 0 | 0 / 0 / 9 / 0 | 0 / 0 / 8 / 0 | 0 / 0 / 13 / 1 | 0 / 0 / 11 / 0 | 0 / 0 / 9 / 0 | 0 / 0 / 10 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 73 / 1 |
| shipping without wordingFields | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| shipping without capitalRoles | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| shipping without trims | 0 / 0 / 1 / 0 | 0 / 0 / 0 / 0 | 0 / 1 / 0 / 0 | 0 / 2 / 1 / 0 | 0 / 2 / 1 / 0 | 0 / 1 / 2 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 6 / 5 / 0 |
| shipping without singleWords | 0 / 0 / 2 / 0 | 0 / 0 / 4 / 3 | 0 / 0 / 4 / 0 | 0 / 0 / 4 / 3 | 0 / 0 / 1 / 4 | 0 / 0 / 2 / 0 | 0 / 0 / 6 / 3 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 3 | 0 / 0 / 23 / 16 |

What each mechanism holds back, from the values the ablation printed (synthetic ones; the private folders moved only under `phrases`, two over-masks on the invoices, and `singleWords`, three unlisted one-word masks):

- **phrases** (192 over, 117 unlisted): page numbers ("Trang 1/2"), the national header and motto, the recipients line of an official decision ("- Như Điều 4; - Lưu: VT"), a document's "Số" label.
- **publicBodies** (182 over): the issuing bodies and their jurisdictions in decisions, confirmations and minutes.
- **issuePlaces** (85 over): the place before the date line of every official document.
- **capitalHeadings** (167 over), **wordingColumns** (77 over), **transactionCells** (93 over), **departments** (73 over), **productCells** (20 over): the families of 0156 and 0160, each still carrying its own documents.
- **trims** (6 leaked, 5 over): the only mechanism whose removal leaks. Without the brand and unit trimming at a span's edges, an address a model found with a unit's name stuck to it is refused whole by a later check, and the address goes unmasked (payslips and order receipts).
- **singleWords** (23 over, 16 unlisted): one-word spans without a confident score, in every kind.
- **wordingFields** and **capitalRoles** brought nothing back on their own: every span they veto is also vetoed by another mechanism (`phrases` or `departments` for a value after a wording label; `capitalHeadings` for a role in capitals). A grouped run (below) says whether they are redundant or only overlapped.

## Grouped ablation of the two overlapped mechanisms

`pnpm -C desktop compare:packs --seeds 1-7 --ablate capitalHeadings+capitalRoles,wordingFields+phrases,wordingFields+departments`, four runs in 916 s, the same sets:

| Run | Over-masked, all sets | Unlisted, all sets |
| --- | --- | --- |
| shipping | 0 | 0 |
| without capitalHeadings+capitalRoles | 308 | 0 |
| without wordingFields+phrases | 193 | 117 |
| without wordingFields+departments | 75 | 1 |

Against the single ablations (`capitalHeadings` alone 167, `phrases` alone 192, `departments` alone 73): `capitalRoles` holds back 141 spans across the seven seeds that `capitalHeadings` also holds back, and nothing of its own, so the two cover each other completely; `wordingFields` adds one span beyond `phrases` and two beyond `departments` in 546 documents. Both are candidates for retirement from the shipping pack as it is, before any new model: the decision that removes them quotes these counts.

## After decision 0165

With `capitalRoles` and `wordingFields` removed from the policy, `pnpm -C desktop compare:packs --seeds 1-7` on the same sets (seeds 1–7, 546 documents; the owner's invoices and decision): 0 not read, 0 leaked, 0 over-masked, 0 unlisted everywhere, in 311 s. The harness now lists ten mechanisms.
