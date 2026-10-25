import { ref } from "vue";
import {
  decodeSessions,
  encodeSessions,
  historyKey,
  isExpired,
  keepDaysKey,
  parseKeepDays,
  type KeepDays,
  type Session,
  isPrivate,
  type PrivateSession,
} from "../core/sessions.ts";

export const historyReadError =
  "Không thể đọc lịch sử đã lưu. Bạn vẫn có thể ẩn thông tin mới trong lần mở này.";
export const historyWriteError = "Chưa lưu được lịch sử. Giữ ứng dụng mở để không mất các mục này.";

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;
function defaultStorage(): HistoryStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** Session list for the sidebar. Sample sessions persist here in plain storage;
 * private text sessions never do. The shell loads them from, and mirrors every
 * change into, the passcode vault (decisions 0062 and 0063).
 */
export function useSessions(storage: HistoryStorage | null = defaultStorage()) {
  const sessions = ref<Session[]>([]);
  const storageError = ref("");
  /** How long private history is kept (decision 0143); a plain preference, not private. */
  const keepDays = ref<KeepDays>(parseKeepDays(readPreference(keepDaysKey)));
  let unreadable = false;
  function readPreference(key: string) {
    try {
      return storage?.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    sessions.value = decodeSessions(storage?.getItem(historyKey) ?? null);
  } catch {
    // Leave unreadable history intact instead of overwriting it without recovery.
    unreadable = true;
    storageError.value = historyReadError;
  }
  function save() {
    if (unreadable || !storage) return;
    try {
      storage.setItem(historyKey, encodeSessions(sessions.value));
      storageError.value = "";
    } catch {
      storageError.value = historyWriteError;
    }
  }
  function add(session: Session) {
    sessions.value.unshift(session);
    if (session.fixture === "sample-v1") save();
  }
  function remove(id: string) {
    const index = sessions.value.findIndex((session) => session.id === id);
    if (index < 0) return false;
    const [removed] = sessions.value.splice(index, 1);
    if (removed?.fixture === "sample-v1") save();
    return true;
  }
  function find(id: string | null) {
    return sessions.value.find((session) => session.id === id);
  }
  /** Replace the private sessions with the vault's copy, newest first with samples.
   * Entries past the keep period are dropped on the way in. */
  function load(privateSessions: readonly PrivateSession[], now = Date.now()) {
    sessions.value = [
      ...sessions.value.filter((session) => !isPrivate(session)),
      ...privateSessions.filter((session) => !isExpired(session, keepDays.value, now)),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  /** Private entries a keep period of `days` would delete at `now`. */
  function expiring(days: number, now = Date.now()) {
    return sessions.value.filter((session) => isExpired(session, days, now));
  }
  /** Deletes the private entries past the keep period; returns their ids. */
  function expire(now = Date.now()) {
    const ids = expiring(keepDays.value, now).map((session) => session.id);
    if (ids.length) sessions.value = sessions.value.filter((session) => !ids.includes(session.id));
    return ids;
  }
  /** Changes the keep period and applies it at once. */
  function setKeepDays(days: KeepDays, now = Date.now()) {
    keepDays.value = days;
    try {
      storage?.setItem(keepDaysKey, String(days));
    } catch {
      // Unwritable storage: the choice holds until the app closes.
    }
    return expire(now);
  }
  function removePrivate() {
    sessions.value = sessions.value.filter((session) => !isPrivate(session));
  }
  return {
    sessions,
    storageError,
    keepDays,
    save,
    add,
    remove,
    find,
    load,
    expiring,
    expire,
    setKeepDays,
    removePrivate,
  };
}
