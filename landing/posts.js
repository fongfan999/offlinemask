// The blog (decision 0146): Markdown files in blog/posts/ become pages at /blog/<slug> when the
// site is built. Each post is checked here, so a post that would publish badly fails the build
// instead: a scheduled writer pushes straight to main, and the build is its only reviewer.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Marked } from "marked";
import { site } from "./search.js";

const folder = new URL("./blog/posts/", import.meta.url);
export const images = new URL("./blog/images/", import.meta.url);
const publisher = { "@type": "Organization", name: "Wot Da Fong", url: "https://wotdafong.dev" };
export const blogTitle = "Blog OfflineMask";
export const blogDescription =
  "Hỏi AI mà vẫn giữ kín thông tin: hướng dẫn và câu trả lời cho dân văn phòng, kế toán, nhân sự, chăm sóc khách hàng.";

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const json = (value) =>
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...value }).replace(/</g, "\\u003c")}</script>`;

/** "2026-10-25" → "25 tháng 10, 2026". */
export const day = (date) => {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  return `${dayOfMonth} tháng ${month}, ${year}`;
};

/** The `key: value` lines between the opening `---` lines, and the Markdown after them. */
function split(source, file) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.replace(/\r\n/g, "\n"));
  if (!match) throw new Error(`${file}: starts without a --- front matter block`);
  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`${file}: front matter line "${line}" is not "key: value"`);
    fields[field[1]] = field[2].replace(/^"(.*)"$/, "$1").trim();
  }
  return { fields, markdown: match[2] };
}

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().startsWith(value);

/** Parses and checks one post. Every rule here is one a reader or a crawler would notice. */
export function parse(source, file) {
  const slug = file.replace(/\.md$/, "");
  const fail = (problem) => {
    throw new Error(`blog/posts/${file}: ${problem}`);
  };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail("the file name is not a lowercase-ascii slug");
  const { fields, markdown } = split(source, file);
  const { title, description, date, updated } = fields;
  for (const key of Object.keys(fields))
    if (!["title", "description", "date", "updated"].includes(key)) fail(`unknown field "${key}"`);
  if (!title || title.length > 70) fail("title is missing or longer than 70 characters");
  if (!description || description.length < 70 || description.length > 170)
    fail("description must be 70–170 characters (the search-result snippet)");
  if (!isDate(date)) fail("date must be YYYY-MM-DD");
  if (updated !== undefined && (!isDate(updated) || updated < date))
    fail("updated must be YYYY-MM-DD, on or after date");

  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(markdown);
  const pictures = [];
  marked.walkTokens(tokens, (token) => {
    // Posts are plain Markdown: no HTML, so no embeds, scripts or third-party resources.
    if (token.type === "html") fail(`contains HTML (${token.raw.trim().slice(0, 40)})`);
    if (token.type === "heading" && token.depth === 1)
      fail("uses a # heading; the title is the h1");
    if (token.type === "image") {
      if (!/^images\/[\w.-]+\.(webp|png|jpg|svg)$/.test(token.href))
        fail(`image "${token.href}" is not a file in blog/images/`);
      if (!token.text) fail(`image "${token.href}" has no alt text`);
      pictures.push(token.href.slice("images/".length));
    }
  });
  for (const picture of pictures)
    if (!existsSync(new URL(picture, images))) fail(`blog/images/${picture} does not exist`);
  const words = markdown.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
  if (words < 400) fail(`has ${words} words; a post answers its question in at least 400`);

  const renderer = {
    // Headings get ids, so a section can be linked to.
    heading({ tokens: inline, depth }) {
      const text = this.parser.parseInline(inline);
      const id = text
        .replace(/<[^>]+>/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    // Links to other sites open as ordinary links but never send who referred the reader.
    link({ href, title: hint, tokens: inline }) {
      const text = this.parser.parseInline(inline);
      const external = /^https?:/.test(href) && !href.startsWith(site);
      return `<a href="${escape(href)}"${hint ? ` title="${escape(hint)}"` : ""}${external ? ' rel="noopener noreferrer"' : ""}>${text}</a>`;
    },
  };
  marked.use({ renderer });
  const html = marked.parser(tokens);
  return { slug, title, description, date, updated: updated ?? date, html, pictures };
}

/** Every post, newest first. */
export function posts() {
  if (!existsSync(folder)) return [];
  const list = readdirSync(folder)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parse(readFileSync(new URL(file, folder), "utf8"), file));
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

const shareTags = ({ title, description, url, type, image = `${site}/og.png` }) => `
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="alternate" type="application/rss+xml" title="${blogTitle}" href="${site}/blog/rss.xml" />`;

const list = (entries) =>
  `<ol class="om-blog-list">${entries
    .map(
      (post) => `
          <li>
            <time datetime="${post.date}">${day(post.date)}</time>
            <h2><a href="./${post.slug}">${escape(post.title)}</a></h2>
            <p>${escape(post.description)}</p>
          </li>`,
    )
    .join("")}
        </ol>`;

/** The `/blog/` page: its head tags and its main content. */
export function indexPage(entries) {
  const url = `${site}/blog/`;
  return {
    head: `<title>${blogTitle}</title>${shareTags({ title: blogTitle, description: blogDescription, url, type: "website" })}
    ${json({ "@type": "Blog", name: blogTitle, url, inLanguage: "vi", description: blogDescription, publisher })}`,
    main: `<p class="om-maker-label">Blog</p>
        <h1>Hỏi AI mà vẫn giữ kín thông tin</h1>
        <p class="om-doc-lead">
          Hướng dẫn và câu trả lời ngắn gọn cho người làm văn phòng, kế toán, nhân sự, chăm sóc
          khách hàng: dùng ChatGPT, Claude, Gemini cho công việc mà không để lộ thông tin của ai.
        </p>
        ${entries.length ? list(entries) : "<p>Bài viết đầu tiên sắp có.</p>"}`,
  };
}

/** One post's page: its head tags and its main content, with a few other posts after it. */
export function postPage(post, entries) {
  const url = `${site}/blog/${post.slug}`;
  const others = entries.filter((other) => other.slug !== post.slug).slice(0, 3);
  const article = {
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    datePublished: post.date,
    dateModified: post.updated,
    inLanguage: "vi",
    image: `${url}.png`,
    author: publisher,
    publisher,
  };
  const trail = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OfflineMask", item: `${site}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${site}/blog/` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };
  return {
    head: `<title>${escape(post.title)} — OfflineMask</title>${shareTags({ title: post.title, description: post.description, url, type: "article", image: `${url}.png` })}
    <meta property="article:published_time" content="${post.date}" />
    <meta property="article:modified_time" content="${post.updated}" />
    ${json({ "@graph": [article, trail] })}`,
    main: `<p class="om-maker-label"><a href="./">Blog</a> · <time datetime="${post.date}">${day(post.date)}</time>${
      post.updated !== post.date
        ? ` · cập nhật <time datetime="${post.updated}">${day(post.updated)}</time>`
        : ""
    }</p>
        <h1>${escape(post.title)}</h1>
        <p class="om-doc-lead">${escape(post.description)}</p>
        <article class="om-blog-body">
${post.html}
        </article>
        <aside class="om-blog-cta" aria-label="OfflineMask">
          <p><strong>OfflineMask</strong> thay tên, số điện thoại, số tài khoản… bằng mã ngay trên máy bạn trước khi bạn hỏi AI, rồi đổi lại trong câu trả lời. Miễn phí, không cần tài khoản, chạy cả khi không có mạng.</p>
          <a class="om-button" href="../#om-download">Tải OfflineMask miễn phí</a>
        </aside>
        ${others.length ? `<section class="om-blog-more" aria-labelledby="om-more"><p class="om-maker-label" id="om-more">Đọc thêm</p>${list(others)}</section>` : ""}`,
  };
}

/** Fills a page's `<!-- blog-head -->` and `<!-- blog-main -->` markers. */
export const fill = (template, { head, main }) =>
  template.replace("<!-- blog-head -->", () => head).replace("<!-- blog-main -->", () => main);

/** `/blog/rss.xml`, newest twenty posts. */
export function rss(entries) {
  const date = (value) => new Date(`${value}T08:00:00+07:00`).toUTCString();
  const items = entries
    .slice(0, 20)
    .map(
      (post) => `    <item>
      <title>${escape(post.title)}</title>
      <link>${site}/blog/${post.slug}</link>
      <guid>${site}/blog/${post.slug}</guid>
      <pubDate>${date(post.date)}</pubDate>
      <description>${escape(post.description)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${blogTitle}</title>
    <link>${site}/blog/</link>
    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>${escape(blogDescription)}</description>
    <language>vi</language>
${items}
  </channel>
</rss>
`;
}
