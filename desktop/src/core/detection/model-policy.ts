import type { DecodedEntitySpan } from "openmed";
import type { Detection } from "./types.ts";
import { looksLikeKnownName, looksLikeName } from "./person-cues.ts";

const labels: Record<string, [string, string]> = {
  PERSON: ["TEN", "Họ và tên"],
  FIRST_NAME: ["TEN", "Họ và tên"],
  MIDDLE_NAME: ["TEN", "Họ và tên"],
  LAST_NAME: ["TEN", "Họ và tên"],
  USERNAME: ["NGUOI_DUNG", "Tên đăng nhập"],
  EMAIL: ["EMAIL", "Email"],
  PHONE: ["SDT", "Số điện thoại"],
  ACCOUNT_NUMBER: ["STK", "Số tài khoản"],
  IBAN: ["STK", "Số tài khoản"],
  ID_NUM: ["GIAY_TO", "Số giấy tờ"],
  SSN: ["GIAY_TO", "Số giấy tờ"],
  CREDIT_CARD: ["THE", "Số thẻ"],
  CVV: ["MA_BAO_MAT", "Mã bảo mật thẻ"],
  PIN: ["MA_BAO_MAT", "Mã PIN"],
  PASSWORD: ["MAT_KHAU", "Mật khẩu"],
  API_KEY: ["KHOA", "Khóa truy cập"],
  STREET_ADDRESS: ["DIA_CHI", "Địa chỉ"],
  BUILDING_NUMBER: ["DIA_CHI", "Địa chỉ"],
  LOCATION: ["DIA_CHI", "Địa chỉ"],
  ZIPCODE: ["DIA_CHI", "Địa chỉ"],
  GPS_COORDINATES: ["TOA_DO", "Tọa độ"],
  IP_ADDRESS: ["IP", "Địa chỉ IP"],
  ORGANIZATION: ["TO_CHUC", "Tổ chức"],
  DATE_OF_BIRTH: ["NGAY_SINH", "Ngày sinh"],
};

/** Provenance of a span built from more than one model before the pack relabels it. */
export const combinedModelSource = "Kết hợp nhiều mô hình";
/** Placeholder provenance; the model runner replaces it with the provider's source. */
export const defaultModelSource = "Mô hình nhận diện";

const contextual = new Set(["TEN", "DIA_CHI", "TO_CHUC"]);
/** A single word is weak evidence of a name, place or organization: a real one scores
 * close to 1 ("Lan", "Hùng", "Huế"), while a model's one-word misreadings of prose sit
 * below this ("Đại", "Hán", "Kinh"). Measured on the pack models (decision 0081). */
export const singleWordMinScore = 0.6;
const word = /[\p{L}\p{M}\p{N}_]/u;
/** A field separator or a line break never sits inside one name, place or organization;
 * a sentence end never sits inside a name or an organization (addresses keep "TP. HCM"). */
const addressSeparators = /[:：\t\r\n]/gu;
const nameSeparators = /[:：\t\r\n]|\.(?=\s|$)/gu;
/** The parties of a Vietnamese contract ("Bên A", "BÊN B", "Bên thuê", "Các Bên"): a role
 * in the text, never a person, place or organization. A closed list, so "bên chị Lan"
 * still keeps the name. */
const partyRoles = [
  "\\p{L}",
  "\\d{1,2}",
  "(?:thứ\\s+)?(?:nhất|hai|ba|bốn|năm)",
  "kia",
  "còn\\s+lại",
  "(?:bị\\s+)?vi\\s+phạm",
  "bị\\s+ảnh\\s+hưởng",
  "(?:cho\\s+)?(?:mua|bán|thuê|vay|mượn|tặng)(?:\\s+lại)?",
  "(?:được|nhận)\\s+(?:tặng\\s+cho|bảo\\s+lãnh|ủy\\s+quyền|chuyển\\s+nhượng|thế\\s+chấp|đặt\\s+cọc|nhượng\\s+quyền|bảo\\s+hiểm)",
  "(?:bảo\\s+lãnh|ủy\\s+quyền|chuyển\\s+nhượng|thế\\s+chấp|đặt\\s+cọc|nhượng\\s+quyền|bảo\\s+hiểm|góp\\s+vốn|gia\\s+công)",
  "(?:nhận|giao|cung\\s+cấp|sử\\s+dụng|đặt|thi\\s+công|phân\\s+phối|đại\\s+lý)(?:\\s+(?:hàng|dịch\\s+vụ))?",
];
const party = new RegExp(
  `^(?:(?:các|hai|ba|mỗi|một|từng)\\s+)?bên(?:\\s+(?:${partyRoles.join("|")}))?$`,
  "iu",
);

/** Contract boilerplate that Title Case makes look like names ("Sự Kiện Bất Khả Kháng",
 * "Phí Dịch Vụ - Thanh Toán", "Bằng chữ: Tám triệu đồng"): a span inside one of these
 * phrases, or inside an amount written in words, is a misreading. Whole phrases only, so
 * "Nguyễn Thanh Toán" or "Công ty Dịch vụ Bình An", which reach past them, are kept. */
const numberWords =
  "một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|mươi|lăm|linh|lẻ|trăm|nghìn|ngàn|triệu|tỷ|tỉ";
const boilerplatePhrases = [
  "hợp đồng cộng tác viên",
  "sự kiện bất khả kháng",
  "bất khả kháng",
  "hợp đồng",
  "phụ lục",
  "điều khoản",
  "điều \\d+",
  "khoản \\d+",
  "mục \\d+",
  "cộng tác viên",
  "phí dịch vụ",
  "dịch vụ",
  "thanh toán",
  "thù lao",
  "bằng chữ",
  "bằng văn bản",
  "mọi thông tin mật",
  "thông tin mật",
  "mọi thông tin",
  "bảo mật",
  "án phí",
  "phạt vi phạm",
  "phạt",
  "vi phạm",
  "bồi thường",
  "thiệt hại",
  "các bên",
  "hai bên",
  "mỗi bên",
  "bên kia",
  "bên thứ ba",
  "giấy ủy quyền",
  "giấy phép",
  "giấy tờ",
  "giấy chứng nhận",
  "sản phẩm",
  "bao bì",
  "chức vụ",
  "(?:tổng |phó )?giám đốc(?: (?:tài chính|điều hành|kinh doanh|nhân sự|kỹ thuật|dự án|sản xuất|chi nhánh))?",
  "kế toán trưởng",
  "trưởng phòng",
  "chủ tịch(?: hội đồng (?:quản trị|thành viên))?",
  `(?:(?:${numberWords}) )+(?:trăm|nghìn|ngàn|triệu|tỷ|tỉ|đồng|vnd|usd)`,
  // Invoices and receipts (decision 0155): their title in capitals ("HÓA ĐƠN GIÁ TRỊ GIA
  // TĂNG"), column headings and footer, which a model reads as names.
  "hóa đơn",
  "điện tử",
  "giá trị gia tăng",
  "gtgt",
  "thuế suất",
  "tiền thuế",
  "thuế",
  "thành tiền",
  "đơn giá",
  "đơn vị tính",
  "số lượng",
  "tổng cộng",
  "tổng hợp",
  "tổng tiền",
  "ký hiệu",
  "mã số thuế",
  "người mua hàng",
  "người bán hàng",
  "bán hàng",
  "mã tra cứu",
  "trang tra cứu",
  "tra cứu",
  "trang \\d+(?:/\\d+)?",
  // The national header of contracts and forms, and field names of statements and forms
  // that a model reads as a name on their own (decision 0156).
  "cộng hòa xã hội chủ nghĩa việt nam",
  "cộng hoà xã hội chủ nghĩa việt nam",
  "độc lập [-–] tự do [-–] hạnh phúc",
  "giới tính",
  "dân tộc",
  "ghi nợ",
  "ghi có",
  "số dư",
  "loại tiền",
];
/** Countries and regions: a span that is only one of these is where something comes
 * from ("Thịt bò Úc"), not anyone's address; an address that ends in one is kept whole. */
const countries = new Set(
  [
    "việt nam",
    "úc",
    "mỹ",
    "hoa kỳ",
    "anh",
    "pháp",
    "đức",
    "ý",
    "nga",
    "nhật",
    "nhật bản",
    "hàn quốc",
    "trung quốc",
    "đài loan",
    "hồng kông",
    "thái lan",
    "lào",
    "campuchia",
    "singapore",
    "malaysia",
    "indonesia",
    "philippines",
    "ấn độ",
    "canada",
    "new zealand",
    "tây ban nha",
    "hà lan",
    "thụy sĩ",
    "châu âu",
    "châu á",
    "châu mỹ",
    "châu phi",
    "châu úc",
  ].map((name) => name.normalize("NFC")),
);
// Longest phrase first, and consecutive phrases form one run ("HỢP ĐỒNG DỊCH VỤ").
const phrase = `(?:${[...boilerplatePhrases]
  .sort((a, b) => b.length - a.length)
  .join("|")
  .replace(/ /g, "[^\\S\\r\\n]+")})`;
const boilerplate = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}])${phrase}(?:[^\\S\\r\\n]+${phrase})*(?![\\p{L}\\p{M}\\p{N}])`,
  "giu",
);
/** Ranges of the boilerplate phrases in one text, for spans to be checked against. */
export function boilerplateRanges(text: string): [number, number][] {
  return [...text.normalize("NFC").matchAll(boilerplate)].map((match) => [
    match.index,
    match.index + match[0].length,
  ]);
}

/** Whether a predicted name, place or organization can be one at all: it needs a letter
 * and two symbols (a place may count digits: "Quận 5"), it is not a contract party, and
 * a place is not only a country. */
export function plausibleContextualSpan(type: string, value: string): boolean {
  if (!contextual.has(type)) return true;
  const content = value.normalize("NFC");
  const symbols = content.match(type === "DIA_CHI" ? /[\p{L}\p{N}]/gu : /\p{L}/gu) ?? [];
  if (symbols.length < 2 || !/\p{L}/u.test(content)) return false;
  const words = content
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (type === "DIA_CHI" && countries.has(words.toLowerCase())) return false;
  // A currency code on its own ("Loại tiền: VND") is neither a place nor an organization.
  if (/^(?:vnd|vnđ|usd|eur|jpy|gbp|aud|sgd|krw|cny)$/iu.test(words)) return false;
  return !party.test(words);
}

/** One Vietnamese syllable, without its tone marks: an onset, one to three vowels and a
 * final. "VISSAN", "PACOW", "FPT", "JEMMIA" are not one. */
const syllable =
  /^(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?[aeiouy]{1,3}(?:ng|nh|ch|[cmnpt])?$/;
const fold = (word: string) =>
  word.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/giu, "d").toLowerCase();
/** A single word in capitals that no Vietnamese syllable spells is a brand or an acronym
 * ("VISSAN Xúc xích", "WINECO Cải ngọt"), not a person. A Vietnamese name in capitals ("NGUYỄN", "HÀ")
 * is made of syllables and is kept, as is a foreign name in Title Case. */
export function brandInCapitals(value: string): boolean {
  const word = value.normalize("NFC").trim();
  return (
    /^\p{Lu}[\p{Lu}\p{M}]{2,}$/u.test(word) &&
    word === word.toUpperCase() &&
    !syllable.test(fold(word))
  );
}

/** A predicted span cut at the separators its type never contains, trimmed. */
function pieces(text: string, start: number, end: number, type: string) {
  const result: [number, number][] = [];
  const pattern = type === "DIA_CHI" ? addressSeparators : nameSeparators;
  let cursor = start;
  const push = (from: number, to: number) => {
    while (from < to && /\s/u.test(text[from]!)) from++;
    while (to > from && /\s/u.test(text[to - 1]!)) to--;
    if (to > from) result.push([from, to]);
  };
  for (const match of text.slice(start, end).matchAll(pattern)) {
    push(cursor, start + match.index);
    cursor = start + match.index + match[0].length;
  }
  push(cursor, end);
  return result;
}

/** Dates/amounts/currencies stay readable; model scores are review cues, not guarantees. */
export function modelDetections(text: string, spans: readonly DecodedEntitySpan[]): Detection[] {
  const detections: Detection[] = [];
  const typed = [...spans]
    .sort((a, b) => a.start - b.start)
    .flatMap((span) => {
      const label = labels[span.canonical_label];
      if (!label) return [];
      const [type, name] = label;
      // A span never crosses a field separator or a line; each side stands on its own.
      const parts = contextual.has(type)
        ? pieces(text, span.start, span.end, type)
        : [[span.start, span.end] as [number, number]];
      return parts.map(([start, end]) => ({
        start,
        end,
        type,
        name,
        score: span.score ?? undefined,
      }));
    });
  for (const piece of typed) {
    const { type, name, score } = piece;
    let { start, end } = piece;
    // A subword prediction must never leave the rest of the same word exposed.
    // This repairs boundaries only; it does not guess adjacent unlabelled names.
    if (contextual.has(type)) {
      while (start > 0 && word.test(text[start] ?? "") && word.test(text[start - 1] ?? "")) start--;
      while (end < text.length && word.test(text[end - 1] ?? "") && word.test(text[end] ?? ""))
        end++;
    }
    const previous = detections[detections.length - 1];
    // The model labels Vietnamese name/address components separately.
    // A hyphen/apostrophe joins two predicted name pieces, never arbitrary prose, and
    // never a tab: the next cell is another value ("Bố\tNguyễn Văn An").
    const joiner = type === "TEN" ? /^(?:[^\S\r\n\t]*|[-'’])$/u : /^(?:[^\S\r\n\t]|,)*$/u;
    if (
      previous &&
      (type === "TEN" || type === "DIA_CHI") &&
      previous.type === type &&
      start <= previous.end + 5 &&
      (start <= previous.end || joiner.test(text.slice(previous.end, start)))
    ) {
      previous.start = Math.min(previous.start, start);
      previous.end = Math.max(previous.end, end);
      if (score !== undefined) previous.score = Math.max(previous.score ?? 0, score);
      continue;
    }
    detections.push({
      start,
      end,
      type,
      label: name,
      priority: 50,
      source: defaultModelSource,
      reason: "Mô hình nhận diện theo ngữ cảnh. Hãy kiểm tra lại phạm vi thông tin được ẩn.",
      ...(score !== undefined ? { score } : {}),
    });
  }
  return plausibleModelDetections(text, detections);
}

/** Drop the spans no name, place or organization can be. Applied per model window and
 * again on the whole text, where a phrase cut by a window edge is whole. Decomposed
 * text skips the phrase check: ranges are NFC positions, and the window text is NFC. */
export function plausibleModelDetections(text: string, detections: readonly Detection[]) {
  const phrases = text === text.normalize("NFC") ? boilerplateRanges(text) : [];
  return detections.flatMap((detection) => {
    const d = detection.type === "TEN" ? withoutBrands(text, detection) : detection;
    if (!d) return [];
    const value = text.slice(d.start, d.end);
    if (!plausibleContextualSpan(d.type, value)) return [];
    if (!contextual.has(d.type)) return [d];
    if (phrases.some(([start, end]) => start <= d.start && d.end <= end)) return [];
    if (productCell(text, d.start, d.end)) return [];
    if (wordingColumn(text, d.start, d.end)) return [];
    if (transactionCell(text, d.start, d.end, d.type, value)) return [];
    if (capitalHeading(text, d.start, d.end, d.type, value)) return [];
    // One word on its own (a cell, a short message) is the whole evidence there is.
    const alone = value.trim() === text.trim();
    return alone || /\s/u.test(value.trim()) || (d.score ?? 1) >= singleWordMinScore ? [d] : [];
  });
}

/** A name span without the brands in capitals at its edges ("VISSAN Xúc" → "Xúc"),
 * or nothing when only brands are left. */
function withoutBrands(text: string, detection: Detection): Detection | undefined {
  let { start, end } = detection;
  for (;;) {
    const first = /^[\p{L}\p{M}]+/u.exec(text.slice(start, end))?.[0];
    if (!first || !brandInCapitals(first)) break;
    start += first.length;
    while (start < end && /\s/u.test(text[start]!)) start++;
  }
  for (;;) {
    const last = /[\p{L}\p{M}]+$/u.exec(text.slice(start, end))?.[0];
    if (!last || !brandInCapitals(last)) break;
    end -= last.length;
    while (end > start && /\s/u.test(text[end - 1]!)) end--;
  }
  if (end <= start) return undefined;
  return start === detection.start && end === detection.end
    ? detection
    : { ...detection, start, end };
}

/** A product's measure, pack or unit ("300g", "3kg", "1,5 l", "gói", "hộp", "khay", and
 * an invoice's unit column: "KG", "HOP", "KH", "G1", "cái"). A table
 * cell (text with a tab on at least one side, as the PDF reader writes rows) that has
 * one describes goods: a model's name, place or organization there is product wording
 * ("AN ĐÌNH Gạo Japonica BB-3kg", "OLALA Trứng Gà Sạch hộp", "WINECO Cải ngọt 300g"),
 * whatever its score (decision 0155); so is one anywhere in a row whose unit column holds
 * a unit ("3 | Ốc Hương Thiên Nhiên | Kg | 0,64"). A sentence is not a cell: "Gửi 2 hộp
 * bánh cho anh Nguyễn Văn An" keeps its name. */
const productMeasure =
  /\d+(?:[.,]\d+)?[^\S\r\n]?(?:g|gr|kg|mg|ml|l|lít|cm|mm)(?![\p{L}\p{N}])|(?<![\p{L}\p{M}])(?:gói|goi|hộp|hop|khay|kh|chai|lon|túi|thùng|bịch|hũ|vỉ|lốc|kg|ml|g1|cái|cai|chiếc|bộ|cuộn)(?![\p{L}\p{M}\p{N}])/iu;
/** A unit on its own in a cell: the "Đơn vị tính" column of a goods table. */
const unitCell =
  /^(?:kg|g|gr|mg|ml|l|lít|lit|hộp|hop|gói|goi|khay|kh|chai|lon|cái|cai|chiếc|chiec|bộ|bo|cuộn|cuon|phần|phan|suất|suat|đĩa|dia|ly|cốc|coc|thùng|thung|túi|tui|bịch|bich|hũ|hu|vỉ|vi|lốc|loc|tờ|to|quyển|quyen|cây|cay|bó|con|g1)$/iu;
function productCell(text: string, start: number, end: number): boolean {
  const tab = text.lastIndexOf("\t", start - 1);
  const line = text.lastIndexOf("\n", start - 1);
  const nextTab = text.indexOf("\t", end);
  const nextLine = text.indexOf("\n", end);
  const cellStart = Math.max(tab, line) + 1;
  const cellEnd = Math.min(
    nextTab < 0 ? text.length : nextTab,
    nextLine < 0 ? text.length : nextLine,
  );
  const tabbed = (tab > line && tab >= 0) || (nextTab >= 0 && (nextLine < 0 || nextTab < nextLine));
  if (!tabbed) return false;
  if (productMeasure.test(text.slice(cellStart, cellEnd))) return true;
  // A row whose unit column holds a unit ("Kg", "Phần", "Lon") lists goods.
  const row = text.slice(line + 1, nextLine < 0 ? text.length : nextLine);
  return row.split("\t").some((cell) => unitCell.test(cell.trim()));
}

/** The line a span is on and the tabbed cell it is in; `column` counts the cells before. */
function rowAround(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineBreak = text.indexOf("\n", end);
  const lineEnd = lineBreak < 0 ? text.length : lineBreak;
  const tabBefore = text.lastIndexOf("\t", start - 1);
  const tabAfter = text.indexOf("\t", end);
  const cellStart = Math.max(lineStart, tabBefore + 1);
  const cellEnd = tabAfter < 0 || tabAfter > lineEnd ? lineEnd : tabAfter;
  const row = text.slice(lineStart, lineEnd);
  return {
    row,
    cells: row.split("\t"),
    tabbed: row.includes("\t"),
    cell: text.slice(cellStart, cellEnd),
    column: text.slice(lineStart, start).split("\t").length - 1,
    lineStart,
  };
}

/** Column headings under which a cell holds wording, never a person, place or
 * organization: a relation, a job title, goods, a unit, a quantity or a price. */
const wordingHeading =
  /^(?:quan hệ|chức vụ|chức danh|nghề nghiệp|vị trí|trình độ|tên hàng|hàng hóa|hàng hoá|tên sản phẩm|sản phẩm|mặt hàng|nội dung hàng|đơn vị tính|đvt|số lượng|đơn giá|thành tiền|loại)(?![\p{L}\p{M}])/iu;
/** Whether a tabbed cell stands in a column whose heading says it holds wording
 * (decision 0156): "Bố" under "Quan hệ", "Trưởng nhóm" under "Chức vụ", goods under "Tên
 * hàng hóa, dịch vụ". The heading is the same cell of the first row of the run of rows
 * with as many cells above this one; rows read as one paragraph each sit a blank line
 * apart. A cell of the heading row itself counts too. */
function wordingColumn(text: string, start: number, end: number): boolean {
  const { tabbed, cells, column, lineStart } = rowAround(text, start, end);
  if (!tabbed) return false;
  let heading = cells[column] ?? "";
  for (let at = lineStart; at > 0;) {
    const previousStart = text.lastIndexOf("\n", at - 2) + 1;
    const line = text.slice(previousStart, at - 1);
    if (line.trim()) {
      const above = line.split("\t");
      if (above.length !== cells.length) break;
      heading = above[column] ?? "";
    }
    at = previousStart;
  }
  return wordingHeading.test(heading.trim().normalize("NFC"));
}

const dateCell =
  /^\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/u;
const amountCell = /^\s*[+-]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\s*(?:đ|vnd|vnđ)?\s*$/iu;
/** A transaction row of a bank statement is a tabbed row with a date cell and an amount
 * cell. In a cell of it written without tone marks ("TRA LUONG THANG 9", "Thanh toan QR",
 * "Rut tien ATM"), the models, trained on accented Vietnamese, read the wording as names,
 * places and organizations (decision 0156). A name there is kept only in the shape of one
 * (a family name first, every word a syllable); a company is found by its legal form
 * (context-fields) and a person by their position (detectTransferNames), not by a model. */
function transactionCell(
  text: string,
  start: number,
  end: number,
  type: string,
  value: string,
): boolean {
  const { tabbed, cells, cell } = rowAround(text, start, end);
  if (!tabbed || cells.length < 3) return false;
  if (!cells.some((c) => dateCell.test(c)) || !cells.some((c) => amountCell.test(c))) return false;
  if (/\p{M}|[đĐ]/u.test(cell.normalize("NFD"))) return false;
  return type !== "TEN" || !looksLikeName(value);
}

const addressWord =
  /(?<![\p{L}\p{M}])(?:số|đường|phố|ngõ|ngách|hẻm|thôn|xóm|ấp|khu|tổ|xã|phường|thị trấn|quận|huyện|thị xã|tỉnh|thành phố|tp|q|p|kp|kdc|tòa|toà|lầu|tầng|lô)(?![\p{L}\p{M}])/iu;
const organizationWord =
  /(?<![\p{L}\p{M}])(?:công ty|cty|tnhh|cổ phần|cp|tmcp|tập đoàn|tổng công ty|doanh nghiệp|hợp tác xã|htx|hộ kinh doanh|ngân hàng|chi nhánh|phòng giao dịch|trường|học viện|đại học|bệnh viện|phòng khám|ủy ban|uỷ ban|ubnd|trung tâm|văn phòng|cửa hàng|siêu thị|nhà hàng|khách sạn|nhà máy|xí nghiệp|công đoàn|liên đoàn|hiệp hội|jsc|co\.?|ltd|inc|corp|group|bank|company|limited)(?![\p{L}\p{M}])/iu;
const cellBreak = /\t|\r?\n|[^\S\r\n]·[^\S\r\n]/u;
/** The cell or line around a span: text between tabs, line breaks or the " · " the PDF
 * reader puts between two fields of one line. */
function cellAround(text: string, start: number, end: number): string {
  let from = 0;
  for (const match of text.slice(0, start).matchAll(new RegExp(cellBreak, "gu")))
    from = match.index + match[0].length;
  const next = cellBreak.exec(text.slice(end));
  return text.slice(from, next ? end + next.index : text.length);
}
/** A model's name, place or organization in a line or cell written in capitals ("SAO KÊ
 * TÀI KHOẢN", "ĐẠI DIỆN BÊN A", "I. THÔNG TIN BẢN THÂN", "YÊU CẦU TRA SOÁT GIAO DỊCH") is
 * a heading unless it has the evidence of its type (decision 0156): a name is made of
 * name syllables and starts with a family name (the span, or the whole cell when a model
 * cut a name in two); a place has a digit or an address word in the cell; an organization
 * has its legal form or kind. A parenthesis and a trailing colon are not part of the test
 * ("NGƯỜI LAO ĐỘNG (Bên B):"); a cell of one word is left to the score rule. */
function capitalHeading(
  text: string,
  start: number,
  end: number,
  type: string,
  value: string,
): boolean {
  const head = cellAround(text, start, end)
    .replace(/\([^)]*\)/gu, " ")
    .replace(/[:：]\s*$/u, "")
    .trim();
  if (/\p{Ll}/u.test(head) || (head.match(/[\p{L}\p{M}]+/gu) ?? []).length < 2) return false;
  if (type === "TEN") return !looksLikeKnownName(value) && !looksLikeKnownName(head);
  if (type === "DIA_CHI") return !/\p{N}/u.test(head) && !addressWord.test(head);
  return !organizationWord.test(head);
}

/** Combine overlapping evidence across models/windows without dropping exposed tails. */
export function mergeModelDetections(detections: readonly Detection[]): Detection[] {
  const merged: Detection[] = [];
  for (const span of [...detections].sort(
    (a, b) => a.type.localeCompare(b.type) || a.start - b.start,
  )) {
    const previous = merged[merged.length - 1];
    if (previous && previous.type === span.type && span.start < previous.end) {
      previous.end = Math.max(previous.end, span.end);
      if (previous.source !== span.source) previous.source = combinedModelSource;
    } else merged.push({ ...span });
  }
  return merged;
}
