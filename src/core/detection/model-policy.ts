import type { DecodedEntitySpan } from "openmed";
import type { Detection } from "./types.ts";

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

/** Dates/amounts/currencies stay readable; model scores are review cues, not guarantees. */
export function modelDetections(text: string, spans: readonly DecodedEntitySpan[]): Detection[] {
  const detections: Detection[] = [];
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const label = labels[span.canonical_label];
    if (!label) continue;
    const [type, name] = label;
    let { start, end } = span;
    // A subword prediction must never leave the rest of the same word exposed.
    // This repairs boundaries only; it does not guess adjacent unlabelled names.
    if (["TEN", "DIA_CHI", "TO_CHUC"].includes(type)) {
      const word = /[\p{L}\p{M}\p{N}_]/u;
      while (start > 0 && word.test(text[start] ?? "") && word.test(text[start - 1] ?? "")) start--;
      while (end < text.length && word.test(text[end - 1] ?? "") && word.test(text[end] ?? ""))
        end++;
    }
    const previous = detections[detections.length - 1];
    // The model labels Vietnamese name/address components separately.
    // A hyphen/apostrophe joins two predicted name pieces, never arbitrary prose.
    const joiner = type === "TEN" ? /^(?:[^\S\r\n]*|[-'’])$/u : /^[\s,]*$/u;
    if (
      previous &&
      (type === "TEN" || type === "DIA_CHI") &&
      previous.type === type &&
      start <= previous.end + 5 &&
      (start <= previous.end || joiner.test(text.slice(previous.end, start)))
    ) {
      previous.start = Math.min(previous.start, start);
      previous.end = Math.max(previous.end, end);
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
    });
  }
  return detections;
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
