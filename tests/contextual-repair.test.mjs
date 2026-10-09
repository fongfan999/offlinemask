import test from "node:test";
import assert from "node:assert/strict";
import { normalizedSource } from "../scripts/contextual-repair-v1/normalized-source.mjs";
import { completeAddressBoundaries } from "../src/core/detection/address-boundaries.ts";
const seed = (text, value, type = "DIA_CHI") => ({
  start: text.indexOf(value),
  end: text.indexOf(value) + value.length,
  type,
  priority: 50,
});

test("canonical inference copy preserves exact original graphemes, case and compatibility characters", () => {
  for (const source of [
    "📎 Đỗ Hải Yến; Đỗ Hải Yến".normalize("NFD"),
    "👩🏽‍💻 " + "a\u0301\u0323" + "\r\n⑴ ﬁ Ａ",
    "각",
    "a".repeat(1023) + "o\u031b\u0301" + "🇻🇳",
    "x" + "\u0301".repeat(1300),
  ]) {
    const normalized = normalizedSource(source);
    assert.equal(normalized.text, source.normalize("NFC"));
    for (const { segment, index } of new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(
      normalized.text,
    )) {
      const [mapped] = normalized.restore([
        { start: index, end: index + segment.length, type: "TEN" },
      ]);
      assert.equal(source.slice(mapped.start, mapped.end).normalize("NFC"), segment);
    }
  }
  const raw = "📎 Đỗ Hải Yến; Đỗ Hải Yến".normalize("NFD"),
    n = normalizedSource(raw),
    value = "Đỗ Hải Yến";
  const d = n.restore([
    {
      start: n.text.lastIndexOf(value),
      end: n.text.lastIndexOf(value) + value.length,
      type: "TEN",
    },
  ])[0];
  assert.equal(d.start, raw.lastIndexOf(value.normalize("NFD")));
  assert.equal(d.end, raw.length);
  assert.equal(n.text.includes("Đỗ"), true);
  assert.equal(raw.includes("Đỗ"), true);
});
test("canonical span mapping fails closed on malformed offsets and retains combining tails", () => {
  const n = normalizedSource("a\u0323\u0301");
  const d = n.restore([{ start: 0, end: 1 }])[0];
  assert.deepEqual(d, { start: 0, end: 3 });
  for (const [start, end] of [
    [-1, 1],
    [0, 0],
    [0, 999],
    [0.5, 1],
    [0, NaN],
  ])
    assert.throws(() => n.restore([{ start, end }]), /Invalid/);
  assert.deepEqual(normalizedSource("").restore([]), []);
});
test("explicit numbered street components join existing address evidence without leaving internal separators", () => {
  for (const normalization of ["NFC", "NFD"]) {
    const value = "ngõ 68, ngách 12, số 9 Lê Văn Lương, Hà Nội".normalize(normalization);
    const text = "Khách nhận tại " + value + ", sau 17 giờ.";
    const ds = completeAddressBoundaries(text, [seed(text, "Hà Nội".normalize(normalization))]);
    assert.ok(ds.some((d) => text.slice(d.start, d.end) === value));
    assert.ok(ds.every((d) => !text.slice(d.start, d.end).includes("17 giờ")));
  }
});
test("mail routing supplies context for a slash house number despite a mistaken street-name category", () => {
  const value = "17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh";
  for (const verb of ["Chuyển thư về", "Chuyển thư đến", "Chuyển thư tới"]) {
    const text = `${verb} ${value}.`;
    const ds = completeAddressBoundaries(text, [
      seed(text, "Nguyễn Văn Đậu", "TEN"),
      seed(text, "Bình Thạnh"),
    ]);
    assert.ok(ds.some((d) => text.slice(d.start, d.end) === value));
  }
});
test("numbered address repair still requires address evidence and does not cross prose or paragraphs", () => {
  for (const text of [
    "Chuyển thư về 17/6 Nguyễn Văn Đậu.",
    "Số 9 Lê Văn Lương",
    "Số 9 hồ sơ đang xử lý, Hà Nội.",
    "số 9 Lê Văn Lương; Hà Nội",
    "số 9 Lê Văn Lương\n\nHà Nội",
    "số 9 Lê Văn Lương, tổng số 12 hồ sơ, Hà Nội",
  ]) {
    const seeds = text.includes("Hà Nội") ? [seed(text, "Hà Nội")] : [];
    const ds = completeAddressBoundaries(text, seeds);
    assert.ok(
      !ds.some(
        (d) =>
          text.slice(d.start, d.end).includes("số 9") ||
          text.slice(d.start, d.end).startsWith("17/6"),
      ),
      text,
    );
  }
});
