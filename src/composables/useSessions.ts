import { ref } from "vue";
import { decodeSessions, encodeSessions, historyKey, type Session } from "../core/sessions.ts";

export const historyReadError =
  "Không thể đọc lịch sử đã lưu. Các phiên mới vẫn có thể dùng trong lần mở này.";
export const historyWriteError =
  "Chưa lưu được lịch sử. Giữ ứng dụng mở để tiếp tục các phiên này.";

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;
function defaultStorage(): HistoryStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** Session list for the sidebar. Only sample sessions persist; private text
 * sessions live in this list for the app's lifetime and never reach storage.
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
  return { sessions, storageError, save, add, remove, find };
}
