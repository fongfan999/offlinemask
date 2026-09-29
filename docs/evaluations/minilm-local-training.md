# Local training hardware diagnostic on the reference Mac

**Keep the next experiment local.** The M1 Pro with 16 GiB can execute this model's FP32 forward/backward operations on its GPU with a fixed one-example batch and controlled cache cleanup. This is measured hardware evidence, not a completed training run or a guarantee that the full optimizer/training workload fits.

## The failed run and bounded follow-up

The first [predeclared diagnostic](minilm-local-training/spec.md) exercised batch/sequence shapes 1×128, 1×384 and 2×384, twice each. It completed five passes before hitting the **6 GiB MPS allocator limit** on the second two-example pass. The process exited with failure after 41.2 seconds. Its [frozen result](minilm-local-training/results.json) remains intact. The allocator's suggestion to disable the memory limit was not followed.

The [follow-up specification](minilm-local-training-fixed/spec.md) retains the same memory/deadline limits, source, environment, FP32 precision, eager attention, and GPU-only execution. It uses a fixed **1×384-token** shape for eight passes and releases outputs, gradients and unused allocator cache between passes. All eight complete, with finite loss and gradients for all **117,520,935 parameters**. Full before/after parameter hashes match, and cached source files still match their pinned hashes. No optimizer update, checkpoint save or corpus access occurred.

| Follow-up measurement | Result |
| --- | ---: |
| Forward/backward passes completed | 8/8 |
| First forward/backward | 626 ms |
| Subsequent forward/backward | 67–82 ms |
| Subsequent pass including gradient checks and cleanup | 255–347 ms |
| Maximum observed MPS driver allocation | 4,187,783,168 bytes (4.19 GB / 3.90 GiB) |
| Maximum observed MPS tensor allocation | 1,976,441,856 bytes |
| Process peak RSS reported at snapshots | 1,025,310,720 bytes |
| Total launcher elapsed time | 10.17 s |
| Optimizer updates / checkpoints | 0 / 0 |

Device work is synchronized for timing. Both experiments reserve two full FP32 tensors per parameter to represent Adam moment storage. This accounts for resident moment storage **only**: actual optimizer kernels, update temporaries, gradient accumulation, clipping, checkpoint/reload and tokenizer/label alignment are not exercised. Artificial IDs and arbitrary labels establish operation/gradient execution; loss values are not accuracy or learning results.

Memory observations are phase snapshots, not exact continuous device peaks. Driver allocation includes caches/framework allocations; tensor memory is a subset, while process RSS overlaps unified GPU memory and must not be added to it. The first run and follow-up also differ in shapes and cleanup, so this is not an isolated causal measurement of cache clearing. Eight passes do not establish sustained stability. Do not extrapolate a full fine-tuning duration from these timings or call the 4.19 GB figure a complete training-memory requirement.

## Environment, isolation and reproduction

Verified local hardware: Apple M1 Pro, 17,179,869,184 bytes RAM, macOS 26.6.2. Existing Python 3.12.7, PyTorch 2.8.0 and Transformers 4.57.6 are reused; no dependency installation occurs. MPS is available and CPU fallback is explicitly disabled. Both child runs use the network-deny launch profile plus offline loader flags and a Python socket audit hook. No cloud job or upload occurs.

The base checkpoint remains pinned to Microsoft Multilingual-MiniLM-L12-H384 revision `6e8c1ec6b4ec4e3fc6eb7d2cd834fcd582b61daf`. The 39-label classifier head is randomly initialized. Neither the installed recognition pack nor any app/runtime source changes.

Context7 and installed PyTorch 2.8 source were checked for MPS availability, synchronization, memory limits and allocation measurements: [MPS backend](https://github.com/pytorch/pytorch/blob/v2.8.0/docs/source/notes/mps.rst), [MPS memory APIs](https://github.com/pytorch/pytorch/blob/v2.8.0/torch/mps/__init__.py). The older environment is not assumed to have newer graph-cache APIs.

With the existing pinned environment/assets and empty destinations:

```sh
mise exec -- python scripts/minilm-local-training/run.py
mise exec -- node scripts/minilm-local-training/report.mjs
mise exec -- python scripts/minilm-local-training-fixed/run.py
mise exec -- node scripts/minilm-local-training-fixed/report.mjs
```

Each runner creates a new artifact directory and refuses overwrite; reporters also refuse to overwrite frozen results. Archive prior runs explicitly or create a versioned follow-up rather than replacing evidence. A 240-second external deadline stops stalled child execution. The failed run is expected to report failure on this recorded workload; do not reinterpret its exit status as a successful diagnostic.

The successful [frozen follow-up](minilm-local-training-fixed/results.json) records per-pass timings, memory snapshots, source/raw hashes and the preceding failed result's hash. Both diagnostics enforce finite gradients and source checks; the completed follow-up additionally proves parameter identity. These executable assertions validate the experiment; application tests were not rerun because no application code changed.

## Decision and remaining work

There is no demonstrated need to rent a GPU yet. Carry the one-example, fixed-length MPS configuration into the eventual bounded training test, recording cleanup overhead. First finish corpus coverage and genuine independent annotation/split review. Then verify real label alignment and actual optimizer/checkpoint behavior, measure sustained memory and throughput, and decide on cloud compute from those results. The existing review and training admission gates remain unchanged.
