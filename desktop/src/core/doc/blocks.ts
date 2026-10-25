/** How a PDF's paragraphs read, shared by its Markdown and its preview (decision 0149):
 * rows of one table (the `table` the reader gave them) make a table; any other paragraph
 * reads as it is. Marks (aliases or restored values) follow the text into the cells
 * they fall in. */
export interface Marked {
  text: string;
  marks: readonly { start: number; end: number }[];
  table?: number;
}
export type Block =
  { kind: "paragraph"; content: Marked } | { kind: "table"; table: number; rows: Marked[][] };

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
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.table === undefined) blocks.push({ kind: "paragraph", content: item });
    else if (last?.kind === "table" && last.table === item.table) last.rows.push(splitCells(item));
    else blocks.push({ kind: "table", table: item.table, rows: [splitCells(item)] });
  }
  return blocks;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").trim();
/** Blocks as Markdown. A table's first row is its header, as Markdown requires (on the
 * documents tried it is the real header); rows are padded to the widest. */
export function blocksToMarkdown(blocks: readonly Block[]): string[] {
  return blocks.map((block) => {
    if (block.kind === "paragraph") return block.content.text;
    const width = Math.max(...block.rows.map((row) => row.length));
    const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
    const padded = block.rows.map((row) =>
      Array.from({ length: width }, (_, index) => cell(row[index]?.text ?? "")),
    );
    return [line(padded[0]!), line(padded[0]!.map(() => "---")), ...padded.slice(1).map(line)].join(
      "\n",
    );
  });
}
