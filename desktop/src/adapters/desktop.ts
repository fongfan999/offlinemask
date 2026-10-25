import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export const productWebsite = "https://offlinemask.com/";

/** Browser previews retain normal link behavior; native clicks use the OS browser. */
export async function openProductWebsite(event: MouseEvent): Promise<void> {
  if (!isTauri()) return;
  event.preventDefault();
  await openUrl(productWebsite);
}

/** The report page with a report filled in (decision 0147); the user presses Gửi there. */
export async function openReportPage(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await openUrl(url);
}
