// offlinemask.com's structured data, sitemap and robots.txt (decision 0145). The FAQ structured
// data is read from the page's own questions, so it has to keep up with every edit to them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectionOptions } from "../src/core/detection/options.ts";
import {
  changedUrls,
  detects,
  faq,
  formats,
  indexNowKey,
  llms,
  pages,
  privacyUpdated,
  robots,
  sitemap,
  structuredData,
} from "../../landing/search.js";

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
  const script = structuredData({
    fragment,
    description: "Mô tả <b>",
    version: "2.3.0",
    storeId: "9ABC",
  });
  const json = /^<script type="application\/ld\+json">(.*)<\/script>$/.exec(script)[1];
  assert.doesNotMatch(json, /</);
  const {
    "@graph": [app, questions],
  } = JSON.parse(json);
  assert.equal(app["@type"], "SoftwareApplication");
  assert.equal(app.softwareVersion, "2.3.0");
  assert.equal(app.description, "Mô tả <b>");
  assert.deepEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "VND" });
  assert.deepEqual(app.sameAs, [
    "https://github.com/fongfan999/offlinemask",
    "https://apps.microsoft.com/detail/9ABC",
  ]);
  assert.equal(questions["@type"], "FAQPage");
  assert.equal(questions.mainEntity.length, faq(fragment).length);
});

test("the sitemap lists the pages and each post, and robots.txt points to it", () => {
  const xml = sitemap(
    [
      { path: "/blog/mot-bai", updated: "2026-10-27" },
      { path: "/huong-dan/mot-cach", updated: "2026-11-12" },
    ],
    { "/privacy": "2026-11-02" },
  );
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  assert.deepEqual(urls, [
    ...pages.map((page) => `https://offlinemask.com${page}`),
    "https://offlinemask.com/blog/mot-bai",
    "https://offlinemask.com/huong-dan/mot-cach",
  ]);
  assert.match(xml, /mot-bai<\/loc><lastmod>2026-10-27<\/lastmod>/);
  assert.match(xml, /\/privacy<\/loc><lastmod>2026-11-02<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/offlinemask\.com\/install<\/loc><\/url>/);
  assert.match(robots(), /^User-agent: \*\nAllow: \/\n/);
  assert.match(robots(), /^Sitemap: https:\/\/offlinemask\.com\/sitemap\.xml$/m);
});

test("llms.txt lists the pages and every post with their descriptions", () => {
  const text = llms({
    pages: [{ path: "/install", title: "Cài đặt", description: "Cài trong một phút." }],
    posts: [{ path: "/blog/mot-bai", title: "Một bài", description: "Câu trả lời." }],
    guides: [{ path: "/huong-dan/mot-cach", title: "Một cách", description: "Từng bước." }],
    formats: formats(fragment),
    detects: detects(fragment),
  });
  assert.match(text, /^# OfflineMask\n\n> /);
  assert.match(
    text,
    /^- \[Cài đặt\]\(https:\/\/offlinemask\.com\/install\): Cài trong một phút\.$/m,
  );
  assert.match(
    text,
    /^## Hướng dẫn\n\n- \[Một cách\]\(https:\/\/offlinemask\.com\/huong-dan\/mot-cach\): Từng bước\.$/m,
  );
  assert.match(
    text,
    /^## Blog\n\n- \[Một bài\]\(https:\/\/offlinemask\.com\/blog\/mot-bai\): Câu trả lời\.$/m,
  );
});

// llms.txt once said OfflineMask could not read PDFs or pictures, long after it could; its
// formats now come from the page's own list, so the two cannot disagree again.
test("llms.txt names every format the page lists, and the page's note about scans", () => {
  const { names, note } = formats(fragment);
  assert.ok(names.includes("XLSX") && names.includes("PDF"), names.join());
  assert.match(note, /scan/);
  const text = llms({ pages: [], posts: [], formats: { names, note }, detects: detects(fragment) });
  for (const name of names) assert.match(text, new RegExp(`\\b${name}\\b`), name);
  assert.ok(text.includes(note));
  assert.doesNotMatch(text, /chưa hỗ trợ/i);
});

test("the privacy page's own date is read for the sitemap", () => {
  const html = readFileSync(new URL("../../landing/privacy.html", import.meta.url), "utf8");
  assert.match(privacyUpdated(html), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(privacyUpdated("Cập nhật ngày 2 tháng 11 năm 2026"), "2026-11-02");
  assert.throws(() => privacyUpdated("<p>no date</p>"));
});

test("a push's changed files become the URLs IndexNow is told about", () => {
  assert.deepEqual(
    changedUrls([
      "landing/blog/posts/mot-bai.md",
      "landing/blog/topics.md",
      "landing/huong-dan/pages/mot-cach.md",
      "landing/product.html",
      "landing/product.css",
      "landing/privacy.html",
      "landing/en/index.html",
      "desktop/src/App.vue",
    ]),
    [
      "https://offlinemask.com/blog/mot-bai",
      "https://offlinemask.com/blog/",
      "https://offlinemask.com/huong-dan/mot-cach",
      "https://offlinemask.com/huong-dan/",
      "https://offlinemask.com/",
      "https://offlinemask.com/privacy",
      "https://offlinemask.com/en/",
    ],
  );
  assert.deepEqual(changedUrls(["landing/main.js"]), []);
  assert.match(indexNowKey, /^[a-zA-Z0-9-]{8,128}$/);
});

// The English page (decision 0201): it and the home page each name both languages and a default,
// as hreflang requires, and it lists the same formats as the home page.
test("the home and English pages point at each other with hreflang", () => {
  const read = (file) => readFileSync(new URL(`../../landing/${file}`, import.meta.url), "utf8");
  const alternates = (html) =>
    Object.fromEntries(
      [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map(
        ([, lang, href]) => [lang, href],
      ),
    );
  const expected = {
    vi: "https://offlinemask.com/",
    en: "https://offlinemask.com/en/",
    "x-default": "https://offlinemask.com/",
  };
  const home = read("index.html");
  const english = read("en/index.html");
  assert.deepEqual(alternates(home), expected);
  assert.deepEqual(alternates(english), expected);
  assert.match(english, /<html lang="en"/);
  assert.match(english, /<link rel="canonical" href="https:\/\/offlinemask\.com\/en\/" \/>/);
  assert.match(fragment, /href="\.\/en\/"/, "the home footer links the English page");
  const listed = /<span data-om-formats>([^<]+)<\/span>/.exec(english)[1];
  assert.equal(listed, formats(fragment).names.join(", "));
});

// The page once listed card numbers and passwords as built in, but the app finds them only with
// the Vietnamese pack: their category ("other") needs it, like names and addresses. The page's
// two lists follow the app's categories, and llms.txt follows the page.
test("the page lists as built in only what the app finds without the pack", () => {
  const { builtIn, pack } = detects(fragment);
  const needsPack = (id) => detectionOptions.find((option) => option.id === id).model;
  assert.equal(needsPack("banking"), false);
  assert.equal(needsPack("other"), true);
  for (const name of ["email", "điện thoại", "số tài khoản", "CCCD", "hộ chiếu", "mã số thuế"])
    assert.ok(builtIn.includes(name), name);
  for (const name of ["họ tên", "địa chỉ", "tổ chức", "số thẻ", "mật khẩu"])
    assert.ok(pack.includes(name), name);
  const text = llms({
    pages: [],
    posts: [],
    formats: formats(fragment),
    detects: { builtIn, pack },
  });
  assert.ok(text.includes(`Tự nhận ra ${builtIn.join(", ")};`));
  assert.ok(text.includes(`thêm ${pack.join(", ")}.`));
});
