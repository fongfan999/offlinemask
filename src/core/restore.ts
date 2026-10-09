import type { TextAnalysis } from "./text.ts";

/** Anything shaped like one of this app's aliases: `[TYPE_n_scope]` or `[AN_THEM_n_scope]`. */
const aliasShape = /\[[A-Z][A-Z_]*_\d+_[a-f0-9]{8}\]/g;

export interface Restoration {
  text: string;
  /** Number of alias occurrences replaced with their original value. */
  restored: number;
  /** Distinct alias-shaped tokens that do not belong to this session, left untouched. */
  unknown: string[];
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
  if (!values.size) return { text, restored: 0, unknown: [...unknown] };
  const known = new RegExp([...values.keys()].map(escapeRegExp).join("|"), "g");
  let restored = 0;
  const result = text.replace(known, (alias) => {
    restored++;
    return values.get(alias)!;
  });
  return { text: result, restored, unknown: [...unknown] };
}
