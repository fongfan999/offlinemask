# Single-model decision — 19 September 2026

**Reject both frozen candidates for release under the current quality criteria.** Underthesea has stronger coverage and a viable local resource profile, but excessive masking remains. BigMed misses too many names, including after canonical Unicode handling. No pack was replaced.

## Comparable quality evidence

The [specification](single-model-decision-v1/spec.md) and [protocol](single-model-decision-v1/protocol.json) precede execution. Both models use the latest shared detector and NFC-only inference copies with exact mapping back to the original source. Keep the full six-category scope and every original denominator.

BigMed ran 362 original inputs plus 15 additional composed inputs using pinned native preprocessing. Reconstructed historical policy had to reproduce its previous all-options and six category-selected previews exactly. The Underthesea comparison reuses the preceding actual inference evidence and replays all 362 canonical Detection arrays through the unchanged current policy, asserting exact preview identity. Reuse is explicit: this is not a claim of another independent Underthesea run.

[Machine-readable results](single-model-decision-v1/results.json) include per-corpus scores, exact cross-candidate gains/losses, raw artifact hashes and the predeclared engineering ranking. These are 362 previously observed synthetic cases containing 470 annotated values, including correlated representation variants. They are not independent field-accuracy estimates.

| Canonical single model | Correct own-category coverage | Name coverage, regression | Name coverage, challenge | Ordinary positions masked | Required assets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Underthesea INT8 | 463/470 | 98/103 | 39/39 | 270 | 205.5 MB |
| BigMed INT8 | 448/470 | 88/103 | 35/39 | 90 | 872.6 MB |

Own-category coverage requires full coverage with only the annotated category selected; accidental masking under another category does not count. Ordinary positions are source UTF-16 letters/marks/numbers outside the annotations, not numbers of words or documents. Asset sizes sum the pinned required INT8 graph, tokenizer and config files. They exclude FP32 research copies, developer Python, archive compression and the app/runtime; no installer or network transfer was measured.

### Why both fail

- **Underthesea:** regression ordinary-text masking is 3.52%, above the existing 1% short-text limit, and eight fully ordinary cases have false positives, above the limit of one. Its challenge subset passes, but that does not override the regression failure. Remaining name/category/address/organization misses from the previous diagnosis are preserved.
- **BigMed:** own-category name coverage is 85.4% regression and 89.7% challenge, below the 95% criterion. Regression excess masking is 1.07%, with nine false-positive ordinary cases. It fails both corpus screens.
- **BigMed contextual-only ablation:** filtering model predictions to names/addresses/organizations while retaining shared structured rules reduces ordinary masking from 90 to 21 positions and preserves observed full/own-category coverage. It still fails name coverage and has six false-positive ordinary cases. This useful ablation does not change the rejection decision.

Underthesea full all-options coverage is 324/328 regression and 141/142 challenge; BigMed is 312/328 and 137/142. All-options masking can hide category errors, so these totals were not used alone to choose the engineering probe.

No thresholds, annotations, field scope, weights or heuristics were changed during the comparison. No new model was searched for or downloaded, and no training occurred. Upstream maintenance/provenance and shipping native-adapter qualification remain unresolved, as recorded in earlier decisions; this task did not re-audit upstream metadata.

## Local resources

The predeclared engineering ranking selects the highest own-category covered count, then fewer ordinary positions, then smaller assets. Underthesea wins that limited ranking. This is not release selection.

Two separate processes ran sequentially on an Apple M1 Pro with 16 GiB RAM and macOS 26.6.2. Each used ONNX Runtime 1.24.3 CPU defaults, the pinned native tokenizer, online request-local planning and the unchanged graph. NFC mapping, tokenizer subprocess/IPC, inference, shared policy and preview scoring are inside request timing. There is no cross-request tokenization or inference-result cache. Session cold time excludes process/import startup and hash preflight; it is not an OS-cold app launch.

| Metric | Run 1 | Run 2 | Developer target |
| --- | ---: | ---: | ---: |
| Session initialization + first 2,000-character request | 485 ms | 360 ms | ≤5,000 ms |
| Ten warm 2,000-character requests, p95 | 127 ms | 129 ms | ≤300 ms |
| 50,000-character request | 2,948 ms | 3,008 ms | ≤8,000 ms |
| Peak sampled process-tree physical footprint | 714.8 MB | 724.9 MB | ≤1 GiB |
| Review-output parity | 12/12 | 12/12 | Exact all/six-category previews |

All diagnostic targets passed. Memory includes Node and its Python tokenizer subprocess, sampled approximately every 100 ms with macOS libproc. Sampling can miss transient peaks; RSS is separately recorded and is not physical footprint. The macOS process sandbox denied networking for each process tree, and fetch was additionally forbidden. No global network setting was changed.

The [resource specification](single-model-decision-v1/resources-spec.md), [protocol](single-model-decision-v1/resources-protocol.json) and [results](single-model-decision-v1/resources-results.json) preserve methodology and raw monitor hashes. Node CPU/native-tokenizer feasibility does **not** establish packaged Tauri/WebKit memory, UI responsiveness, cancellation, cold OS-cache behavior or cross-platform performance. No packaged build was modified or qualified here. ONNX session options/release APIs were checked through Context7 and existing local integration code; no dependency changed.

## Owner review

The [12-example review](single-model-decision-v1/review.md) asks the owner to identify desired sensitive spans before opening the A/B outputs. It includes difficult names, decomposed Unicode, addresses, structured values and ordinary-text contrasts. The consistent A/B labels are a convenience, not randomized blinding. Model identity is deliberately omitted from that review page until the owner forms an expectation.

All twelve entries in the [review ledger](single-model-decision-v1/review-ledger.json) remain **PENDING**. The ledger binds source text, fixture protocol and outputs by hash. Preparing or opening this file does not constitute human review. It reviews known synthetic examples and cannot be represented as a fresh final holdout. Future answers must be retained as a separate review record; no real user content or corrections are collected for training.

## Decision and stopping point

See [decision 0033](../decisions/0033-single-model-release-rejection.md). Do not ship either candidate as the qualified default or imply that the current development pair is qualified. Keep custom training deferred. These unchanged checkpoints have reached an explicit release rejection under current requirements; further score polishing is not an implied next step.

The immediate next input is the owner's example review. A later selection attempt requires reviewed new evidence or an explicitly agreed scope change. The small-app, offline-processing and manual-only download/update principles remain unchanged.

## Verification and reproduction

All **151 application tests pass**. Core source and historical artifacts remain hash-verified. No production detector, UI, pack, dependency or native app configuration changed in this task.

Use the already pinned local assets and evaluation interpreter. Preserve prior raw artifacts named in the protocols. Commands are create-only; use a separate checkout/output arrangement for a rerun without overwriting historical evidence.

```sh
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- node scripts/single-model-decision-v1/evaluate.mjs
mise exec -- node scripts/single-model-decision-v1/report.mjs
mise exec -- node scripts/single-model-decision-v1/review.mjs
OFFLINEMASK_EVAL_PYTHON="$PWD/artifacts/tokenizer-evaluation-env/bin/python" mise exec -- python scripts/single-model-decision-v1/run-resources.py
mise exec -- node scripts/single-model-decision-v1/resource-report.mjs
mise exec -- pnpm test
```
