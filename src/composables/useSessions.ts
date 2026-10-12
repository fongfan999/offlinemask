import { ref } from "vue";
import {
  decodeSessions,
  encodeSessions,
  historyKey,
  type Session,
  type TextSession,
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
  let unreadable = false;
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
  /** Replace the private sessions with the vault's copy, newest first with samples. */
  function load(privateSessions: readonly TextSession[]) {
    sessions.value = [
      ...sessions.value.filter((session) => session.fixture !== "private-text-v1"),
      ...privateSessions,
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  function removePrivate() {
    sessions.value = sessions.value.filter((session) => session.fixture !== "private-text-v1");
  }
  return { sessions, storageError, save, add, remove, find, load, removePrivate };
}
