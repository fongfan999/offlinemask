import { computed, ref } from "vue";
import {
  browserModelStatus,
  cancelModelDownload,
  downloadModels,
  modelStatus,
  subscribeModelStatus,
  uninstallModels,
  type ModelStatus,
} from "../adapters/models.ts";

export interface PackAdapter {
  status(): Promise<ModelStatus>;
  subscribe(listener: (status: ModelStatus) => void): Promise<() => void>;
  download(): Promise<void>;
  cancel(): Promise<void>;
  uninstall(): Promise<void>;
}

export const nativePackAdapter: PackAdapter = {
  status: modelStatus,
  subscribe: subscribeModelStatus,
  download: downloadModels,
  cancel: cancelModelDownload,
  uninstall: uninstallModels,
};

export const packCheckError = "Chưa kiểm tra được gói nhận diện. Hãy mở lại ứng dụng để thử lại.";
export const packActionError = "Chưa thực hiện được thao tác. Vui lòng thử lại.";
const preparingStages: ReadonlySet<ModelStatus["stage"]> = new Set(["downloading", "installing"]);

/** Whole-number progress of the stage in flight: transfer while downloading, extraction once installing. */
export function packProgress(status: ModelStatus): number {
  const installing =
    status.stage === "installing" || (status.stage === "cancelling" && status.installed > 0);
  const done = installing ? status.installed : status.downloaded;
  const total = installing ? status.installedBytes : status.total;
  return Math.min(100, Math.floor((done / Math.max(1, total)) * 100));
}

/** Optional recognition pack state. Status arrives by native push; one explicit
 * read covers the initial state and the moment after each user action.
 */
export function useRecognitionPack(
  adapter: PackAdapter = nativePackAdapter,
  fallbackPollMs = 2000,
) {
  const status = ref<ModelStatus>({ ...browserModelStatus(), stage: "checking" });
  const busy = ref(false);
  const error = ref("");
  const ready = computed(() => status.value.stage === "ready");
  const preparing = computed(() => preparingStages.has(status.value.stage));
  const readyRoot = computed(() => (ready.value ? status.value.root : null));
  let unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let state: "idle" | "started" | "stopped" = "idle";

  /** A status read can resolve after a newer pushed status (for example the
   * "paused" push overtaking the read made right after pausing); never go back. */
  function apply(next: ModelStatus) {
    if ((next.revision ?? 0) < (status.value.revision ?? 0)) return;
    status.value = next;
    error.value = "";
  }
  async function refresh() {
    try {
      apply(await adapter.status());
    } catch {
      error.value = packCheckError;
    }
  }
  async function poll() {
    await refresh();
    if (state === "started") timer = setTimeout(poll, fallbackPollMs);
  }
  async function start() {
    if (state !== "idle") return;
    state = "started";
    try {
      const stop = await adapter.subscribe(apply);
      if (state !== "started") {
        stop();
        return;
      }
      unsubscribe = stop;
      await refresh();
    } catch {
      // Without pushes, slow polling keeps the UI from sticking at "checking".
      if (state === "started") await poll();
    }
  }
  function stop() {
    state = "stopped";
    clearTimeout(timer);
    unsubscribe?.();
    unsubscribe = undefined;
  }
  async function run(action: "download" | "pause" | "uninstall") {
    if (busy.value) return;
    busy.value = true;
    try {
      if (action === "download") await adapter.download();
      else if (action === "pause") await adapter.cancel();
      else await adapter.uninstall();
      await refresh();
    } catch {
      error.value = packActionError;
    } finally {
      busy.value = false;
    }
  }
  return { status, busy, error, ready, preparing, readyRoot, refresh, start, stop, run };
}
