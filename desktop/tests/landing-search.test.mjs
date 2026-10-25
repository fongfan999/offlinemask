// offlinemask.com's structured data, sitemap and robots.txt (decision 0145). The FAQ structured
// data is read from the page's own questions, so it has to keep up with every edit to them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faq, pages, robots, sitemap, structuredData } from "../../landing/search.js";

const fragment = readFileSync(new URL("../../landing/product.html", import.meta.url), "utf8");

test("every question on the page is in the FAQ structured data, as plain text", () => {
  const entries = faq(fragment);
  assert.equal(entries.length, fragment.match(/<div class="om-q"/g).length);
  assert.equal(entries[0].question, "Dùng được trên máy nào?");
  assert.match(entries[0].answer, /^macOS \(Apple Silicon và Intel\) và Windows\./);
  for (const { question, answer } of entries) {
    assert.ok(question.endsWith("?"), question);
    assert.ok(answer.length > 20, question);
    assert.doesNotMatch(question + answer, /[<>+]|&\w+;|\s{2}/);
  }
});

test("the home page's structured data is one safe JSON-LD script", () => {
  const script = structuredData({ fragment, description: "Mô tả <b>", version: "2.3.0" });
  const json = /^<script type="application\/ld\+json">(.*)<\/script>$/.exec(script)[1];
  assert.doesNotMatch(json, /</);
  const {
    "@graph": [app, questions],
  } = JSON.parse(json);
  assert.equal(app["@type"], "SoftwareApplication");
  assert.equal(app.softwareVersion, "2.3.0");
  assert.equal(app.description, "Mô tả <b>");
  assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "VND" });
  assert.equal(questions["@type"], "FAQPage");
  assert.equal(questions.mainEntity.length, faq(fragment).length);
});

test("the sitemap lists the three pages and robots.txt points to it", () => {
  const urls = [...sitemap().matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.deepEqual(
    urls,
    pages.map((page) => `https://offlinemask.com${page}`),
  );
  assert.match(robots(), /^User-agent: \*\nAllow: \/\n/);
  assert.match(robots(), /^Sitemap: https:\/\/offlinemask\.com\/sitemap\.xml$/m);
});
