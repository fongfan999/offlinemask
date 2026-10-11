import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { packInstalledBytes, packTransportBytes } from "../core/detection/pack.ts";

export interface ModelStatus {
  stage:
    | "checking"
    | "missing"
    | "downloading"
    | "installing"
    | "cancelling"
    | "paused"
    | "error"
    | "ready";
  downloaded: number;
  total: number;
  installedBytes: number;
  installed: number;
  error: string | null;
  root: string | null;
}

export const installedModelBytes = packInstalledBytes();
export const totalModelBytes = packTransportBytes();
export const formatModelBytes = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} GB`
    : `${(bytes / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} MB`;
export const desktopModels = isTauri();

/** Event name shared with the native `Models` manager. */
export const modelStatusEvent = "model-status";

/** Browser previews have no native pack manager: the pack is always missing. */
export function browserModelStatus(): ModelStatus {
  return {
    stage: "missing",
    downloaded: 0,
    total: totalModelBytes,
    installedBytes: installedModelBytes,
    installed: 0,
    error: null,
    root: null,
  };
}

function withAssetRoot(status: ModelStatus): ModelStatus {
  return { ...status, root: status.root ? convertFileSrc(status.root) : null };
}

export async function modelStatus(): Promise<ModelStatus> {
  if (!desktopModels) return browserModelStatus();
  return withAssetRoot(await invoke<ModelStatus>("model_status"));
}

/** Native status pushes replace polling. The returned function stops listening. */
export async function subscribeModelStatus(
  listener: (status: ModelStatus) => void,
): Promise<() => void> {
  if (!desktopModels) return () => {};
  return listen<ModelStatus>(modelStatusEvent, (event) => listener(withAssetRoot(event.payload)));
}

export const downloadModels = () => invoke<void>("download_models");
export const cancelModelDownload = () => invoke<void>("cancel_model_download");
export const uninstallModels = () => invoke<void>("uninstall_models");
