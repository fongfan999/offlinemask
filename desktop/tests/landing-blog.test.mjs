// The blog's posts (decision 0146). A scheduled writer pushes posts straight to main, so the
// checks in landing/posts.js are what stand between a bad post and the live site.
import test from "node:test";
import assert from "node:assert/strict";
import { card } from "../../landing/cards.js";
import { fill, indexPage, parse, postPage, posts, rss } from "../../landing/posts.js";

const words = (count) => Array.from({ length: count }, () => "chữ").join(" ");
const post = (fields, body = words(420)) =>
  `---\n${Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}\n---\n\n${body}\n`;
const good = {
  title: "Có nên dán thông tin khách hàng vào AI?",
  description:
    "Dán họ tên, số điện thoại của khách vào AI có rủi ro gì, và cách vẫn nhờ AI làm việc an toàn.",
  date: "2026-10-25",
};

test("every published post passes the checks", () => {
  const all = posts();
  assert.ok(all.length > 0);
  assert.equal(new Set(all.map(({ slug }) => slug)).size, all.length);
  for (const { slug, html } of all) {
    assert.doesNotMatch(html, /<(script|iframe|img src="http)/, slug);
  }
});

test("a well-formed post renders, with ids on its headings", () => {
  const parsed = parse(post(good, `## Đường dẫn ở đâu?\n\n${words(420)}`), "mot-bai.md");
  assert.equal(parsed.slug, "mot-bai");
  assert.equal(parsed.updated, "2026-10-25");
  assert.match(parsed.html, /<h2 id="duong-dan-o-dau">Đường dẫn ở đâu\?<\/h2>/);
});

test("posts that would publish badly are rejected", () => {
  const rejects = (source, file, problem) => assert.throws(() => parse(source, file), problem);
  rejects(post(good), "Mot Bai.md", /slug/);
  rejects(post({ ...good, title: "x".repeat(71) }), "a.md", /title/);
  rejects(post({ ...good, description: "ngắn" }), "a.md", /description/);
  rejects(post({ ...good, date: "2026-13-01" }), "a.md", /date/);
  rejects(post({ ...good, updated: "2026-10-01" }), "a.md", /updated/);
  rejects(post({ ...good, author: "ai" }), "a.md", /unknown field/);
  rejects(post(good, words(100)), "a.md", /words/);
  rejects(post(good, `# Tiêu đề\n\n${words(420)}`), "a.md", /# heading/);
  rejects(post(good, `<iframe src="x"></iframe>\n\n${words(420)}`), "a.md", /HTML/);
  rejects(post(good, `![ảnh](https://example.com/a.png)\n\n${words(420)}`), "a.md", /image/);
  rejects(post(good, `![ảnh](images/khong-co.webp)\n\n${words(420)}`), "a.md", /does not exist/);
  rejects("Không có front matter", "a.md", /front matter/);
});

test("pages carry the post's metadata and escape it", () => {
  const parsed = parse(post({ ...good, title: 'Dấu "ngoặc" & <thẻ>' }), "mot-bai.md");
  const page = fill("<!-- blog-head --><!-- blog-main -->", postPage(parsed, [parsed]));
  assert.match(page, /<title>Dấu &quot;ngoặc&quot; &amp; &lt;thẻ&gt; - OfflineMask<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/offlinemask\.com\/blog\/mot-bai" \/>/);
  const json = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(page)[1]);
  assert.equal(json["@graph"][0]["@type"], "BlogPosting");
  assert.equal(json["@graph"][0].headline, 'Dấu "ngoặc" & <thẻ>');
  assert.equal(json["@graph"][0].image, "https://offlinemask.com/blog/mot-bai.png");
  assert.match(
    page,
    /<meta property="og:image" content="https:\/\/offlinemask\.com\/blog\/mot-bai\.png" \/>/,
  );
  assert.doesNotMatch(page, /blog-(head|main)/);
  assert.match(fill("<!-- blog-main -->", indexPage([parsed])), /href="\.\/mot-bai"/);
  assert.match(rss([parsed]), /<link>https:\/\/offlinemask\.com\/blog\/mot-bai<\/link>/);
});

test("a post's share image is a 1200×630 PNG", async () => {
  const png = await card({ title: "Ẩn số tài khoản trước khi gửi cho AI", date: "2026-10-25" });
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});
