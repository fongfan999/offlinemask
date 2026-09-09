import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";

/** Null identifies a browser preview; native failures are handled by the UI. */
export async function getDesktopVersion(): Promise<string | null> {
  return isTauri() ? getVersion() : null;
}
