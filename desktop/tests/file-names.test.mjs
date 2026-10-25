import test from "node:test";
import assert from "node:assert/strict";
import { exportName, maskedSuffix, withoutMaskedSuffix } from "../src/adapters/sheet-files.ts";
import { maskedName } from "../src/composables/useDocRun.ts";

test("masked copies are named (offlinemasked) in every format", () => {
  assert.equal(exportName("Sổ khách.xlsx", maskedSuffix), "Sổ khách (offlinemasked).xlsx");
  assert.equal(maskedName("Hợp đồng.docx"), "Hợp đồng (offlinemasked).docx");
  assert.equal(maskedName("Hợp đồng.pdf"), "Hợp đồng (offlinemasked).md");
});

test("restored copies drop the masked suffix, old or new", () => {
  assert.equal(withoutMaskedSuffix("Sổ khách (offlinemasked).xlsx"), "Sổ khách.xlsx");
  assert.equal(withoutMaskedSuffix("Sổ khách (đã ẩn).xlsx"), "Sổ khách.xlsx");
  assert.equal(withoutMaskedSuffix("Trả lời.md"), "Trả lời.md");
});
