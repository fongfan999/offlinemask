# Smaller GLiNER2 candidate: local evaluation

20 September 2026. **The PII Engineer GLiNER2-based INT8 candidate runs locally, but does not qualify as the sole v1 contextual detector, even with organizations deferred.** No production pack or application dependency was changed.

## Candidate and execution

- Model: [PII-Engineer-Multi-NER-v2.1](https://huggingface.co/pii-engineer/PII-Engineer-Multi-NER-v2.1), pinned revision `efacd9242671d0300da535207d7952dc3f82f57e`.
- Runtime: unmodified [publisher Rust implementation](https://github.com/gantz-ai/pii.engineer), revision `4ff53986a53351b3a516872a557832b44b166628`, core crate only. No server, upstream postprocessing pipeline, Chinese model, auto-download or periodic warm-up service is run.
- Published INT8 encoder plus four supporting ONNX graphs, tokenizer and configuration total **670,123,007 bytes**. The model card adds 4,104 bytes. No FP32 encoder was downloaded. This is asset size, not installer size or RAM.
- Publisher model card and Rust repository declare Apache-2.0. Their original LICENSE, NOTICE and model card are retained in ignored local artifacts; [Apache license text](../../licenses/models-Apache-2.0.txt) is already in the repository. No model redistribution was performed. The runtime's NOTICE additionally attributes GLiNER2 and Microsoft's encoder; shipping still needs the normal complete dependency/license review.
- Publisher default nine-label schema, no descriptions or boosts, with its unchanged lowercase preprocessing and greedy decoding. Only `person_name` and `street_address` at the publisher's 0.25 thresholds feed OfflineMask's unchanged shared policy. Structured fields continue to use the existing rules. All raw labels/scores are retained for diagnosis.
- Each window is at most 120 words and 384 actual tokens including the exact schema prompt, with 24 words of overlap. This avoids the publisher runtime's silent 512-token truncation. Every non-whitespace source character is verified as processed. NFC normalization and the existing grapheme mapping restore original UTF-16 positions; no original input is lowercased or rewritten.

The first 398-case execution used ONNX Runtime 1.22.1. All predictions were produced, but the process aborted during shutdown (`SIGABRT`, mutex error). This failed run remains intact in [original results](results.json) and ignored raw/execution logs. A separate runtime-only run used **ONNX Runtime 1.20.1**, matching the `ort 2.0.0-rc.9` version family. It completed all 398 cases **and exited successfully**. Its scored outcomes are exactly identical to the first run. This establishes a working tested combination, not the root cause of every possible shutdown failure or compatibility with newer runtimes.

Both executions ran under macOS `(deny network*)`; a connection probe was rejected before inference. No training, private input, telemetry, threshold search or application-network change was involved.

## Same scope for every comparison

The ranked set remains **386 observed synthetic case records**, originally containing 500 sensitive values. Under [Decision 0038](../../decisions/0038-conditional-v1-organization-deferral.md), 13 organization annotations are reported separately, leaving **487 required values**. The overlapping owner12 set is executed and reported separately, never counted twice in ranking. Its one organization is also separated.

No annotation, owner approval or old result was edited. Deferred organization spans are neutral in retained-scope coverage, not counted as correctly masked or as ordinary text. Original negative-case definitions and ordinary-text expectations stay unchanged. Organization findings under the wrong selected option are separately reported. Comparators are replayed from their verified earlier predictions through the same unchanged policy and the same reduced scope.

| Contextual detector with shared rules | Required values fully hidden under correct option | Names | Addresses / locations | Ordinary lexical positions hidden | Original negative cases changed |
| --- | ---: | ---: | ---: | ---: | ---: |
| **PII Engineer INT8 (~670 MB)** | **463/487** | **142/150** | **112/128** | **213** | **7/92** |
| Underthesea INT8 (~206 MB) | 477/487 | 142/150 | 126/128 | 369 | 10/92 |
| Underthesea + mSuperClinical (~1.14 GB) | 482/487 | 147/150 | 126/128 | 467 | 21/92 |
| Underthesea + BigMed + mSuperClinical (~2.01 GB) | 483/487 | 147/150 | 127/128 | 482 | 26/92 |

All four recipes fail the retained-scope screening requirements. PII Engineer hides less ordinary text, but its name coverage is **94.7%**, and address/location coverage is **87.5%**, below the existing 95% floors. Short-text excess masking is **1.50%**, above the 1% floor. Every ranked evidence stage also exceeds its allowance of one changed negative case. These figures describe these fixtures, not real banking accuracy.

The unchanged rules preserve all 209 required structured values in this comparison (email 31, phone 33, banking/identity 68, remaining other 77). This must not be attributed to the new model. Only **348/386** records have all retained values hidden under their correct options with no extra ordinary lexical masking.

In the owner-approved 24 examples, retained coverage is **25/26**: names 7/8, addresses 4/4, structured fields 14/14. There are 34 extra ordinary lexical positions and 2/5 negative cases changed. Deferring organizations alone therefore does not satisfy the remaining quality requirements.

## Where it falls short

The main name failures involve unaccented text: `Vo Thi Thanh Truc`, `Dang Quoc Bao`, `bui ngoc diep`, `Do Thi Kim Ngan`, `Dang Thi Bao Tram`, `Ngo Tuan Kiet`, and reviewed `dinh bao khue`. The accented `Hoàng Gia Bảo` case also fails complete name coverage. Several accented/lowercase names missed by other candidates do work here, including `đỗ hoàng phúc`; this is not a uniform regression on every name.

The address option currently includes standalone cities and provinces. The model's published `street_address` schema misses or miscategorizes examples such as `Hà Nội`, `Đà Nẵng`, `Huế`, `Quảng Ngãi` and `Cần Thơ`. Organizations were the only owner-approved scope deferral; city/location expectations were not silently removed. These misses are different from failure on every full street address.

Unnecessary masking remains visible in reviewed negatives, including `trong` and `nhân viên trực quầy`. In reviewed `rv12`, part of the organization is predicted as a person name. This category leak is reported separately from the optional organization coverage; it is not an organization success.

## Observed resources

On the owner's Apple M1 Pro, 16 GiB RAM, macOS arm64, the successful CPU run used four intra-op threads and one inter-op thread:

- Model load: **2.53 seconds** in this process. This was after earlier model reads, not a guaranteed cold-disk measurement.
- Non-long case median **111 ms**, p95 **198 ms**; no prediction caching.
- Five long fixtures: approximately **6.0–6.7 seconds** each, across 15–16 overlapping windows.
- Sampled peak physical footprint **2.31 GB**; sampled resident memory **1.67 GB**. A 670 MB download does not imply a 670 MB runtime footprint.
- Full run **84.4 seconds**, successful process exit, zero case errors.

These are developer CLI measurements from one run. They do not qualify the packaged desktop app, cancellation, a 50,000-character worst case, another device or another OS. Sampling every 200 ms can miss peaks.

## Evidence and reproduction

The authoritative successful run is under [compatible/](compatible/protocol.json): [results](compatible/results.json) and [verification](compatible/verification.json). The original frozen protocol and failed-shutdown results remain alongside it. Raw outputs, pinned weights/source, build logs and resource samples are in ignored `artifacts/gliner2-compact-v1/`.

The harness invokes publisher inference without modifying its source. Its config filename alias mirrors the publisher downloader (`config.json` → `gliner_config.json`, identical bytes). The second scorer is generated from the original by path substitution only; verification enforces that equivalence. Existing outputs are not overwritten.

```sh
mise exec -- node --experimental-strip-types scripts/gliner2-compact-v1/verify.mjs
```

Verification checks asset/source hashes, old comparison hashes, unchanged owner approvals, all source spans and complete window coverage, then replays all six option previews and both full/retained-scope metrics. Successful runtime predictions and scores match the earlier runtime's scores; the shutdown failure is not omitted.

**Decision:** retain this as measured comparison evidence. Do not replace the production pack with this checkpoint/configuration. This does not reject the whole GLiNER2 family, prove a different prompt or checkpoint cannot work, or justify returning to a 2 GB default. A further candidate experiment must address unaccented names and location coverage while preserving the smaller-pack goal and unnecessary-masking limits.
