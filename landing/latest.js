/** "2026-10-24" as the page writes dates: 24/10/2026. */
export const releaseDay = (iso) => {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}/${Number(month)}/${year}`;
};

/**
 * Names the newest release from the site's own /latest.json (worker.js), so a page built before
 * a release still shows it. The download links need no update: /download/<platform> already
 * redirects to the newest file. Without the endpoint (or offline) the built-in text stays.
 */
export async function showLatest(root) {
  try {
    const response = await fetch("/latest.json");
    if (!response.ok) return;
    const { version, date } = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(version)) return;
    const changed = root.querySelector("[data-om-version]")?.textContent !== version;
    root.querySelectorAll("[data-om-version]").forEach((element) => {
      element.textContent = version;
    });
    root.querySelectorAll("[data-om-release-date]").forEach((element) => {
      if (date) element.textContent = releaseDay(date);
      else if (changed) element.closest("[data-om-release]")?.remove();
    });
  } catch {
    // Keep what the build wrote.
  }
}
