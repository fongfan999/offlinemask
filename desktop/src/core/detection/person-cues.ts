import type { Detection } from "./types.ts";

/** Names found by where documents put them rather than by a model (decision 0154): after a
 * form of address ("Ông", "Bà", "Anh", "Chị") or "mang tên" / "đứng tên" (an account or a
 * deed in someone's name), and under a signature note ("(Ký, ghi rõ họ
 * tên)"). Both need a name to look like a Vietnamese one: it starts with a family name and
 * every word is one capitalised syllable. */
export const familyNames = new Set(
  "nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly truong dinh dao doan lam mai trinh cao luong quach ta to vuong ha kieu thai phung luu luc tang khuc nong thach tieu lai banh chu chau hua lo tong ung vi diep giang khong kim mac nghiem quan than ton van vien".split(
    " ",
  ),
);
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
export const nameSyllables = new Set(
  `nguyễn trần lê phạm hoàng huỳnh phan vũ võ đặng bùi đỗ hồ ngô dương lý trương đinh đào đoàn lâm mai trịnh cao lương quách tạ tô vương hà kiều thái phùng lưu lục tăng khúc nông thạch tiêu lại bành chu châu hứa lỗ tống ung vi diệp giang khổng kim mạc nghiêm quan thân tôn văn viên
   thị hữu đức minh ngọc thanh thành quốc xuân hồng thu bảo gia anh tuấn đình công huy khánh mạnh quang trung việt nam phương lan hương linh nhi như quỳnh thảo trang vy yến
   an ân ánh bá bách bằng bích bình bội cảnh cát chấn chánh chí chiến chính chương cường cương cúc dân danh diễm diệu doanh du dũng dung duy duyên đại đan đăng đạt điền điệp định đoan đôn đông đồng đức giáp hạ hải hân hằng hạnh hào hảo hậu hiền hiển hiệp hiếu hoa hòa hoài hoan hoàn học hợp huân huệ hùng hưng hường hữu huyền khải khang khánh khiêm khoa khôi khuê kiên kiệt lạc lâm lệ liên liễu loan lộc long lợi luân luận lực ly mẫn mến mi miên mỹ my nga ngân nghi nghĩa nghị ngôn nguyên nhã nhân nhàn nhất nhật nhung ninh nữ oanh phát phi phú phúc phụng phước quân quế quý quyên quyền quyết sang sâm sĩ sinh sơn sương sử tài tâm tân tấn thạch thái thắm thắng thao thế thiên thiện thịnh thọ thoa thơ thông thu thuận thục thùy thủy thy tiên tiến tín tịnh toàn toản trà trí triết triệu trọng trúc trường tú tuệ tùng tuyền tuyết tường uyên vân vàng vỹ vinh vĩnh vũ xoan xuyến ý yên
   lập lâm tự thông tin thân tài đại hưng hậu kỳ lam nhiên phong phượng sa sao thục thương trâm trân triều tuyên vĩ`
    .split(/\s+/u)
    .map((word) => word.normalize("NFC")),
);
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
  `(?<![\\p{L}\\p{M}])(Ông|Bà|Anh|Chị|ông|bà|anh|chị|ÔNG|BÀ|mang tên|đứng tên)[^\\S\\r\\n]+(${word}(?:[^\\S\\r\\n]+${word}){0,4})`,
  "gu",
);
/** A signature note; the names are on one of the next two non-empty lines. */
const signature = /\((?:ký|Ký|KÝ)[^)\r\n]*\)[^\r\n]*/gu;

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
      lineStart += line.length;
    }
  }
  return found;
}
