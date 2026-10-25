import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFHexString,
  PDFString,
  StandardFonts,
  TextRenderingMode,
  beginText,
  endText,
  moveText,
  setFontAndSize,
  setTextRenderingMode,
  showText,
} from "pdf-lib";

/** Test PDFs for decision 0149, one per way reading a PDF can go wrong. Every file is
 * written here from invented text; none comes from a real document. Noto Sans ships its
 * Latin and Vietnamese letters as two subsets, so text is drawn in runs, each in the
 * font that has its letters, as PDFs made by real software often are. */
const require = createRequire(import.meta.url);
const fontDirectory = require
  .resolve("@fontsource/noto-sans/package.json")
  .replace("package.json", "files/");
const fontFiles = ["latin", "vietnamese"].map((subset) =>
  readFileSync(`${fontDirectory}noto-sans-${subset}-400-normal.woff`),
);

const A4 = [595, 842];

/** A new PDF and a `draw` for Vietnamese text. With `fontFile` (one font that has every
 * letter, as real documents use) text is drawn in one run per call. */
export async function newDocument(fontFile) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = [];
  for (const file of fontFile ? [fontFile] : fontFiles)
    fonts.push(await doc.embedFont(file, { subset: true }));
  const sets = fonts.map((font) => new Set(font.getCharacterSet()));
  /** Draw text at (x, y), switching fonts per letter; returns where it ends. */
  function draw(page, text, x, y, size = 11, options = {}) {
    let run = "";
    let runFont = 0;
    const flush = () => {
      if (!run) return;
      const font = fonts[runFont];
      if (options.invisible) {
        const name = page.node.newFontDictionary(font.name, font.ref);
        page.pushOperators(
          beginText(),
          setFontAndSize(name, size),
          setTextRenderingMode(TextRenderingMode.Invisible),
          moveText(x, y),
          showText(font.encodeText(run)),
          endText(),
        );
      } else page.drawText(run, { x, y, size, font });
      x += font.widthOfTextAtSize(run, size);
      run = "";
    };
    for (const char of text) {
      const index = fonts.length === 1 || sets[0].has(char.codePointAt(0)) ? 0 : 1;
      if (index !== runFont) flush();
      runFont = index;
      run += char;
    }
    flush();
    return x;
  }
  return { doc, draw, latin: fonts[0] };
}

/** A PNG of random pixels, which no compressor shrinks, like the noise of a scan. */
export function noisePng(width, height) {
  const raw = randomBytes((width * 3 + 1) * height);
  for (let row = 0; row < height; row++) raw[row * (width * 3 + 1)] = 0;
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Paragraph lines, top down from y, wrapped by the caller. */
function lines(draw, page, texts, { x = 50, y = 780, size = 11, leading = 1.4 } = {}) {
  for (const text of texts) {
    draw(page, text, x, y, size);
    y -= size * leading;
  }
  return y;
}

const save = (doc) => doc.save();

export const fixtures = {
  /** Words placed one by one with no space characters between them. */
  async noSpaces() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    let x = 50;
    for (const word of "Người thuê là Trần Thị Mai, điện thoại 0912345678.".split(" "))
      x = draw(page, word, x, 780) + 3.5;
    return save(doc);
  },
  /** Two columns, the left one written first, as most layout software does. */
  async twoColumns() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    lines(draw, page, ["Bên A: Công ty Bình Minh", "Mã số thuế 0101234567"], { x: 50 });
    lines(draw, page, ["Bên B: Lê Văn Hùng", "Email hung.le@example.com"], { x: 320 });
    return save(doc);
  },
  /** A table: cells on a row separated by wide gaps. */
  async table() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    const rows = [
      ["Họ tên", "Số điện thoại", "Số tiền"],
      ["Phạm Quốc Bảo", "0987654321", "5.000.000"],
      ["Đỗ Thu Hà", "0901122334", "7.500.000"],
    ];
    rows.forEach((cells, row) =>
      cells.forEach((cell, column) => draw(page, cell, 50 + column * 170, 780 - row * 18)),
    );
    return save(doc);
  },
  /** An e-invoice as report generators write it: the table cell by cell, close
   * columns of numbers, and the header block last although it sits at the top. */
  async invoice() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    const rows = [
      ["STT", "Tên hàng hóa", "Số lượng", "Đơn giá", "Thành tiền"],
      ["1", "Đùi gà", "0,516", "110.380", "56.956"],
      ["2", "Bánh pizza bò", "1", "41.852", "41.852"],
    ];
    const columns = [50, 80, 200, 260, 320];
    rows.forEach((cells, row) =>
      cells.forEach((cell, column) => draw(page, cell, columns[column], 700 - row * 14, 9)),
    );
    draw(page, "Tổng cộng", 80, 640, 9);
    draw(page, "98.808", 320, 640, 9);
    draw(page, "HÓA ĐƠN GIÁ TRỊ GIA TĂNG", 200, 800, 12);
    draw(page, "Tên đơn vị: Công ty Cổ phần Bình Minh", 50, 770, 9);
    draw(page, "Mã số thuế: 0101234567", 50, 756, 9);
    draw(page, "Địa chỉ: 12 Lê Lợi, Quận 1", 50, 742, 9);
    return save(doc);
  },
  /** "ễ" and "ế" stored as "ê" and a combining mark, as some PDF software writes it. */
  async decomposed() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    draw(page, "Ông Nguyê\u0303n Văn Tiê\u0301n", 50, 780);
    return save(doc);
  },
  /** A name wrapped onto the next line. */
  async wrappedName() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    lines(draw, page, ["Hợp đồng này được ký giữa ông Nguyễn Văn", "An và công ty."]);
    lines(draw, page, ["Điều 2. Thời hạn thuê là 12 tháng."], { y: 720 });
    return save(doc);
  },
  /** A scanned page with an invisible text layer, as OCR software adds. */
  async invisibleLayer() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    const image = await doc.embedPng(noisePng(400, 560));
    page.drawImage(image, { x: 0, y: 0, width: A4[0], height: A4[1] });
    draw(page, "Căn cước công dân số 001203004567 của Vũ Thị Lan", 50, 780, 11, {
      invisible: true,
    });
    return save(doc);
  },
  /** Form fields filled in, and a checkbox. */
  async formFields() {
    const { doc, draw, latin } = await newDocument();
    const page = doc.addPage(A4);
    draw(page, "Tờ khai thông tin khách hàng", 50, 780);
    const form = doc.getForm();
    const name = form.createTextField("ho_ten");
    name.setText("Hoang Minh Tuan");
    name.addToPage(page, { x: 50, y: 700, width: 200, height: 20, font: latin });
    const phone = form.createTextField("dien_thoai");
    phone.setText("0934567890");
    phone.addToPage(page, { x: 50, y: 660, width: 200, height: 20, font: latin });
    const agree = form.createCheckBox("dong_y");
    agree.check();
    agree.addToPage(page, { x: 50, y: 620, width: 12, height: 12 });
    return save(doc);
  },
  /** A comment (sticky note) with its author. */
  async comment() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    draw(page, "Báo cáo quý 3", 50, 780);
    const note = doc.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [400, 760, 420, 780],
      Contents: PDFHexString.fromText("Gọi lại cho chị Mai số 0977001122"),
      T: PDFString.of("Ngo Thanh Son"),
    });
    page.node.addAnnot(doc.context.register(note));
    return save(doc);
  },
  /** A text page with a large picture, and one with only a small logo. */
  async images() {
    const { doc, draw } = await newDocument();
    const photo = await doc.embedPng(noisePng(600, 400));
    const logo = await doc.embedPng(noisePng(120, 40));
    const first = doc.addPage(A4);
    draw(first, "Ảnh căn cước đính kèm bên dưới.", 50, 780);
    first.drawImage(photo, { x: 50, y: 400, width: 300, height: 200 });
    const second = doc.addPage(A4);
    second.drawImage(logo, { x: 50, y: 790, width: 60, height: 20 });
    draw(second, "Trang hai chỉ có logo.", 50, 760);
    return save(doc);
  },
  /** A name under a black box: hidden on screen, still in the file. */
  async coveredText() {
    const { doc, draw } = await newDocument();
    const page = doc.addPage(A4);
    draw(page, "Người nhận: Đặng Thị Hồng", 50, 780);
    page.drawRectangle({ x: 115, y: 776, width: 120, height: 16 });
    return save(doc);
  },
  /** Personal names in the document's title and author fields. */
  async metadata() {
    const { doc, draw } = await newDocument();
    draw(doc.addPage(A4), "Biên bản họp.", 50, 780);
    doc.setTitle("Hồ sơ của Lý Thanh Tâm");
    doc.setAuthor("Lý Thanh Tâm");
    return save(doc);
  },
  /** Text pages with one scanned page between them. */
  async mixedScan() {
    const { doc, draw } = await newDocument();
    const scan = await doc.embedPng(noisePng(400, 560));
    draw(doc.addPage(A4), "Trang một: hợp đồng của Trịnh Văn Long.", 50, 780);
    doc.addPage(A4).drawImage(scan, { x: 0, y: 0, width: A4[0], height: A4[1] });
    draw(doc.addPage(A4), "Trang ba: chữ ký các bên.", 50, 780);
    return save(doc);
  },
  /** Every page a picture. */
  async allScanned() {
    const { doc } = await newDocument();
    const scan = await doc.embedPng(noisePng(400, 560));
    for (let index = 0; index < 2; index++)
      doc.addPage(A4).drawImage(scan, { x: 0, y: 0, width: A4[0], height: A4[1] });
    return save(doc);
  },
  /** Vietnamese typed in a TCVN3 font: the file stores Latin-1 letters, which is what
   * comes out ("Céng hßa x· héi chñ nghÜa ViÖt Nam" is "Cộng hòa xã hội chủ nghĩa Việt Nam"). */
  async oldFont() {
    const { doc, draw } = await newDocument();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    draw(doc.addPage(A4), "Trang một có chữ Unicode bình thường.", 50, 780);
    const page = doc.addPage(A4);
    page.drawText("Céng hßa x· héi chñ nghÜa ViÖt Nam", {
      x: 50,
      y: 780,
      size: 12,
      font: helvetica,
    });
    page.drawText("§éc lËp - Tù do - H¹nh phóc", { x: 50, y: 760, size: 12, font: helvetica });
    page.drawText("Hä vµ tªn: TrÇn V¨n B×nh", { x: 50, y: 740, size: 12, font: helvetica });
    return save(doc);
  },
  /** Only TCVN3 text. */
  async onlyOldFont() {
    const { doc } = await newDocument();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage(A4).drawText("Céng hßa x· héi chñ nghÜa ViÖt Nam §éc lËp - Tù do", {
      x: 50,
      y: 780,
      size: 12,
      font: helvetica,
    });
    return save(doc);
  },
  /** Needs a password to open. */
  async password() {
    return encrypted({ userPasswordRequired: true });
  },
  /** Opens without a password but forbids printing and copying. */
  async restricted() {
    return encrypted({ userPasswordRequired: false });
  },
};

const padding = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);
function rc4(key, data) {
  const s = [...Array(256).keys()];
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}
const md5 = (...parts) => createHash("md5").update(Buffer.concat(parts)).digest();

/** A one-page PDF with the standard 40-bit RC4 security handler (revision 2), written
 * by hand since pdf-lib cannot encrypt. With `userPasswordRequired`, U does not match
 * the empty password, so a reader must ask for one. */
function encrypted({ userPasswordRequired }) {
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const owner = randomBytes(32);
  const permissions = -64; // nothing allowed: no printing, no copying
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const key = md5(padding, owner, p, id).subarray(0, 5);
  const user = userPasswordRequired ? randomBytes(32) : rc4(key, padding);
  const objectKey = (number) =>
    md5(key, Buffer.from([number & 255, (number >> 8) & 255, number >> 16, 0, 0])).subarray(0, 10);
  const content = Buffer.from(
    "BT /F1 12 Tf 50 780 Td (Hop dong thue nha cua Tran Thi Mai, so dien thoai 0912345678) Tj ET",
  );
  const stream = rc4(objectKey(4), content);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
      stream,
      Buffer.from("\nendstream", "latin1"),
    ]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P ${permissions} >>`,
  ];
  const parts = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [];
  let length = parts[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "latin1"),
      Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"),
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    parts.push(chunk);
    length += chunk.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>] >>`,
    "startxref",
    String(length),
    "%%EOF",
  ].join("\n");
  parts.push(Buffer.from(xref + "\n", "latin1"));
  return new Uint8Array(Buffer.concat(parts));
}
