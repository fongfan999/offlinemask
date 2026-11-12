// What the build tells search engines and AI assistants about the site (decision 0145): the
// structured data in the home page's head, sitemap.xml, robots.txt and llms.txt. The FAQ entries
// and the file formats are read from the page itself, so what crawlers and assistants are told
// always says what the page says (decision 0199).

export const site = "https://offlinemask.com";
export const pages = ["/", "/en/", "/privacy", "/install", "/blog/", "/huong-dan/"];
// The site's IndexNow key (decision 0199). It is public by design: the build serves it as
// /<key>.txt, and engines only accept URLs from whoever can put that file on the site.
export const indexNowKey = "fba01db3abd23b9057084797a5de1fb0";
// The app's other homes, for the structured data's sameAs.
export const elsewhere = (storeId) => [
  "https://github.com/fongfan999/offlinemask",
  `https://apps.microsoft.com/detail/${storeId}`,
];

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name) => entities[name])
    .replace(/\s+/g, " ")
    .trim();

/** Each `.om-q` in the page fragment as `{ question, answer }`, in page order. */
export function faq(fragment) {
  const section = /<section class="om-faq[\s\S]*?<\/section>/.exec(fragment)?.[0] ?? "";
  return section
    .split(/<div class="om-q"/)
    .slice(1)
    .map((item) => {
      const button = /<button[^>]*>([\s\S]*?)<\/button>/.exec(item)?.[1];
      const answer = /<div class="om-a"[^>]*>([\s\S]*)/.exec(item)?.[1];
      if (!button || !answer) throw new Error("A FAQ entry has no question or answer");
      // The "+" in the button is decoration.
      return {
        question: text(button.replace(/<span[^>]*>[\s\S]*?<\/span>/g, "")),
        answer: text(answer),
      };
    });
}

/**
 * The formats the page lists in its `.om-formats` list, and the note right after the list
 * (what happens to scanned PDFs and pictures), both as plain text.
 */
export function formats(fragment) {
  const list = /<ul class="om-formats"[^>]*>([\s\S]*?)<\/ul>\s*<p[^>]*>([\s\S]*?)<\/p>/.exec(
    fragment,
  );
  if (!list) throw new Error("The page has no format list followed by its note");
  const names = [...list[1].matchAll(/<li>([^<]+)<\/li>/g)].map(([, name]) => text(name));
  return { names, note: text(list[2]) };
}

/**
 * What the page says OfflineMask finds: the chips it lists as built in ("Có sẵn") and those that
 * need the Vietnamese pack, as plain text, lower-cased except for abbreviations like CCCD.
 */
export function detects(fragment) {
  const art = /<div class="om-bento-art om-art-detect"[\s\S]*?<\/div>/.exec(fragment)?.[0];
  const builtIn = /<ul class="om-chips">([\s\S]*?)<\/ul>/.exec(art ?? "")?.[1];
  const pack = /<ul class="om-chips om-chips-pack">([\s\S]*?)<\/ul>/.exec(art ?? "")?.[1];
  if (!builtIn || !pack) throw new Error("The page has no built-in and pack detection lists");
  const names = (list) =>
    [...list.matchAll(/<li>([^<]+)<\/li>/g)]
      .map(([, name]) => text(name))
      .map((name) => (name === name.toUpperCase() ? name : name[0].toLowerCase() + name.slice(1)));
  return { builtIn: names(builtIn), pack: names(pack) };
}

/** The `<script type="application/ld+json">` for the home page. */
export function structuredData({ fragment, description, version, storeId }) {
  const graph = [
    {
      "@type": "SoftwareApplication",
      "@id": `${site}/#app`,
      name: "OfflineMask",
      url: `${site}/`,
      description,
      image: `${site}/og.png`,
      inLanguage: "vi",
      applicationCategory: "SecurityApplication",
      operatingSystem: "macOS, Windows, Linux",
      softwareVersion: version,
      downloadUrl: `${site}/#om-download`,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "VND" },
      ...(storeId ? { sameAs: elsewhere(storeId) } : {}),
      publisher: { "@type": "Organization", name: "Wot Da Fong", url: "https://wotdafong.dev" },
    },
    {
      "@type": "FAQPage",
      url: `${site}/`,
      inLanguage: "vi",
      mainEntity: faq(fragment).map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
  // "<" is escaped so no answer can ever close the script element.
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(
    /</g,
    "\\u003c",
  );
  return `<script type="application/ld+json">${json}</script>`;
}

/** The day the privacy page says it was last updated ("Cập nhật ngày 2 tháng 11 năm 2026"). */
export function privacyUpdated(html) {
  const [, day, month, year] =
    /Cập nhật ngày (\d{1,2}) tháng (\d{1,2}) năm (\d{4})/.exec(html) ?? [];
  if (!year) throw new Error("privacy.html has no Cập nhật ngày line");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * The pages, then each post and guide with the day it last changed (`posts()` and `allGuides()`
 * from posts.js; each has its `path`).
 * `changed` gives a page's last change as YYYY-MM-DD where the build knows it.
 */
export const sitemap = (posts = [], changed = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  ...pages.map(
    (page) =>
      `  <url><loc>${site}${page}</loc>${changed[page] ? `<lastmod>${changed[page]}</lastmod>` : ""}</url>`,
  ),
  ...posts.map(
    ({ path, updated }) => `  <url><loc>${site}${path}</loc><lastmod>${updated}</lastmod></url>`,
  ),
].join("\n")}
</urlset>
`;

/**
 * `/llms.txt` (decision 0148): what the site is, in the format proposed at llmstxt.org, for AI
 * assistants that read it: the summary, the pages with their own descriptions, then every post.
 */
export const llms = ({
  pages: described,
  posts = [],
  guides = [],
  formats: { names, note },
  detects: { builtIn, pack },
}) => `# OfflineMask

> OfflineMask là ứng dụng miễn phí trên máy tính, ẩn thông tin riêng (họ tên, số điện thoại, số tài khoản, CCCD...) bằng mã ngay trên máy trước khi bạn hỏi AI như ChatGPT, Claude hay Gemini, rồi đổi mã trong câu trả lời về thông tin thật.

- Miễn phí, không quảng cáo, không cần tài khoản. Có cho macOS (Apple Silicon và Intel), Windows và Linux.
- Ẩn và khôi phục chạy hoàn toàn trên máy, kể cả khi không có mạng; bảng đối chiếu mã không rời máy. OfflineMask không kết nối với AI nào.
- Tự nhận ra ${builtIn.join(", ")}; với gói nhận diện tiếng Việt (tải một lần, tùy chọn) thêm ${pack.join(", ")}.
- Làm việc với văn bản và các tệp ${names.join(", ")}. Bảng tính và tài liệu giữ nguyên định dạng; PDF và hình ảnh cho ra bản Markdown đã ẩn. ${note}
- Ẩn nhanh trên macOS và Windows: bôi đen chữ trong bất kỳ ứng dụng nào để ẩn và khôi phục tại chỗ.

In English: OfflineMask is a free desktop app that replaces names, phone numbers, account and ID numbers with codes on the user's computer before they ask ChatGPT, Claude or Gemini, then restores the real details in the answer. It works offline and never connects to an AI. It is made for Vietnamese: its interface is Vietnamese and it is tuned for Vietnamese documents. English page: ${site}/en/

## Trang

${described.map(({ path, title, description }) => `- [${title}](${site}${path}): ${description}`).join("\n")}

## Hướng dẫn

${guides.map(({ path, title, description }) => `- [${title}](${site}${path}): ${description}`).join("\n")}

## Blog

${posts.map(({ path, title, description }) => `- [${title}](${site}${path}): ${description}`).join("\n")}

## Optional

- [Mã nguồn trên GitHub](https://github.com/fongfan999/offlinemask): mã nguồn mở của ứng dụng và trang web.
`;

/**
 * The site's URLs that a push changed, from the repository paths it touched (decision 0199): a
 * post or guide (written, edited or deleted) and its list, or a page whose own file changed.
 * Layout, style and script changes are left out; they change no page's words.
 */
export function changedUrls(paths) {
  const own = {
    "landing/index.html": "/",
    "landing/product.html": "/",
    "landing/privacy.html": "/privacy",
    "landing/install.html": "/install",
    "landing/en/index.html": "/en/",
  };
  const urls = new Set();
  for (const path of paths) {
    const [, dir, slug] =
      /^landing\/(blog|huong-dan)\/(?:posts|pages)\/([a-z0-9-]+)\.md$/.exec(path) ?? [];
    if (slug) urls.add(`${site}/${dir}/${slug}`).add(`${site}/${dir}/`);
    else if (own[path]) urls.add(`${site}${own[path]}`);
  }
  return [...urls];
}

// Cloudflare may put its managed content-signal notes above these lines; they leave crawling open.
export const robots = () => `User-agent: *
Allow: /

Sitemap: ${site}/sitemap.xml
`;
