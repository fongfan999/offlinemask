import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export const productWebsite = "https://offlinemask.com/";

/** Browser previews retain normal link behavior; native clicks use the OS browser. */
export async function openProductWebsite(event: MouseEvent): Promise<void> {
  if (!isTauri()) return;
  event.preventDefault();
  await openUrl(productWebsite);
}

/** Null identifies a browser preview; native failures are handled by the UI. */
export async function getDesktopVersion(): Promise<string | null> {
  return isTauri() ? getVersion() : null;
}
