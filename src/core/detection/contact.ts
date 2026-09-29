import { LinkifyIt } from "linkify-it";
import { findPhoneNumbersInText } from "libphonenumber-js/max";
import type { Detection } from "./types.ts";

const links = new LinkifyIt({ fuzzyLink: false, fuzzyEmail: true, fuzzyIP: false });

export function detectContactDetails(text: string): Detection[] {
  const emails: Detection[] = (links.match(text) ?? [])
    .filter((match) => match.schema === "mailto:")
    .map((match) => ({
      start: match.index, end: match.lastIndex, type: "EMAIL", label: "Email", priority: 110,
      source: "linkify-it", reason: "Địa chỉ email được nhận diện đầy đủ, bao gồm tên miền.",
    }));
  const phones: Detection[] = findPhoneNumbersInText(text, "VN").map((match) => ({
    start: match.startsAt, end: match.endsAt, type: "SDT", label: "Số điện thoại", priority: 90,
    source: "libphonenumber-js · metadata đầy đủ",
    reason: "Số được đối chiếu với định dạng điện thoại; không xác nhận chủ sở hữu.",
  }));
  return [...emails, ...phones];
}
