import { invoke, isTauri } from "@tauri-apps/api/core";

/** Where private sessions can live: nowhere (browser preview), not yet (no
 * passcode set), sealed on disk (locked), or open for this launch (unlocked). */
export type VaultState = "unavailable" | "none" | "locked" | "unlocked";

export interface VaultAdapter {
  status(): Promise<VaultState>;
  create(passcode: string, data: string): Promise<void>;
  unlock(passcode: string): Promise<string>;
  save(data: string): Promise<void>;
  changePasscode(current: string, next: string): Promise<void>;
  reset(): Promise<void>;
}

export const desktopVault = isTauri();

/** Error codes from the native `vault` module. Anything else is an I/O message. */
export type VaultErrorCode =
  "wrong-passcode" | "passcode-too-short" | "exists" | "missing" | "locked" | "corrupt";

export function vaultErrorCode(error: unknown): VaultErrorCode | "io" {
  const text = typeof error === "string" ? error : "";
  if (text.startsWith("io:")) return "io";
  return (
    ["wrong-passcode", "passcode-too-short", "exists", "missing", "locked", "corrupt"] as const
  ).includes(text as VaultErrorCode)
    ? (text as VaultErrorCode)
    : "io";
}

export const nativeVaultAdapter: VaultAdapter = {
  async status() {
    if (!desktopVault) return "unavailable";
    const { state } = await invoke<{ state: Exclude<VaultState, "unavailable"> }>("vault_status");
    return state;
  },
  create: (passcode, data) => invoke("vault_create", { passcode, data }),
  unlock: (passcode) => invoke<string>("vault_unlock", { passcode }),
  save: (data) => invoke("vault_save", { data }),
  changePasscode: (current, next) => invoke("vault_change_passcode", { current, next }),
  reset: () => invoke("vault_reset"),
};
