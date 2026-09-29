# Local training hardware diagnostic

Purpose: determine whether the current 16 GiB M1 Pro can execute the pinned MiniLM model's training-mode forward/backward operations before investing in cloud compute. This does not admit training on unreviewed data.

Use the cached source and existing Python 3.12.7 / PyTorch 2.8.0 / Transformers 4.57.6 environment, full FP32 parameters, eager attention, random 39-label head and deterministic artificial token IDs/labels. No corpus imports, optimizer steps, checkpoint writes, downloads or cloud jobs. Assert every model parameter is unchanged using full parameter hashes before/after.

On MPS only, explicitly disable CPU operation fallback. Limit the MPS allocator to 6 GiB and wall time to 240 seconds. Exercise batch/sequence shapes (1,128), (1,384), (2,384), two forward/backward passes each. Reserve two FP32 tensors per parameter to represent Adam moment storage throughout the diagnostic; this tests resident storage, not the Adam update kernel or all optimizer temporaries. Mask sequence edge labels with -100. Stop on nonfinite loss/gradient, missing gradients, memory failure or deadline. Do not weaken these settings after a failure; retain the result.

Synchronize the device around measured forward/backward operations. Record phase-boundary MPS tensor/driver allocations and process peak RSS separately: unified memory means they overlap and must not be added. These snapshots do not prove exact driver peaks. Preserve per-pass times, including first-use compilation. No extrapolated full training duration or quality score. The installed app and pack remain unchanged.

Success supports proceeding with a conservative local pilot once corpus and other admission gates pass. It does not establish optimizer correctness, label alignment, checkpoint recovery, sustained memory, trained quality or the complete training budget.
