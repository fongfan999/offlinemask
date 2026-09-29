# 0027 — Continue local preparation with a bounded MPS configuration

Date: 18 September 2026. Status: backward hardware diagnostic passes at fixed batch one; actual training still gated.

The owner asked whether their 16 GiB M1 Pro could perform fine-tuning and approved continuing locally. Test training-related operations without using unreviewed corpus labels, changing weights or launching cloud compute.

The initial multi-shape diagnostic hits its 6 GiB allocator cap on the second batch-two pass. Preserve this failure. A separately specified fixed 1×384-token follow-up clears gradients and unused allocator cache between eight passes and completes under the same cap. Maximum observed driver allocation is 4.19 GB. All gradients are finite, full parameter hashes are unchanged and cached source hashes remain verified.

Prefer local MPS for the next bounded experiment, subject to corpus and other admission gates. The diagnostic uses full FP32 parameters and reserves two moment tensors per parameter, but executes no optimizer step. It does not establish actual optimizer memory, source-label alignment, long-run stability, checkpoint recovery, model quality or training duration. The shorter raw backward times exclude the measured gradient-validation/cleanup overhead and are not end-to-end training-step claims.

Do not increase allocation limits, purchase cloud capacity or promote a checkpoint from these results. Complete reviewed data preparation, then measure real optimizer/checkpoint behavior and sustained throughput locally before deciding whether cloud compute adds value. The normal application, installed pack, offline behavior and no-telemetry boundary remain unchanged.

See the [hardware report](../evaluations/minilm-local-training.md), original failed evidence and successful fixed-batch follow-up linked there.
