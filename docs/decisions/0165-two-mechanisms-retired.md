# 0165 — Two mechanisms retire: a role in capitals and a value after a wording label were covered by others

Date: 27 October 2026. Status: implemented and measured. Owner, on the ablation table of 0164: "retire capitalRoles and wordingFields from the policy, measure on seeds 1–7 and the private sets, and record it as a decision."

## Why

The full ablation of the shipping pack (0164) switched each of the twelve mechanisms of `plausibleModelDetections` off in turn over 557 held-out documents. Ten of them hold back over-masking on their own; two brought nothing back: `capitalRoles` (a role in capitals inside a line of prose, from 0160) and `wordingFields` (the value after a label that says it holds wording, "Chức vụ: Kỹ sư phần mềm", also from 0160). The grouped runs then measured what they hold back beyond their neighbours: `capitalRoles` and `capitalHeadings` cover each other completely (141 spans over seven seeds held back by both, none by `capitalRoles` alone), and `wordingFields` adds three spans in 546 documents beyond `phrases` and `departments`. A mechanism that only repeats another is cost without a measurement behind it, which is what 0161 asked the policy to stop carrying.

## What changed

- `model-policy.ts` loses the capitals-in-prose test and the `wordingField` function with its two patterns; `vetoes.ts` loses the two names, so the comparison harness lists ten mechanisms.
- `vocabulary/document-wording.json` loses the `wordingLabels` and `positionLabels` lists that only `wordingField` read; `vocabulary.ts` no longer compiles them, and the README row says what the file still feeds. The column headings that hold wording stay: `wordingColumns` reads them.
- No test changed its expectation: every value the two mechanisms vetoed is still vetoed, by the mechanism that also covered it. The harness's example of an overlapped pair is now goods under a goods heading (`wordingColumns+productCells`).

## Result

`pnpm -C desktop compare:packs --seeds 1-7` after the change, the shipping pack on seeds 1–7 of the wider set (546 documents) and the owner's invoices and decision: 0 not read, 0 leaked, 0 over-masked, 0 unlisted on every set, 311 s, the same as before the change. `pnpm test` and `pnpm lint` pass; the pack gate is unchanged (no fixture touched either mechanism alone).

## Known limits

The three spans `wordingFields` held back beyond its neighbours are not over-masked now because `phrases` or `departments` catches each of them in these documents; a value after "Lý do nộp:" or "Chẩn đoán:" that no other mechanism covers will again depend on the models, which is where 0163 puts the open classes. The ablation table of 0164 is the place to see it come back.
