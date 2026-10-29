/** The document model shared by every synthetic kind (decision 0153): a recorder for the
 * values a kind places, and the national header of official documents. Blocks:
 *   { title, size? }                       centred, bold
 *   { text, align?, bold? }                a paragraph that wraps
 *   { fields: [[label, value]...], columns? }  "Label: value" lines, one or two a line
 *   { fields, aligned: "colon" | "label" }  labels in a column, values at a tab stop
 *   { table: { columns: [{ title, width, align? }], rows, blank?, total? } }
 *   { signatures: [{ role, note?, name }] }
 *   { space } / { pageBreak: true }
 * A document has { font: "sans" | "serif", size, blocks }. */
export function recorder() {
  const lists = { hide: new Set(), keep: new Set(), ignore: new Set() };
  const add = (list) => (value) => (lists[list].add(String(value)), value);
  const contexts = new Map();
  return {
    hide: add("hide"),
    /** A short value that must be hidden only where it stands in `context` ("bà Trang"),
     * not everywhere ("Trang 1/1"). Returns the context, to be placed as it is. */
    hideIn: (value, context) => (contexts.set(context, { value, in: context }), context),
    keep: add("keep"),
    ignore: add("ignore"),
    lists: () => {
      // A value both hidden and kept is a generator mistake; hiding wins.
      for (const value of lists.hide) lists.keep.delete(value);
      const result = Object.fromEntries(Object.entries(lists).map(([key, set]) => [key, [...set]]));
      result.hide.push(...contexts.values());
      return result;
    },
  };
}
export const nationalHeader = (r) => [
  { title: r.keep("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"), size: 1 },
  { text: r.keep("Độc lập - Tự do - Hạnh phúc"), align: "center", bold: true },
  { space: 8 },
];
