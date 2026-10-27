import test from "node:test";
import assert from "node:assert/strict";
import { syntheticDocuments } from "./documents/generate.mjs";
import {
  heldOutSeeds,
  isHeldOut,
  labelOf,
  labels,
  occurrences,
  seedRange,
  trainingRecords,
} from "./documents/training-set.mjs";

test("a hidden value's label is read off the value with the vocabulary", () => {
  assert.equal(labelOf("Nguyễn Văn An"), "PERSON");
  assert.equal(labelOf("NGUYEN THI HANH"), "PERSON");
  assert.equal(labelOf("Trang"), "PERSON");
  assert.equal(labelOf("Ngô Thu Mai"), "PERSON");
  assert.equal(labelOf("DUONG MINH DAT"), "PERSON");
  assert.equal(labelOf("Công ty TNHH Thương mại Dịch vụ Sao Mai"), "ORGANIZATION");
  assert.equal(labelOf("CONG TY CO PHAN VAN TAI DONG A"), "ORGANIZATION");
  assert.equal(labelOf("HỘ KINH DOANH HẢI SẢN SAO MAI"), "ORGANIZATION");
  assert.equal(labelOf("Bệnh viện Chợ Rẫy"), "ORGANIZATION");
  assert.equal(labelOf("12/3 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh"), "LOCATION");
  assert.equal(labelOf("Số 5 Nguyễn Huệ, P. Sài Gòn, TP. Hồ Chí Minh"), "LOCATION");
  assert.equal(
    labelOf(
      "Căn hộ chung cư số A12.05 thuộc khu đô thị Vinhomes Grand Park, Phường Ba Đình, Thành phố Hà Nội",
    ),
    "LOCATION",
  );
  for (const structured of [
    "0901234567",
    "079200123456",
    "an.nguyen12@gmail.com",
    "yen.ngo41@outlook.com",
    "12/05/1990",
    "NV12345",
    "0312345678",
  ])
    assert.equal(labelOf(structured), undefined, structured);
});

test("occurrences are whole words and survive a line break inside the value", () => {
  assert.deepEqual(occurrences("Ông Trang và Trang 1/2", "Trang"), [
    { start: 4, end: 9 },
    { start: 13, end: 18 },
  ]);
  assert.deepEqual(occurrences("Ông Trang và Trang 1/2", "Trang", { start: 0, end: 9 }), [
    { start: 4, end: 9 },
  ]);
  assert.deepEqual(occurrences("Công ty TNHH\nSao Mai", "Công ty TNHH Sao Mai"), [
    { start: 0, end: 20 },
  ]);
  assert.deepEqual(occurrences("Hoàng Anh", "Anh"), [{ start: 6, end: 9 }]);
  assert.deepEqual(occurrences("Hoàng Anhx", "Anh"), []);
});

test("the measured seeds are held out and a range refuses them", () => {
  assert.equal(heldOutSeeds.from, 1);
  assert.ok(isHeldOut(7) && isHeldOut(26) && !isHeldOut(27));
  assert.throws(() => seedRange("1-7"), /held out/);
  assert.throws(() => seedRange("20-30"), /held out/);
  assert.deepEqual(seedRange("100-102"), [100, 101, 102]);
  assert.deepEqual(seedRange("100"), [100]);
  assert.throws(() => seedRange("x"), /Not a seed range/);
});

test("every labelled hidden value of a seed becomes a span with its label, nothing overlaps", async () => {
  const documents = await syntheticDocuments(100, { variants: 1 });
  const { records, tally } = await trainingRecords(documents);
  assert.ok(records.length > documents.length);
  assert.deepEqual(tally.unmatched, []);
  for (const label of labels) assert.ok(tally[label] > 0, label);
  assert.ok(tally.structured > 0);
  const byDocument = new Map();
  for (const record of records) {
    assert.match(record.id, /^seed-100\/.+#\d+$/);
    assert.ok(["pdf", "docx"].includes(record.format));
    const chars = [...record.text];
    for (const list of [record.spans, record.negatives, record.ignore]) {
      const sorted = [...list].sort((a, b) => a.start - b.start);
      for (const [index, span] of sorted.entries()) {
        assert.ok(span.start < span.end && span.end <= chars.length, record.id);
        if (index) assert.ok(span.start >= sorted[index - 1].end, `${record.id} overlaps`);
      }
    }
    for (const span of record.spans) {
      assert.ok(labels.includes(span.label));
      const value = chars.slice(span.start, span.end).join("");
      assert.equal(labelOf(value), span.label, `${record.id}: ${value}`);
    }
    byDocument.set(record.document, [...(byDocument.get(record.document) ?? []), record]);
  }
  // Each hidden name, address and organization is covered somewhere in its document.
  for (const { name, expect } of documents) {
    const found = byDocument.get(`seed-100/${name}`) ?? [];
    const covered = found.flatMap((record) =>
      record.spans.map((span) => [...record.text].slice(span.start, span.end).join("")),
    );
    const squeeze = (text) => text.replace(/\s+/gu, " ");
    for (const entry of expect.hide) {
      const value = typeof entry === "string" ? entry : entry.value;
      const label = labelOf(value);
      if (!label) continue;
      assert.ok(
        covered.some((text) => squeeze(text) === squeeze(value)),
        `${name}: ${value} (${label})`,
      );
    }
    const kept = found.flatMap((record) =>
      record.negatives.map((span) => [...record.text].slice(span.start, span.end).join("")),
    );
    // A kept text that one paragraph holds whole (a two-cell header spans two) is a negative.
    for (const value of expect.keep.filter((text) => /\p{L}/u.test(text)))
      if (found.some((record) => occurrences(record.text, value).length))
        assert.ok(
          kept.some((text) => squeeze(text) === squeeze(value)),
          `${name}: keeps ${value}`,
        );
  }
});
