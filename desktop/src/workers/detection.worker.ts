import { createDetectionEngine } from "../core/detection/engine.ts";
import type { WorkerRequest, WorkerResponse } from "../core/detection/types.ts";
import type { TokenOffsets } from "../core/detection/recognition-source.ts";

let sequence = 0;
let pending: { id: number; resolve: (value: TokenOffsets) => void; reject: () => void } | undefined;
let active: { runId: number; controller: AbortController } | undefined;
let running: Promise<void> | undefined;
let resetting = false;
function send(message: WorkerResponse) {
  postMessage(message);
}
function encode(text: string, model: string): Promise<TokenOffsets> {
  if (pending || !active) throw new Error("Tokenizer busy");
  active.controller.signal.throwIfAborted();
  const runId = active.runId;
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending = { id, resolve, reject: () => reject(new Error("Tokenizer unavailable")) };
    send({ type: "encode", runId, id, text, model });
  });
}
const nativePending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let nativeSequence = 0;
const nativeBridge: import("../core/detection/native-recognition.ts").NativeBridge = (request) =>
  new Promise((resolve, reject) => {
    const id = ++nativeSequence;
    nativePending.set(id, { resolve, reject });
    send({ type: "native", runId: 0, id, request });
  });
const detect = createDetectionEngine(
  encode,
  import.meta.env?.VITE_NATIVE_RECOGNITION === "1"
    ? async (root, encoder) =>
        (await import("../core/detection/native-recognition.ts")).loadNativeRecognition(
          root,
          encoder,
          nativeBridge,
        )
    : undefined,
);
type Message =
  | (WorkerRequest & { runId: number })
  | { type: "native-result"; id: number; result?: unknown; error?: boolean }
  | { type: "prepare"; modelRoot: string }
  | { type: "reset"; runId: number }
  | { type: "cancel"; runId: number }
  | { type: "encoded"; runId: number; id: number; encoding?: TokenOffsets; error?: boolean };
onmessage = async (event: MessageEvent<Message>) => {
  const request = event.data;
  if ("type" in request) {
    if (request.type === "native-result") {
      const call = nativePending.get(request.id);
      nativePending.delete(request.id);
      if (request.error) call?.reject(new Error("Native recognition unavailable"));
      else call?.resolve(request.result);
      return;
    }
    if (request.type === "reset") {
      if (resetting) return;
      resetting = true;
      active?.controller.abort();
      const awaiting = pending;
      pending = undefined;
      awaiting?.reject();
      try {
        await running;
        await detect.dispose();
        send({ type: "reset", runId: request.runId });
      } catch {
        send({ type: "error", runId: request.runId });
      } finally {
        resetting = false;
      }
      return;
    }
    if (request.type === "prepare") {
      // Best effort only. A user request can await this same promise while loading.
      if (resetting) return;
      try {
        await detect.prepare(request.modelRoot);
      } catch {
        /* Explicit masking may retry. */
      }
      return;
    }
    if (active?.runId !== request.runId) return;
    if (request.type === "cancel") {
      active.controller.abort();
      const awaiting = pending;
      pending = undefined;
      awaiting?.reject();
    } else if (pending?.id === request.id) {
      const awaiting = pending;
      pending = undefined;
      if (request.error || !request.encoding) awaiting.reject();
      else awaiting.resolve(request.encoding);
    }
    return;
  }
  if (active || resetting) return;
  running = runDetection(request);
  await running;
};

async function runDetection(request: WorkerRequest & { runId: number }) {
  const run = { runId: request.runId, controller: new AbortController() };
  active = run;
  try {
    const detections = await detect(
      request,
      (progress) => send({ type: "progress", runId: run.runId, progress }),
      run.controller.signal,
    );
    run.controller.signal.throwIfAborted();
    send({ type: "result", runId: run.runId, detections });
  } catch {
    // Never forward provider errors, which may include source content.
    send({ type: run.controller.signal.aborted ? "cancelled" : "error", runId: run.runId });
  } finally {
    active = undefined;
    pending = undefined;
  }
}
