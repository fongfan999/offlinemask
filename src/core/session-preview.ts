import { sessionOutput, sessionTitle, type Session } from "./sessions.ts";

const previewLength = 44;

/** Sidebar label. Private sessions show the first line of their masked copy,
 * so the list is recognisable without exposing anything the output does not.
 * Nothing here is persisted; sample sessions keep their numbered titles.
 */
export function sessionPreview(session: Session): string {
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
        .trimEnd() + "…"
    : line;
}
