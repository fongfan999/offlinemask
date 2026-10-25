<script setup lang="ts">
import { computed, h, type FunctionalComponent } from "vue";
import { toBlocks, type Block, type Marked } from "../core/doc/blocks.ts";

/** The first paragraphs of a document, as a page, with replaced text highlighted:
 * aliases in the masked copy, values in a restored one. A PDF's paragraphs carry their
 * page and table, and read as its Markdown does (decision 0149): a heading per page and
 * each table's rows in columns, its first row as the header. */
const props = defineProps<{
  paragraphs: readonly (Marked & { page?: number; table?: number })[];
  label: string;
  tone?: "alias" | "value";
}>();

const sections = computed(() => {
  const sections: { page?: number; items: Marked[] }[] = [];
  for (const paragraph of props.paragraphs) {
    const last = sections.at(-1);
    if (last && last.page === paragraph.page) last.items.push(paragraph);
    else sections.push({ page: paragraph.page, items: [paragraph] });
  }
  return sections.map((section) => ({
    page: section.page,
    // Word paragraphs keep their tabs as written; only a PDF's rows are cells.
    blocks:
      section.page === undefined
        ? section.items.map((content): Block => ({ kind: "paragraph", content }))
        : toBlocks(section.items),
  }));
});

/** Text with its marks as <mark>. */
const MarkedText: FunctionalComponent<{ content: Marked; tone: "alias" | "value" }> = ({
  content,
  tone,
}) => {
  const nodes: (string | ReturnType<typeof h>)[] = [];
  let cursor = 0;
  for (const mark of [...content.marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < cursor) continue;
    if (mark.start > cursor) nodes.push(content.text.slice(cursor, mark.start));
    nodes.push(h("mark", { class: tone }, content.text.slice(mark.start, mark.end)));
    cursor = mark.end;
  }
  if (cursor < content.text.length) nodes.push(content.text.slice(cursor));
  return nodes;
};
</script>

<template>
  <div class="doc-preview" tabindex="0" role="document" :aria-label="label">
    <template v-for="(section, index) in sections" :key="index">
      <h3 v-if="section.page !== undefined" class="doc-page-heading">Trang {{ section.page }}</h3>
      <template v-for="(block, position) in section.blocks" :key="position">
        <p v-if="block.kind === 'paragraph'">
          <MarkedText :content="block.content" :tone="tone ?? 'alias'" />
        </p>
        <div v-else class="doc-table">
          <table>
            <tr v-for="(row, line) in block.rows" :key="line">
              <td v-for="(cell, column) in row" :key="column">
                <MarkedText :content="cell" :tone="tone ?? 'alias'" />
              </td>
            </tr>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
