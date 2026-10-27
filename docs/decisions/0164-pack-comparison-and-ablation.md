# 0164 — One command compares a candidate pack with the shipping one and asks which mechanisms it still needs

Date: 27 October 2026. Status: implemented. Owner, with the 2.3.0 Store submission and the first training run (0163) under way: "build the shipping-versus-candidate comparison harness with the per-veto ablation here."

## Why

Decision 0163 ends with two measurements that decide whether a fine-tuned candidate ships: the held-out sets must not regress, and "then the vetoes shrink, one mechanism at a time, each removal measured on the same sets". Until now that meant running `eval:documents` by hand once per set and per pack, and switching a mechanism off meant editing `model-policy.ts`. The decision for the candidate should be written from one table, not from spot checks, and the mechanisms must be switchable without touching the code the app ships.

## What was built

1. **Mechanisms by name** (`src/core/detection/vetoes.ts`). The twelve mechanisms that veto or trim a model's name, place or organization in `plausibleModelDetections` each have a name: `phrases`, `publicBodies`, `issuePlaces`, `productCells`, `wordingColumns`, `transactionCells`, `capitalHeadings`, `departments`, `wordingFields`, `capitalRoles`, `trims` (brands and units at a span's edges) and `singleWords` (the score rule of 0081). `setVetoes([...])` switches some off for a measurement; the app never calls it, so nothing changes for a user. The sanity checks of `plausibleContextualSpan` (letters, a contract party, a country, a currency) are not mechanisms: a span that fails them is no name whatever model produced it.
2. **One measurement core** (`scripts/document-evaluation.mjs`). What `evaluate-documents.mjs` did inline (list the documents, open and mask each through the app's own path, bucket every expectation as not read, leaked, over-masked or unlisted, draft a list, total) is a module both scripts use. `pnpm eval:documents` prints and reports exactly what it did; the private set's report was rerun before and after and did not change.
3. **The comparison** (`pnpm -C desktop compare:packs`, `scripts/compare-packs.mjs`):

   ```
   mise exec -- pnpm compare:packs [--candidate <candidate.json> --candidate-root <root>]
       [--pack <root>] [--seeds 1-7] [--folder <path>]... [--ablate [a,b,c+d]] [--out <dir>]
   ```

   The sets are the held-out synthetic seeds (1–7 by default, written once under `artifacts/compare/seed-<n>`, the same bytes every time) and every subfolder of `~/OfflineMask-eval` (the owner's real documents, 0152), or the `--folder` paths given. The runs are the shipping pack (the installed one, or `--pack`), the candidate when given, and with `--ablate` one run per mechanism with that mechanism off, on the candidate or, without one, on the shipping pack. A group written `capitalHeadings+capitalRoles` goes off together in one run, because two mechanisms that cover the same spans (a heading in capitals read as a person is both) show nothing when removed one at a time. Every run reads the same documents through the same detector; a candidate's pack definition is read as `check-pack.mjs --definition` reads it. The console shows each run's totals per set, the values an ablation brought back, and one Markdown table at the end; `report.json` (counts and values, under `artifacts/`, never committed) and `report.md` (counts only, fit for `docs/evaluations/`) are written under `--out`. The pure parts (`compare-packs-report.mjs`: the plan of runs, the verdict per mechanism, the Markdown) are unit-tested without models.
4. **The verdict.** A mechanism the pack no longer needs is one whose removal brings back nothing on any set: no leak, no over-masking and no unlisted mask over the run it ablates. Anything it brings back is listed per set, so the decision that retires a mechanism quotes the counts and the vocabulary file stays for what the model still gets wrong.

## Cost

Each run reads every document again: the policy sits behind the models inside the pack, so an ablation cannot reuse the models' output. Seed 1 of the wider set (78 documents) and the owner's invoices take about 90 s per run on an M1 Pro; seeds 1–7 with the private sets about ten minutes per run, so a full ablation of twelve mechanisms on top of the two packs is about two and a half hours in the background. `--seeds` narrows a first look.

## Result

[The smoke run](../evaluations/2026-10-27-pack-comparison.md) on the shipping pack (no candidate exists yet) measured seed 1 and the owner's invoices with two mechanisms ablated. The numbers say what the harness is for: with everything on, 0 leaked and 0 over-masked on 88 documents; switch `capitalHeadings` off and 25 headings of 0156 and 0160 come back over-masked; switch `wordingColumns` off and 12 relations, positions, goods and subjects come back; the invoices move in neither run, and no leak returns. The full ablation of the shipping pack followed (thirteen runs over 557 documents, 49 minutes, in the same evaluation): ten of the twelve mechanisms still hold back over-masking in every synthetic seed (`phrases` 192, `publicBodies` 182, `capitalHeadings` 167, `transactionCells` 93, `issuePlaces` 85, `wordingColumns` 77, `departments` 73, `singleWords` 23, `productCells` 20 over the seven seeds); `trims` is the only one whose removal leaks (six addresses); `wordingFields` and `capitalRoles` brought nothing back on their own, because every span they veto is also vetoed by another mechanism; the grouped runs then showed that `capitalRoles` and `capitalHeadings` cover each other completely (141 spans over the seven seeds held back by both, none by `capitalRoles` alone) and that `wordingFields` adds three spans in 546 documents beyond `phrases` and `departments`, so both could retire from the shipping pack today, which is a decision of its own. The private folders moved only under `phrases` and `singleWords`. This is the baseline a candidate is measured against: a mechanism retires when the candidate's run without it brings nothing back. When the first candidate arrives from the training run, the same command with `--candidate` and `--ablate` writes that table.

## Limits

- Overlapping mechanisms need a `+` group to show their joint effect; the harness does not search pairs by itself.
- The verdict counts only what the lists know. A candidate that masks something new and right shows as "unlisted", the same as something new and wrong; the values printed on the console are there to tell them apart, and a value that is right goes into the generator's lists.
- The candidate's gate fixtures (`check-pack.mjs --definition`) and the training's dev table are separate measurements that this command does not repeat.
