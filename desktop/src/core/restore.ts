import type { TextMark } from "./review-marks.ts";
import type { Finding } from "./review.ts";
import type { TextAnalysis } from "./text.ts";

/** Anything shaped like one of this app's aliases: `[TYPE_n_scope]` or `[AN_THEM_n_scope]`.
 * Scopes are four hex characters since decision 0059; eight-character ones from earlier builds still match. */
export const aliasShape = /\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/g;

/** Every alias-shaped token in `text`, in order, duplicates included. */
export function aliasTokens(text: string): string[] {
  return [...text.matchAll(aliasShape)].map((match) => match[0]);
}

export interface Restoration {
  text: string;
  /** Number of alias occurrences replaced with their original value. */
  restored: number;
  /** Distinct alias-shaped tokens that do not belong to this session, left untouched. */
  unknown: string[];
  /** Where each restored value sits in `text`, for highlighting. */
  marks: TextMark[];
}

/** Alias to original value. Build it once per restore and reuse it for every cell or
 * paragraph: a big spreadsheet has hundreds of thousands of aliases (decision 0179). */
export type AliasValues = ReadonlyMap<string, string>;

export function aliasValues(findings: readonly Finding[]): AliasValues {
  return new Map(findings.map((finding) => [finding.alias, finding.value]));
}

/** Put original values back into text that came back from an AI tool.
 * Only exact aliases of this session are replaced (PRD FR-09). Alias-shaped
 * tokens from another session, or ones the tool rewrote, are reported and
 * never guessed. Everything else in the text is preserved character for character.
 * One pass over the alias-shaped tokens, each looked up in `values`, so the cost
 * follows the text, not the number of known aliases.
 */
export function restoreWith(text: string, values: AliasValues): Restoration {
  const unknown = new Set<string>();
  const marks: TextMark[] = [];
  let result = "";
  let cursor = 0;
  for (const match of text.matchAll(aliasShape)) {
    const value = values.get(match[0]);
    if (value === undefined) {
      unknown.add(match[0]);
      continue;
    }
    result += text.slice(cursor, match.index);
    marks.push({ start: result.length, end: result.length + value.length, kind: "value" });
    result += value;
    cursor = match.index + match[0].length;
  }
  if (!marks.length) return { text, restored: 0, unknown: [...unknown], marks };
  result += text.slice(cursor);
  return { text: result, restored: marks.length, unknown: [...unknown], marks };
}

/** `restoreWith` for one session's analysis. */
export function restoreAliases(text: string, analysis: TextAnalysis): Restoration {
  return restoreWith(text, aliasValues(analysis.findings));
}
