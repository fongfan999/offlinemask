import type { Detection } from "./types.ts";
import { vocabulary } from "./vocabulary.ts";

/** Names found by where documents put them rather than by a model (decision 0154): after a
 * form of address ("Ông", "Bà", "Anh", "Chị") or "mang tên" / "đứng tên" (an account or a
 * deed in someone's name), and under a signature note ("(Ký, ghi rõ họ
 * tên)"). Both need a name to look like a Vietnamese one: it starts with a family name and
 * every word is one capitalised syllable. */
export const familyNames = vocabulary.people.familyNames;
/** One Vietnamese syllable without tone marks: onset, one to three vowels, final. */
const syllable =
  /^(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?[aeiouy]{1,3}(?:ng|nh|ch|[cmnpt])?$/;
export const plain = (word: string) =>
  word.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
export const isSyllable = (word: string) => syllable.test(plain(word));

/** Two to five capitalised syllables starting with a family name. */
export function looksLikeName(value: string): boolean {
  const words = value.normalize("NFC").trim().split(/\s+/u);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    familyNames.has(plain(words[0]!)) &&
    words.every((word) => /^\p{Lu}/u.test(word) && isSyllable(word))
  );
}

/** Syllables Vietnamese given and middle names are made of, with their tone marks, and
 * the family names. A heading in capitals shares the shape of a name ("QUAN HỆ GIA
 * ĐÌNH", "LÝ LỊCH", "TRÌNH CÔNG TÁC" all start with a family name), but "hệ", "lịch" and
 * "tác" name nobody. The list is broad rather than complete; it decides only where a
 * line in capitals carries no other evidence (decision 0156). */
export const nameSyllables = vocabulary.people.nameSyllables;
/** A name whose every word is a known name syllable: the check for text in capitals,
 * where a heading can share the shape of a name. */
export function looksLikeKnownName(value: string): boolean {
  if (!looksLikeName(value)) return false;
  return value
    .normalize("NFC")
    .trim()
    .split(/\s+/u)
    .every((word) => nameSyllables.has(word.toLowerCase()));
}

const word = "\\p{Lu}[\\p{L}\\p{M}]*";
const addressed = new RegExp(
  `(?<![\\p{L}\\p{M}])(${vocabulary.people.formOfAddressAlternation})[^\\S\\r\\n]+(${word}(?:[^\\S\\r\\n]+${word}){0,4})`,
  "giu",
);
/** A contract's party, labelled ("BÊN B: LÝ THU THẢO", "Bên cho thuê: Lê Phi Long"),
 * decision 0174: the party may be a company, which is a name only to the organization
 * rules, so the value must look like a person's name. */
const party = new RegExp(
  `(?<![\\p{L}\\p{M}])bên(?:[^\\S\\r\\n]+[\\p{L}\\p{M}]+){1,2}[^\\S\\r\\n]*[:：][^\\S\\r\\n]*(${word}(?:[^\\S\\r\\n]+${word}){1,4})`,
  "giu",
);
/** A signature note; the names are on one of the next two non-empty lines. On copier
 * print the "Ký" may be misread ("(ý, ghi rố họ tên)", decision 0177): "ghi rõ họ tên"
 * after it, whatever its marks, is still the note. */
const signature =
  /\((?:ký|Ký|KÝ|[^)\r\n]{0,3},[^\S\r\n]*ghi[^\S\r\n]+r\p{L}[^\S\r\n]+h\p{L}[^\S\r\n]+t\p{L}n)[^)\r\n]*\)[^\r\n]*/gu;

function finding(start: number, end: number, source: string): Detection {
  return {
    start,
    end,
    type: "TEN",
    label: "Họ và tên",
    priority: 110,
    source,
    reason:
      "Họ tên theo vị trí trong văn bản (sau cách xưng hô hoặc dưới chữ ký); hãy kiểm tra lại.",
  };
}

export function detectPersonCues(text: string): Detection[] {
  const found: Detection[] = [];
  for (const match of text.matchAll(addressed)) {
    // The longest prefix that still looks like a name: "Bà Võ Minh Yến cam kết" stops at "kết".
    const words = match[2]!.split(/[^\S\r\n]+/u);
    const start = match.index! + match[0].length - match[2]!.length;
    let count = words.length;
    // A fourth word must be a name syllable: the reader may join the next sentence
    // ("Ông Nguyễn Hữu Khang Chúng tôi …", decision 0160).
    while (
      count >= 2 &&
      !(
        looksLikeName(words.slice(0, count).join(" ")) &&
        (count <= 3 || looksLikeKnownName(words.slice(0, count).join(" ")))
      )
    )
      count--;
    // A given name alone after a lowercase form of address in a sentence: "gọi cho bà Trang".
    if (count < 2 && !(/^(?:ông|bà|anh|chị)$/u.test(match[1]!) && isSyllable(words[0]!))) continue;
    const value = words.slice(0, Math.max(count, 1)).join(" ");
    found.push(finding(start, start + value.length, "Cách xưng hô · person-cues-v1"));
  }
  for (const match of text.matchAll(party)) {
    const words = match[1]!.split(/[^\S\r\n]+/u);
    // "BÊN B: Ông LÊ PHI LONG" is the form of address's to read.
    if (/^(?:ông|bà|anh|chị)$/u.test(words[0]!.toLowerCase())) continue;
    let count = words.length;
    while (count >= 2 && !looksLikeName(words.slice(0, count).join(" "))) count--;
    const value = words.slice(0, count).join(" ");
    // In capitals, a heading can share a name's shape: its syllables must be names'.
    if (count < 2 || !(/\p{Ll}/u.test(value) || looksLikeKnownName(value))) continue;
    const start = match.index! + match[0].length - match[1]!.length;
    found.push(finding(start, start + value.length, "Bên của hợp đồng · person-cues-v1"));
  }
  for (const match of text.matchAll(signature)) {
    let lineStart = match.index! + match[0].length;
    for (let checked = 0; checked < 2;) {
      const next = /\r?\n[^\S\r\n]*/u.exec(text.slice(lineStart));
      if (!next || next.index !== 0) break;
      lineStart += next[0].length;
      const lineEnd = text.slice(lineStart).search(/\r?\n/u);
      const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineStart + lineEnd);
      if (!line.trim()) continue;
      checked++;
      // Signatures side by side share a line: " · " (the PDF reader) or a tab (Word).
      let offset = 0;
      const before = found.length;
      for (const cell of line.split(/[^\S\r\n]*(?:·|\t)[^\S\r\n]*/u)) {
        const at = line.indexOf(cell, offset);
        offset = at + cell.length;
        const value = cell.trim();
        // A role in capitals beside a signature ("CHỦ TRÌ", "THƯ KÝ") is not a name: in
        // capitals, the syllables must be ones names are made of (decision 0160).
        if (value && looksLikeName(value) && (/\p{Ll}/u.test(value) || looksLikeKnownName(value))) {
          const start = lineStart + at + cell.indexOf(value);
          found.push(finding(start, start + value.length, "Chữ ký · person-cues-v1"));
        }
      }
      // The names are one line; the next may be the page's "Trang 1/1", read "Trang VI".
      if (found.length > before) break;
      lineStart += line.length;
    }
  }
  return found;
}
