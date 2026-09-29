import { invoke } from '@tauri-apps/api/core';
import type { TokenOffsets } from '../core/detection/recognition-source.ts';
import { localOptions, type DetectionOption } from '../core/detection/options.ts';
import type { Detection, DetectionProgress, WorkerRequest, WorkerResponse } from '../core/detection/types.ts';

export function createTextDetector(invokeLocal: typeof invoke = invoke) {
  let worker: Worker | undefined;
  let sequence = 0;
  let preparedRoot: string | undefined;
  type Run = { id: number; request: WorkerRequest; started: boolean; processing: boolean;
    progress: (value: DetectionProgress) => void; resolve: (value: Detection[]) => void; reject: (error: Error) => void };
  let pending: Run | undefined;
  let draining: number | undefined;
  let releasing = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function reset() {
    clearTimeout(timeout); timeout = undefined; draining = undefined; releasing = false;
    worker?.terminate(); worker = undefined; preparedRoot = undefined;
  }
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('../workers/detection.worker.ts', import.meta.url), { type: 'module' });
    const active = worker;
    active.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (worker !== active) return;
      const message = event.data;
      if (message.type === 'native') {
        const { operation, ...args } = message.request;
        const command = { load: 'recognition_native_load', run: 'recognition_native_run', release: 'recognition_native_release' }[operation];
        if (!command) return;
        void invokeLocal(command, args).then(result => {
          if (worker === active) active.postMessage({ type: 'native-result', id: message.id, result });
        }, () => {
          if (worker === active) active.postMessage({ type: 'native-result', id: message.id, error: true });
        });
        return;
      }
      if (message.runId === draining) {
        if (['cancelled', 'result', 'error', 'reset'].includes(message.type)) {
          clearTimeout(timeout); timeout = undefined; draining = undefined; releasing = false;
          if (message.type === 'error') reset();
          start();
        }
        return;
      }
      if (!pending || message.runId !== pending.id) return;
      if (message.type === 'encode') {
        const runId = pending.id;
        void invokeLocal<TokenOffsets>('recognition_encode', { text: message.text }).then(encoding => {
          if (worker === active && pending?.id === runId) active.postMessage({ type: 'encoded', runId, id: message.id, encoding });
        }, () => {
          if (worker === active && pending?.id === runId) active.postMessage({ type: 'encoded', runId, id: message.id, error: true });
        });
      } else if (message.type === 'progress') {
        pending.processing ||= message.progress.stage === 'processing';
        pending.progress(message.progress);
      } else {
        const run = pending; pending = undefined;
        if (message.type === 'result') run.resolve(message.detections);
        else { releaseWorker(); run.reject(new Error('Local detector failed')); }
      }
    };
    active.onerror = event => {
      event.preventDefault();
      if (worker !== active) return;
      const run = pending;
      // A queued retry has not touched the failed runtime yet.
      const queued = run && !run.started;
      if (!queued) pending = undefined;
      reset();
      if (queued) start(); else run?.reject(new Error('Local detector failed'));
    };
    return active;
  }
  function start() {
    if (!pending || pending.started || draining !== undefined) return;
    const active = ensureWorker();
    pending.started = true;
    active.postMessage({ ...pending.request, runId: pending.id });
  }
  function releaseWorker() {
    if (!worker || releasing) return;
    clearTimeout(timeout);
    draining = ++sequence; releasing = true; preparedRoot = undefined;
    const active = worker;
    active.postMessage({ type: 'reset', runId: draining });
    // Loading may still be completing. Never overlap replacement model sessions.
    timeout = setTimeout(() => { if (worker === active) { reset(); start(); } }, 30000);
  }
  function cancel(preserveModels = false) {
    const run = pending; pending = undefined;
    run?.reject(new DOMException('Cancelled', 'AbortError'));
    if (preserveModels && run?.started && run.processing && worker) {
      draining = run.id;
      const active = worker;
      active.postMessage({ type: 'cancel', runId: run.id });
      // Do not retain cancelled source indefinitely in an unresponsive runtime.
      timeout = setTimeout(() => { if (worker === active) { reset(); start(); } }, 5000);
    } else if (!preserveModels || (run?.started && !run.processing)) releaseWorker();
  }
  return {
    cancel,
    destroy() {
      const run = pending; pending = undefined;
      reset(); run?.reject(new DOMException('Cancelled', 'AbortError'));
    },
    prepare(modelRoot: string) {
      if (!modelRoot || preparedRoot === modelRoot || pending || draining !== undefined) return;
      const active = ensureWorker();
      preparedRoot = modelRoot;
      active.postMessage({ type: 'prepare', modelRoot });
    },
    detect(text: string, progress: (value: DetectionProgress) => void, modelRoot?: string, options: readonly DetectionOption[] = localOptions): Promise<Detection[]> {
      if (pending) throw new Error('Detection already running');
      return new Promise((resolve, reject) => {
        pending = { id: ++sequence, request: { text, modelRoot, options: [...options] }, started: false, processing: false, progress, resolve, reject };
        start();
      });
    },
  };
}
