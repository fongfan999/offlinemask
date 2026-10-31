import { sessionOutput, sessionTitle, type Session } from "./sessions.ts";

const previewLength = 44;

/** Sidebar label. Private sessions show the first line of their masked copy,
 * so the list is recognisable without exposing anything the output does not.
 * Nothing here is persisted; sample sessions keep their numbered titles.
 */
export function sessionPreview(session: Session): string {
  if (session.fixture === "private-sheet-v1" || session.fixture === "private-doc-v1")
    return session.fileName;
  if (session.fixture !== "private-text-v1") return sessionTitle(session);
  const line = sessionOutput(session)
    .split(/\r?\n/u)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return sessionTitle(session);
  const graphemes = [...new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(line)];
  return graphemes.length > previewLength
    ? graphemes
        .slice(0, previewLength)
        .map((item) => item.segment)
        .join("")
        .trimEnd() + "..."
    : line;
}

/** Sidebar date: day, month and time, in Vietnamese order. */
export function sessionDate(session: Session): string {
  return new Date(session.createdAt).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lower case without accents, so "hop dong" finds "Hợp đồng" (decision 0192). */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gu, "d")
    .replace(/Đ/gu, "D")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

/** What a history entry can be found by: its title, date and file name, a text's
 * original and masked copy, and a file's hidden values. */
function searchText(session: Session): string {
  const parts = [sessionTitle(session), sessionDate(session)];
  if (session.fixture === "private-text-v1") parts.push(session.original, sessionOutput(session));
  else if (session.fixture === "private-sheet-v1" || session.fixture === "private-doc-v1")
    parts.push(session.fileName, ...session.findings.map((finding) => finding.value));
  else parts.push(sessionPreview(session));
  return parts.join(" ");
}

/** Whether a history entry matches what was typed in the sidebar search (decision 0192).
 * Hidden values match too, so a customer's name finds the entries that held it; the
 * history is already unlocked, so this shows nothing its owner cannot open. Every word
 * must appear, in any order. */
export function matchesSearch(session: Session, query: string): boolean {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = searchKey(searchText(session));
  return words.every((word) => haystack.includes(word));
}
