# Fixed-batch follow-up after the MPS allocation failure

The original diagnostic completed five forward/backward passes but reached the unchanged 6 GiB allocator cap during the second batch-2/384-token pass. Preserve that failed run. Do not relax memory limits or infer that full training fits.

Follow-up: same source/environment/FP32/eager/MPS-only configuration, same two-moment memory reserve, same 240-second deadline and same 6 GiB allocator/8 GiB RSS guards. Limit input to batch 1 × 384 tokens for eight passes. After each pass, delete outputs, clear gradients with set_to_none, synchronize, release unused allocator cache and synchronize again. Report both forward/backward time and time including finite-gradient checks and cleanup. Record pre/post-cleanup memory snapshots. Cache clearing is a diagnostic memory-management choice whose overhead must remain visible.

No corpus, optimizer updates, trained artifact or cloud use. Require all finite gradients, unchanged full parameter hash and unchanged cached files. A pass supports a conservative fixed-batch local diagnostic only; it does not prove optimizer/long-run/full-training feasibility. Future runs need new versioned protocols.
