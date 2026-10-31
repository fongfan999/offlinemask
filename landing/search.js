// What the build tells search engines and AI assistants about the site (decision 0145): the
// structured data in the home page's head, sitemap.xml and robots.txt. The FAQ entries are read
// from the page's own questions, so the structured data always says what the page says.

export const site = "https://offlinemask.com";
export const pages = ["/", "/privacy", "/install", "/blog/"];

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

/** The `<script type="application/ld+json">` for the home page. */
export function structuredData({ fragment, description, version }) {
  const graph = [
    {
      "@type": "SoftwareApplication",
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

/** The pages, then each blog post with the day it last changed (`posts()` from posts.js). */
export const sitemap = (posts = []) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  ...pages.map((page) => `  <url><loc>${site}${page}</loc></url>`),
  ...posts.map(
    ({ slug, updated }) =>
      `  <url><loc>${site}/blog/${slug}</loc><lastmod>${updated}</lastmod></url>`,
  ),
].join("\n")}
</urlset>
`;

/**
 * `/llms.txt` (decision 0148): what the site is, in the format proposed at llmstxt.org, for AI
 * assistants that read it: the summary, the pages with their own descriptions, then every post.
 */
export const llms = ({ pages: described, posts = [] }) => `# OfflineMask

> OfflineMask là ứng dụng miễn phí trên máy tính, ẩn thông tin riêng (họ tên, số điện thoại, số tài khoản, CCCD...) bằng mã ngay trên máy trước khi bạn hỏi AI như ChatGPT, Claude hay Gemini, rồi đổi mã trong câu trả lời về thông tin thật.

- Miễn phí, không quảng cáo, không cần tài khoản. Có cho macOS (Apple Silicon và Intel), Windows và Linux.
- Ẩn và khôi phục chạy hoàn toàn trên máy, kể cả khi không có mạng; bảng đối chiếu mã không rời máy. OfflineMask không kết nối với AI nào.
- Tự nhận ra email, số điện thoại, số tài khoản, số thẻ, CCCD, hộ chiếu, mã số thuế, mật khẩu; thêm họ tên, địa chỉ, tổ chức với gói tiếng Việt tải một lần.
- Làm việc với văn bản, bảng tính (XLSX, XLS, ODS, CSV) và tài liệu (DOCX, ODT), giữ nguyên định dạng. Chưa hỗ trợ PDF và hình ảnh.
- Ẩn nhanh trên macOS và Windows: bôi đen chữ trong bất kỳ ứng dụng nào để ẩn và khôi phục tại chỗ.

## Trang

${described.map(({ path, title, description }) => `- [${title}](${site}${path}): ${description}`).join("\n")}

## Blog

${posts.map(({ slug, title, description }) => `- [${title}](${site}/blog/${slug}): ${description}`).join("\n")}

## Optional

- [Mã nguồn trên GitHub](https://github.com/fongfan999/offlinemask): mã nguồn mở của ứng dụng và trang web.
`;

// Cloudflare may put its managed content-signal notes above these lines; they leave crawling open.
export const robots = () => `User-agent: *
Allow: /

Sitemap: ${site}/sitemap.xml
`;
