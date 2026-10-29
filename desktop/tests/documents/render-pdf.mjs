import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** A document model (kinds.mjs) laid out on A4 pages with pdf-lib, the way invoice and
 * report software does: wrapped paragraphs, "Label: value" fields with the value's wrap
 * under the value, tables whose cells wrap and sit centred in their row, headers repeated
 * after a page break, centred signatures and "Trang i/n". One complete font per family
 * (Be Vietnam Pro or Noto Serif), as real documents embed. */
const require = createRequire(import.meta.url);
const fontFile = (family, weight) => {
  const name = family === "serif" ? "noto-serif" : "be-vietnam-pro";
  const file = family === "serif" ? `NotoSerif_${weight}.ttf` : `BeVietnamPro_${weight}.ttf`;
  return readFileSync(
    require
      .resolve(`@expo-google-fonts/${name}/package.json`)
      .replace("package.json", `${weight}/${file}`),
  );
};

const page = { width: 595, height: 842, margin: 46 };
const ink = rgb(0.1, 0.1, 0.1);
const rule = rgb(0.55, 0.55, 0.55);

export async function renderPdf(model) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Fixed dates and producer: the same seed always writes the same bytes.
  const fixed = new Date("2026-10-26T00:00:00Z");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  doc.setProducer("OfflineMask synthetic documents");
  // pdf-lib's subsetter drops glyphs from Noto Serif; that font is embedded whole.
  const subset = model.font !== "serif";
  const regular = await doc.embedFont(fontFile(model.font, "400Regular"), { subset });
  const bold = await doc.embedFont(fontFile(model.font, "700Bold"), { subset });
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const size = model.size;
  const leading = size * 1.35;
  const width = page.width - 2 * page.margin;
  let current;
  let y;
  const newPage = () => {
    current = doc.addPage([page.width, page.height]);
    y = page.height - page.margin;
  };
  const room = (height) => {
    if (y - height < page.margin + 20) newPage();
  };
  const textWidth = (text, font, fontSize) => font.widthOfTextAtSize(text, fontSize);
  /** Words into lines no wider than `limit`. A word longer than a line overflows rather
   * than being cut, as document software keeps "1.157.300" whole. */
  const wrap = (text, font, fontSize, limit) => {
    const lines = [];
    for (const paragraph of String(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/ +/)) {
        const next = line ? `${line} ${word}` : word;
        if (textWidth(next, font, fontSize) <= limit || !line) line = next;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const draw = (text, x, top, font, fontSize, align = "left", box = width) => {
    const offset =
      align === "center"
        ? (box - textWidth(text, font, fontSize)) / 2
        : align === "right"
          ? box - textWidth(text, font, fontSize)
          : 0;
    if (text) current.drawText(text, { x: x + offset, y: top, size: fontSize, font, color: ink });
  };

  const paragraph = (text, { align = "left", font = regular, fontSize = size } = {}) => {
    for (const line of wrap(text, font, fontSize, width)) {
      room(leading);
      draw(line, page.margin, y - fontSize, font, fontSize, align);
      y -= fontSize * 1.35;
    }
  };
  const fields = (items, columns = 1) => {
    const box = width / columns;
    const placed = items.map(([label, value], index) => {
      const x = page.margin + index * box;
      const prefix = `${label}: `;
      const labelWidth = textWidth(prefix, bold, size);
      const lines = value ? wrap(value, regular, size, box - labelWidth - 6) : [""];
      return { x, prefix, labelWidth, lines };
    });
    const height = Math.max(...placed.map((item) => item.lines.length)) * leading;
    room(height);
    for (const item of placed) {
      draw(item.prefix, item.x, y - size, bold, size);
      item.lines.forEach((line, index) =>
        draw(line, item.x + item.labelWidth, y - size - index * leading, regular, size),
      );
    }
    y -= height + size * 0.2;
  };
  /** Labels in a column of their own and values at a tab stop past the longest, the colon
   * starting the value ("colon") or ending the label ("label"), lines 1.2 font sizes apart
   * as a typed contract's are; a value wraps under itself. */
  const alignedFields = (items, aligned) => {
    const lineHeight = size * 1.2;
    const labels = items.map(([label]) => (aligned === "label" ? `${label}:` : label));
    const stop = Math.max(...labels.map((label) => textWidth(label, regular, size))) + size * 2;
    for (const [index, [, value]] of items.entries()) {
      const prefix = aligned === "colon" ? ": " : "";
      const x = page.margin + stop + textWidth(prefix, regular, size);
      const lines = wrap(value, regular, size, width - (x - page.margin));
      room(lines.length * lineHeight);
      draw(labels[index], page.margin, y - size, regular, size);
      draw(prefix, page.margin + stop, y - size, regular, size);
      lines.forEach((line, at) => draw(line, x, y - size - at * lineHeight, regular, size));
      y -= lines.length * lineHeight;
    }
    y -= size * 0.4;
  };
  const table = ({ columns, rows, blank = 0, total, repeatHeader }) => {
    const fontSize = size;
    const lineHeight = fontSize * 1.25;
    const padding = 3;
    const widths = columns.map((column) => column.width * width);
    const xs = widths.map(
      (_, index) => page.margin + widths.slice(0, index).reduce((a, b) => a + b, 0),
    );
    const row = (cells, { font = regular, header = false, height } = {}) => {
      const wrapped = cells.map((cell, index) =>
        wrap(cell ?? "", font, fontSize, widths[index] - 2 * padding),
      );
      const lines = Math.max(1, ...wrapped.map((cell) => cell.length));
      const rowHeight = height ?? lines * lineHeight + 2 * padding;
      return { wrapped, rowHeight, lines, font, header };
    };
    const paint = ({ wrapped, rowHeight, lines, font, header }) => {
      wrapped.forEach((cellLines, index) => {
        // Cells with fewer lines sit in the middle of the row.
        const offset = ((lines - cellLines.length) * lineHeight) / 2;
        const align = header ? "center" : (columns[index].align ?? "left");
        cellLines.forEach((line, lineIndex) =>
          draw(
            line,
            xs[index] + padding,
            y - padding - offset - fontSize - lineIndex * lineHeight,
            font,
            fontSize,
            align,
            widths[index] - 2 * padding,
          ),
        );
        current.drawRectangle({
          x: xs[index],
          y: y - rowHeight,
          width: widths[index],
          height: rowHeight,
          borderColor: rule,
          borderWidth: 0.5,
        });
      });
      y -= rowHeight;
    };
    const header = row(
      columns.map((column) => column.title),
      { font: bold, header: true },
    );
    room(header.rowHeight + lineHeight * 2);
    paint(header);
    for (const cells of rows) {
      const body = row(cells);
      if (y - body.rowHeight < page.margin + 20) {
        newPage();
        if (repeatHeader) paint(header);
      }
      paint(body);
    }
    for (let index = 0; index < blank; index++) paint(row(columns.map(() => "")));
    if (total) {
      // The total's label spans every column but the last, centred.
      const spanned = widths.slice(0, -1).reduce((a, b) => a + b, 0);
      room(lineHeight + 2 * padding);
      const rowHeight = lineHeight + 2 * padding;
      draw(total.label, page.margin, y - padding - fontSize, bold, fontSize, "center", spanned);
      draw(
        total.value,
        xs.at(-1) + padding,
        y - padding - fontSize,
        bold,
        fontSize,
        "right",
        widths.at(-1) - 2 * padding,
      );
      current.drawRectangle({
        x: page.margin,
        y: y - rowHeight,
        width: spanned,
        height: rowHeight,
        borderColor: rule,
        borderWidth: 0.5,
      });
      current.drawRectangle({
        x: xs.at(-1),
        y: y - rowHeight,
        width: widths.at(-1),
        height: rowHeight,
        borderColor: rule,
        borderWidth: 0.5,
      });
      y -= rowHeight;
    }
    y -= size * 0.6;
  };
  /** A copy of a citizen identity card, front over back, at its real size (85.6 × 54 mm)
   * on a grey ground: the national header and title, a photo, bilingual labels in small
   * print with the values after them or on the next line, and on the back the issuer and
   * the three machine-readable lines in a monospaced font (decision 0176). */
  const card = ({ front, back, machine }) => {
    const cardWidth = 243;
    const cardHeight = 153;
    const x = page.margin + 20;
    const ground = (top) =>
      current.drawRectangle({
        x,
        y: top - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: rgb(0.83, 0.84, 0.82),
      });
    const label = 4.6;
    const value = 7;
    const rows = (items, left, top) => {
      let at = top;
      for (const [name, text] of items) {
        const width = name ? textWidth(name, regular, label) + 3 : 0;
        if (name) draw(name, left, at - value, regular, label);
        if (text) draw(text, left + width, at - value, bold, value);
        at -= value * 1.45;
      }
      return at;
    };
    room(cardHeight * 2 + 30);
    let top = y - 10;
    ground(top);
    draw("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", x + 60, top - 12, bold, 5.5, "center", 140);
    draw("Độc lập - Tự do - Hạnh phúc", x + 60, top - 19, regular, 4.5, "center", 140);
    draw("CĂN CƯỚC CÔNG DÂN", x + 62, top - 34, bold, 9.5);
    draw("Citizen Identity Card", x + 62, top - 41, regular, 4.5);
    current.drawRectangle({
      x: x + 8,
      y: top - 118,
      width: 50,
      height: 66,
      color: rgb(0.45, 0.45, 0.47),
    });
    rows(front, x + 62, top - 44);
    top -= cardHeight + 12;
    ground(top);
    const end = rows(back, x + 8, top - 6);
    const machineFont = mono;
    machine.forEach((line, index) =>
      draw(line, x + 10, Math.min(end, top - 98) - 8 - index * 11, machineFont, 9.2),
    );
    y = top - cardHeight - 12;
  };
  const signatures = (parties) => {
    const box = width / parties.length;
    room(leading * 6);
    parties.forEach((party, index) => {
      const x = page.margin + index * box;
      draw(party.role, x, y - size, bold, size, "center", box);
      draw(party.note ?? "", x, y - size - leading, regular, size * 0.9, "center", box);
      draw(party.name ?? "", x, y - size - leading * 5, bold, size, "center", box);
    });
    y -= leading * 6;
  };

  newPage();
  for (const block of model.blocks) {
    if (block.pageBreak) newPage();
    else if (block.space !== undefined) y -= block.space;
    else if (block.title !== undefined)
      paragraph(block.title, { align: "center", font: bold, fontSize: size + (block.size ?? 2) });
    else if (block.text !== undefined)
      paragraph(block.text, { align: block.align, font: block.bold ? bold : regular });
    else if (block.fields && block.aligned) alignedFields(block.fields, block.aligned);
    else if (block.fields) fields(block.fields, block.columns ?? 1);
    else if (block.table) table(block.table);
    else if (block.signatures) signatures(block.signatures);
    else if (block.card) card(block.card);
  }
  const pages = doc.getPages();
  pages.forEach((each, index) =>
    each.drawText(`Trang ${index + 1}/${pages.length}`, {
      x: page.width - page.margin - 50,
      y: page.margin - 20,
      size: size * 0.85,
      font: regular,
      color: ink,
    }),
  );
  return doc.save();
}
