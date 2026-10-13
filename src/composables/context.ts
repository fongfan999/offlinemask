import { inject, type InjectionKey } from "vue";
import type { Format } from "../core/sessions.ts";
import type { useMaskingRun } from "./useMaskingRun.ts";
import type { useRecognitionPack } from "./useRecognitionPack.ts";
import type { DocRun } from "./useDocRun.ts";
import type { SheetRun } from "./useSheetRun.ts";
import type { useSessions } from "./useSessions.ts";
import type { useVault } from "./useVault.ts";

/** Top-level destinations. Session pages reuse their format as the page name. */
export type Page = "home" | "settings" | Format;

/** Focus handles pages expose to the shell after navigation or a completed run. */
export interface PageHandle {
  focusHeading(): void;
  focusResult?(): void;
}

export type RecognitionPack = ReturnType<typeof useRecognitionPack>;
export type SessionStore = ReturnType<typeof useSessions>;
export type MaskingRun = ReturnType<typeof useMaskingRun>;
export type SessionVault = ReturnType<typeof useVault>;

export const packKey: InjectionKey<RecognitionPack> = Symbol("recognition-pack");
export const sessionsKey: InjectionKey<SessionStore> = Symbol("sessions");
export const runKey: InjectionKey<MaskingRun> = Symbol("masking-run");
export const vaultKey: InjectionKey<SessionVault> = Symbol("session-vault");
export const sheetKey: InjectionKey<SheetRun> = Symbol("sheet-run");
export const docKey: InjectionKey<DocRun> = Symbol("doc-run");

/** Pages are only rendered by the shell, which provides every key. */
export function useProvided<T>(key: InjectionKey<T>): T {
  const value = inject(key);
  if (!value) throw new Error("Missing workspace context");
  return value;
}
