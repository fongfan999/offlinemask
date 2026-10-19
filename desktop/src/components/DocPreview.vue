<script setup lang="ts">
import { computed } from "vue";

/** The first paragraphs of a Word document, as a page, with replaced text highlighted:
 * aliases in the masked copy, values in a restored one. */
const props = defineProps<{
  paragraphs: readonly { text: string; marks: readonly { start: number; end: number }[] }[];
  label: string;
  tone?: "alias" | "value";
}>();
const parts = computed(() =>
  props.paragraphs.map((paragraph) => {
    const pieces: { text: string; marked: boolean }[] = [];
    let cursor = 0;
    for (const mark of [...paragraph.marks].sort((a, b) => a.start - b.start)) {
      if (mark.start < cursor) continue;
      if (mark.start > cursor)
        pieces.push({ text: paragraph.text.slice(cursor, mark.start), marked: false });
      pieces.push({ text: paragraph.text.slice(mark.start, mark.end), marked: true });
      cursor = mark.end;
    }
    if (cursor < paragraph.text.length)
      pieces.push({ text: paragraph.text.slice(cursor), marked: false });
    return pieces;
  }),
);
</script>

<template>
  <div class="doc-preview" tabindex="0" role="document" :aria-label="label">
    <p v-for="(pieces, index) in parts" :key="index">
      <template v-for="(piece, position) in pieces" :key="position"
        ><mark v-if="piece.marked" :class="tone ?? 'alias'">{{ piece.text }}</mark
        ><template v-else>{{ piece.text }}</template></template
      >
    </p>
  </div>
</template>
