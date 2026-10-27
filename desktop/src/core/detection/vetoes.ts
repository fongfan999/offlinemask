/** The mechanisms that veto or trim a model's name, place or organization, by name, so a
 * measurement can switch one off and see what comes back: which of them a fine-tuned
 * candidate still needs (decision 0164). The app never changes them; `compare-packs.mjs`
 * does, in its own process, between runs over the same documents. */
export const vetoNames = [
  /** A span inside a boilerplate phrase ("HÓA ĐƠN GIÁ TRỊ GIA TĂNG", "Bằng chữ"). */
  "phrases",
  /** A public body with its jurisdiction ("Sở Nội vụ Thành phố Hồ Chí Minh"). */
  "publicBodies",
  /** The place of issue before the date of an official document. */
  "issuePlaces",
  /** A table cell describing goods, by its measure, pack or unit column. */
  "productCells",
  /** A cell under a wording heading ("Quan hệ", "Chức vụ", "Tên hàng hóa"). */
  "wordingColumns",
  /** Unaccented wording in a statement's transaction row. */
  "transactionCells",
  /** A heading in capitals without the evidence of its type. */
  "capitalHeadings",
  /** A department or unit inside an organization, and a sex after its label. */
  "departments",
  /** A value after a wording label ("Chức vụ: Giám đốc"). */
  "wordingFields",
  /** A role in capitals inside a line of prose ("TL. HIỆU TRƯỞNG TRƯỞNG PHÒNG"). */
  "capitalRoles",
  /** Brands in capitals trimmed from a name's edges; a unit trimmed from an organization. */
  "trims",
  /** One word on its own needs a confident score. */
  "singleWords",
] as const;
export type Veto = (typeof vetoNames)[number];

const off = new Set<Veto>();
/** Whether a mechanism is in force (always, outside a measurement). */
export const vetoOn = (name: Veto): boolean => !off.has(name);
/** Switch mechanisms off for a measurement; an empty list restores every one. */
export function setVetoes(disabled: readonly Veto[]): void {
  off.clear();
  for (const name of disabled) {
    if (!vetoNames.includes(name)) throw new Error(`Unknown veto: ${name}`);
    off.add(name);
  }
}
export const disabledVetoes = (): Veto[] => [...off];
