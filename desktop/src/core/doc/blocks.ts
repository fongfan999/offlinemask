/** How a PDF's paragraphs read, shared by its Markdown and its preview (decision 0149):
 * a paragraph with tabs is a row of cells; two or more rows in a row are a table, and a
 * row on its own reads inline, its cells separated by " · ". A single line between two
 * rows (a product name wrapped inside its cell) stays in the table as a row of one cell.
 * Marks (aliases or restored values) follow the text into the cells they fall in. */
export interface Marked {
  text: string;
  marks: readonly { start: number; end: number }[];
}
export type Block =
  | { kind: "paragraph"; content: Marked }
  | { kind: "row"; cells: Marked[] }
  | { kind: "table"; rows: Marked[][] };

/** A paragraph's cells, each with the marks inside it. */
export function splitCells({ text, marks }: Marked): Marked[] {
  const cells: Marked[] = [];
  let start = 0;
  for (const cell of text.split("\t")) {
    const end = start + cell.length;
    cells.push({
      text: cell,
      marks: marks
        .filter((mark) => mark.start < end && mark.end > start)
        .map((mark) => ({
          start: Math.max(mark.start, start) - start,
          end: Math.min(mark.end, end) - start,
        })),
    });
    start = end + 1;
  }
  return cells;
}

export function toBlocks(items: readonly Marked[]): Block[] {
  const blocks: Block[] = [];
  let rows: Marked[][] = [];
  const flush = () => {
    if (rows.length === 1) blocks.push({ kind: "row", cells: rows[0]! });
    else if (rows.length) blocks.push({ kind: "table", rows });
    rows = [];
  };
  items.forEach((item, index) => {
    // A wrapped cell is short and is not a "Label: value" line of a form.
    const between =
      rows.length > 0 &&
      !!items[index + 1]?.text.includes("\t") &&
      item.text.length <= 60 &&
      !/:(\s|$)/.test(item.text);
    if (item.text.includes("\t") || between) rows.push(splitCells(item));
    else {
      flush();
      blocks.push({ kind: "paragraph", content: item });
    }
  });
  flush();
  return blocks;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").trim();
/** Blocks as Markdown. A PDF says nothing about which row heads a table, so the header
 * Markdown requires is left empty and every row is a body row; rows are padded to the
 * widest. */
export function blocksToMarkdown(blocks: readonly Block[]): string[] {
  return blocks.map((block) => {
    if (block.kind === "paragraph") return block.content.text;
    if (block.kind === "row") return block.cells.map((item) => item.text.trim()).join(" · ");
    const width = Math.max(...block.rows.map((row) => row.length));
    const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
    const padded = block.rows.map((row) =>
      Array.from({ length: width }, (_, index) => cell(row[index]?.text ?? "")),
    );
    return [
      line(padded[0]!.map(() => "")),
      line(padded[0]!.map(() => "---")),
      ...padded.map(line),
    ].join("\n");
  });
}
