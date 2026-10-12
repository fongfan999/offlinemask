import { ref } from "vue";
import {
  nativeVaultAdapter,
  vaultErrorCode,
  type VaultAdapter,
  type VaultState,
} from "../adapters/vault.ts";
import {
  decodePrivateSessions,
  encodePrivateSessions,
  type Session,
  type TextSession,
} from "../core/sessions.ts";

export const vaultMessages = {
  "wrong-passcode": "Mật mã chưa đúng.",
  "passcode-invalid": "Mật mã gồm đúng 6 chữ số.",
  corrupt: "Tệp lịch sử đã lưu bị hỏng, không mở được. Bạn có thể xóa và bắt đầu lại.",
  exists: "Mật mã đã được đặt trước đó.",
  missing: "Không còn tệp lịch sử đã lưu.",
  locked: "Chưa mở khóa lịch sử đã lưu.",
  io: "Chưa đọc hoặc ghi được lịch sử đã lưu. Vui lòng thử lại.",
} as const;

/** Passcode-protected local store for private sessions (decision 0062).
 * The passcode is sent to the native layer and never kept here; the state
 * tells the shell whether to show the lock screen, and saves are no-ops
 * until the vault is unlocked.
 */
export function useVault(adapter: VaultAdapter = nativeVaultAdapter) {
  const state = ref<VaultState>("unavailable");
  const checked = ref(false);
  const busy = ref(false);
  const error = ref("");
  /** "Để sau" on the keep-sessions offer hides it for the rest of this launch. */
  const offerDismissed = ref(false);
  let saving: Promise<void> = Promise.resolve();
  let pending: string | null = null;

  function fail(cause: unknown) {
    error.value = vaultMessages[vaultErrorCode(cause)];
    return null;
  }
  async function start() {
    try {
      state.value = await adapter.status();
    } catch {
      state.value = "unavailable";
    } finally {
      checked.value = true;
    }
  }
  /** Returns the stored sessions, or null with `error` set. */
  async function unlock(passcode: string): Promise<TextSession[] | null> {
    if (busy.value) return null;
    busy.value = true;
    error.value = "";
    try {
      const raw = await adapter.unlock(passcode);
      const sessions = decodePrivateSessions(raw);
      state.value = "unlocked";
      return sessions;
    } catch (cause) {
      return fail(cause instanceof Error ? "corrupt" : cause);
    } finally {
      busy.value = false;
    }
  }
  async function create(passcode: string, sessions: readonly Session[]) {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    try {
      await adapter.create(passcode, encodePrivateSessions(sessions));
      state.value = "unlocked";
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      busy.value = false;
    }
  }
  /** Saves are serialized; a save requested during a save runs once after it. */
  function save(sessions: readonly Session[]) {
    if (state.value !== "unlocked") return saving;
    pending = encodePrivateSessions(sessions);
    saving = saving.then(async () => {
      while (pending !== null) {
        const data = pending;
        pending = null;
        try {
          await adapter.save(data);
          error.value = "";
        } catch (cause) {
          fail(cause);
        }
      }
    });
    return saving;
  }
  async function changePasscode(current: string, next: string) {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    try {
      await adapter.changePasscode(current, next);
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      busy.value = false;
    }
  }
  /** Forgotten passcode or explicit wipe: the file goes, sessions start empty. */
  async function reset() {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    try {
      await adapter.reset();
      state.value = "none";
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      busy.value = false;
    }
  }
  return {
    state,
    checked,
    busy,
    error,
    offerDismissed,
    start,
    unlock,
    create,
    save,
    changePasscode,
    reset,
  };
}
