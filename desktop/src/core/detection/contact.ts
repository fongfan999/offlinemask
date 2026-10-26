import { LinkifyIt } from "linkify-it";
import { findPhoneNumbersInText } from "libphonenumber-js/max";
import type { Detection } from "./types.ts";

const links = new LinkifyIt({ fuzzyLink: false, fuzzyEmail: true, fuzzyIP: false });

export function detectContactDetails(text: string): Detection[] {
  const emails: Detection[] = (links.match(text) ?? [])
    .filter((match) => match.schema === "mailto:")
    .map((match) => ({
      start: match.index,
      end: match.lastIndex,
      type: "EMAIL",
      label: "Email",
      priority: 110,
      source: "linkify-it",
      reason: "Địa chỉ email được nhận diện đầy đủ, bao gồm tên miền.",
    }));
  // An amount with thousands separators ("69.600.000") is not a phone number, however
  // the library parses its digits; a phone number is never grouped in threes from a
  // group of one to three (decision 0156).
  const amount = /^\d{1,3}(?:[.,]\d{3})+$/;
  const phones: Detection[] = findPhoneNumbersInText(text, "VN")
    .filter((match) => !amount.test(text.slice(match.startsAt, match.endsAt)))
    .map((match) => ({
      start: match.startsAt,
      end: match.endsAt,
      type: "SDT",
      label: "Số điện thoại",
      priority: 90,
      source: "libphonenumber-js · metadata đầy đủ",
      reason: "Số được đối chiếu với định dạng điện thoại; không xác nhận chủ sở hữu.",
    }));
  return [...emails, ...phones];
}
