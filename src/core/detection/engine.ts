import { filterDetections, requiresModels } from "./options.ts";
import type { DetectionProgress, WorkerRequest } from "./types.ts";
import { localDetections } from './policy.ts';

import type { EncodeRecognition } from "./recognition-source.ts";

type Loader = typeof import("./recognition.ts").loadRecognition;
const loadLocal: Loader = async (...args) => (await import("./recognition.ts")).loadRecognition(...args);

export function createDetectionEngine(encode: EncodeRecognition = async () => { throw new Error("Native tokenizer required"); }, load: Loader = loadLocal) {
  let detector: ReturnType<Loader> | undefined;
  let root: string | undefined;
  let releasing: Promise<void> | undefined;
  async function acquire(modelRoot: string) {
    if (releasing) await releasing;
    if (root && root !== modelRoot) throw new Error("Recognition root changed");
    if (!detector) {
      root = modelRoot;
      // Assign before the dynamic import resolves: preload and detection share one load.
      detector = load(modelRoot, encode).catch(error => { detector = undefined; root = undefined; throw error; });
    }
    return detector;
  }
  const detect = async ({ text, options, modelRoot }: WorkerRequest, progress: (value: DetectionProgress) => void, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    if (!requiresModels(options)) {
      return filterDetections(localDetections(text), options);
    }
    if (!modelRoot) throw new Error("Models required");
    progress({ stage: "loading", completed: 0, total: 0 });
    const loaded = await acquire(modelRoot);
    signal?.throwIfAborted();
    return filterDetections(await loaded.detect(text, progress, signal), options);
  };
  return Object.assign(detect, {
    // Load only installed weights. No document, inference or remote lookup is involved.
    async prepare(modelRoot: string) { await acquire(modelRoot); },
    dispose() {
      if (releasing) return releasing;
      const previous = detector;
      detector = undefined; root = undefined;
      releasing = (async () => {
        let loaded;
        try { loaded = await previous; } catch { return; }
        await loaded?.dispose();
      })().finally(() => { releasing = undefined; });
      return releasing;
    },
  });
}
