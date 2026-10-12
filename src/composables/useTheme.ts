import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ref } from "vue";

/** "system" follows the OS appearance; the others pin the app to one scheme. */
export type ThemeChoice = "system" | "light" | "dark";
export const themeChoices: readonly { id: ThemeChoice; label: string }[] = [
  { id: "system", label: "Tự động" },
  { id: "light", label: "Sáng" },
  { id: "dark", label: "Tối" },
];
export const themeKey = "offlinemask.theme.v1";

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(themeKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

// One app-wide preference. It holds no user content, so plain storage is fine.
const theme = ref<ThemeChoice>(read());

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  // The native title bar follows too; null hands it back to the OS.
  if (isTauri())
    void getCurrentWindow()
      .setTheme(choice === "system" ? null : choice)
      .catch(() => {});
}

/** Called once before mounting so the first paint already uses the choice. */
export function applyStoredTheme() {
  apply(theme.value);
}

export function useTheme() {
  function setTheme(choice: ThemeChoice) {
    theme.value = choice;
    apply(choice);
    try {
      if (choice === "system") localStorage.removeItem(themeKey);
      else localStorage.setItem(themeKey, choice);
    } catch {
      // Unwritable storage: the choice still holds until the app closes.
    }
  }
  return { theme, setTheme };
}
