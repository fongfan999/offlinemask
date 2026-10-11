/** Title-case runs of two to four words, e.g. "Nguyễn Minh Anh". Used only as a
 * hint when name recognition did not run: a cheap, local nudge to look again,
 * never a detection. Place names and titles match too, so copy must say "có thể".
 */
const titleCaseRun = /\p{Lu}[\p{Ll}\p{M}]+(?:\p{Zs}\p{Lu}[\p{Ll}\p{M}]+){1,3}/gu;
const maxHints = 3;

export function possibleNames(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(titleCaseRun)) {
    seen.add(match[0]);
    if (seen.size === maxHints) break;
  }
  return [...seen];
}
