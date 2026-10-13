import type { TextMark } from "./review-marks.ts";
import type { TextAnalysis } from "./text.ts";

/** Anything shaped like one of this app's aliases: `[TYPE_n_scope]` or `[AN_THEM_n_scope]`.
 * Scopes are four hex characters since decision 0059; eight-character ones from earlier builds still match. */
const aliasShape = /\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/g;

export interface Restoration {
  text: string;
  /** Number of alias occurrences replaced with their original value. */
  restored: number;
  /** Distinct alias-shaped tokens that do not belong to this session, left untouched. */
  unknown: string[];
  /** Where each restored value sits in `text`, for highlighting. */
  marks: TextMark[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Put original values back into text that came back from an AI tool.
 * Only exact aliases of this session are replaced (PRD FR-09). Alias-shaped
 * tokens from another session, or ones the tool rewrote, are reported and
 * never guessed. Everything else in the text is preserved character for character.
 */
export function restoreAliases(text: string, analysis: TextAnalysis): Restoration {
  const values = new Map(analysis.findings.map((finding) => [finding.alias, finding.value]));
  const unknown = new Set<string>();
  for (const match of text.matchAll(aliasShape)) {
    if (!values.has(match[0])) unknown.add(match[0]);
  }
  if (!values.size) return { text, restored: 0, unknown: [...unknown], marks: [] };
  const known = new RegExp([...values.keys()].map(escapeRegExp).join("|"), "g");
  const marks: TextMark[] = [];
  let result = "";
  let cursor = 0;
  for (const match of text.matchAll(known)) {
    result += text.slice(cursor, match.index);
    const value = values.get(match[0])!;
    marks.push({ start: result.length, end: result.length + value.length, kind: "value" });
    result += value;
    cursor = match.index + match[0].length;
  }
  result += text.slice(cursor);
  return { text: result, restored: marks.length, unknown: [...unknown], marks };
}
