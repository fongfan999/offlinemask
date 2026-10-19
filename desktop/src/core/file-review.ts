import type { Finding } from "./review.ts";

/** One hidden value in a masked file, how often it was replaced, and whether the
 * user chose to keep it as it is (decision 0079). */
export interface ReviewItem {
  alias: string;
  type: string;
  label: string;
  value: string;
  count: number;
  kept: boolean;
}
/** Every hidden value of one type, such as "Họ và tên". */
export interface ReviewGroup {
  type: string;
  label: string;
  items: ReviewItem[];
}

const aliasShape = /\[([A-Z][A-Z_]*)_\d+_[a-f0-9]{4,8}\]/gi;
export const aliasType = (alias: string) =>
  /^\[([A-Z][A-Z_]*)_\d+_[a-f0-9]{4,8}\]$/i.exec(alias)?.[1] ?? alias;

/** How many times each of a file's aliases occurs in the masked texts. */
export function countAliases(
  texts: Iterable<string>,
  findings: readonly Finding[],
): Map<string, number> {
  const known = new Set(findings.map((finding) => finding.alias));
  const counts = new Map<string, number>();
  for (const text of texts)
    for (const [alias] of text.matchAll(aliasShape))
      if (known.has(alias)) counts.set(alias, (counts.get(alias) ?? 0) + 1);
  return counts;
}

/** Hidden values grouped by type in the order the file first used them; within a
 * type, the most frequent value first. */
export function reviewGroups(
  findings: readonly Finding[],
  counts: ReadonlyMap<string, number>,
  kept: ReadonlySet<string>,
): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const finding of findings) {
    const count = counts.get(finding.alias) ?? 0;
    if (!count) continue;
    const type = aliasType(finding.alias);
    let group = groups.get(type);
    if (!group) groups.set(type, (group = { type, label: finding.label, items: [] }));
    group.items.push({
      alias: finding.alias,
      type,
      label: finding.label,
      value: finding.value,
      count,
      kept: kept.has(finding.alias),
    });
  }
  for (const group of groups.values())
    group.items.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi"));
  return [...groups.values()];
}

/** A masked text with the kept aliases put back to their values; `null` when nothing
 * of this file stays hidden in it, so the original text is used unchanged. */
export function keepAliases(
  text: string,
  values: ReadonlyMap<string, string>,
  kept: ReadonlySet<string>,
): string | null {
  let hidden = false;
  const next = text.replace(aliasShape, (alias) => {
    const value = values.get(alias);
    if (value === undefined) return alias;
    if (kept.has(alias)) return value;
    hidden = true;
    return alias;
  });
  return hidden ? next : null;
}
