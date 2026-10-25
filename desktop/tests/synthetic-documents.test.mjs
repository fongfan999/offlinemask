import test from "node:test";
import assert from "node:assert/strict";
import { openDocument } from "../src/core/doc/document.ts";
import { syntheticDocuments } from "./documents/generate.mjs";

const squeeze = (text) => text.replace(/\s+/gu, " ").trim();

test("the synthetic documents are the same for the same seed", async () => {
  const [first, second] = await Promise.all([
    syntheticDocuments(3, { variants: 1 }),
    syntheticDocuments(3, { variants: 1 }),
  ]);
  assert.equal(first.length, second.length);
  for (const [index, document] of first.entries()) {
    assert.equal(document.name, second[index].name);
    assert.deepEqual(document.bytes, second[index].bytes, document.name);
  }
});

test("the reader reads every value a synthetic document places, in PDF and Word", async () => {
  const documents = await syntheticDocuments(1, { variants: 1 });
  assert.ok(documents.length >= 18);
  for (const { name, bytes, expect } of documents) {
    assert.ok(expect.hide.length > 3, `${name} hides something`);
    const opened = await openDocument(bytes, name);
    const text = squeeze(opened.paragraphs.map((paragraph) => paragraph.text).join("\n"));
    for (const value of [...expect.hide, ...expect.keep])
      assert.ok(text.includes(squeeze(value)), `${name}: ${JSON.stringify(value)} not read`);
  }
});
