import test from "node:test";
import assert from "node:assert/strict";
import {
  exportName,
  maskedSuffix,
  unmaskedSuffix,
  withoutMaskedSuffix,
} from "../src/adapters/sheet-files.ts";
import { maskedName } from "../src/composables/useDocRun.ts";

test("masked copies are named (OfflineMasked) in every format", () => {
  assert.equal(exportName("Sổ khách.xlsx", maskedSuffix), "Sổ khách (OfflineMasked).xlsx");
  assert.equal(maskedName("Hợp đồng.docx"), "Hợp đồng (OfflineMasked).docx");
  assert.equal(maskedName("Hợp đồng.pdf"), "Hợp đồng (OfflineMasked).md");
});

test("restored copies drop any masked suffix and are named (OfflineUnmasked)", () => {
  const restored = (name) => exportName(withoutMaskedSuffix(name), unmaskedSuffix);
  assert.equal(restored("Sổ khách (OfflineMasked).xlsx"), "Sổ khách (OfflineUnmasked).xlsx");
  assert.equal(restored("Sổ khách (offlinemasked).xlsx"), "Sổ khách (OfflineUnmasked).xlsx");
  assert.equal(restored("Sổ khách (đã ẩn).xlsx"), "Sổ khách (OfflineUnmasked).xlsx");
  assert.equal(restored("Trả lời.md"), "Trả lời (OfflineUnmasked).md");
});
