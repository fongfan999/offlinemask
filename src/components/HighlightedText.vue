<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useAttrs, useTemplateRef, watch } from "vue";
import type { TextMark } from "../core/review-marks.ts";

/** A read-only textarea with highlights drawn on a mirror behind it. The textarea
 * keeps native selection, keyboard access and copying; the mirror repeats the
 * same text in transparent ink and only paints the marked runs. */
defineOptions({ inheritAttrs: false });
const props = defineProps<{ value: string; marks: readonly TextMark[] }>();
const attrs = useAttrs();
const field = useTemplateRef<HTMLTextAreaElement>("field");
const mirror = useTemplateRef<HTMLDivElement>("mirror");

// The class styles the wrapper; ids, ARIA and listeners belong to the textarea.
// $attrs is not reactive, so this is read on every render rather than cached.
function fieldAttrs() {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "class"));
}
const parts = computed(() => {
  const result: { text: string; kind?: TextMark["kind"] }[] = [];
  let cursor = 0;
  for (const mark of props.marks) {
    if (mark.start < cursor || mark.end > props.value.length) continue;
    if (mark.start > cursor) result.push({ text: props.value.slice(cursor, mark.start) });
    result.push({ text: props.value.slice(mark.start, mark.end), kind: mark.kind });
    cursor = mark.end;
  }
  // A trailing newline still occupies a line in the textarea.
  result.push({ text: props.value.slice(cursor) + "​" });
  return result;
});

// The mirror matches the textarea's inner box, which shrinks when a scrollbar appears.
function sync() {
  const source = field.value;
  const target = mirror.value;
  if (!source || !target) return;
  const style = getComputedStyle(source);
  const borders = (side: "Left" | "Right" | "Top" | "Bottom") =>
    parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0;
  target.style.width = `${source.clientWidth + borders("Left") + borders("Right")}px`;
  target.style.height = `${source.clientHeight + borders("Top") + borders("Bottom")}px`;
  target.scrollTop = source.scrollTop;
}
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(sync);
  if (field.value) observer.observe(field.value);
  sync();
});
onBeforeUnmount(() => observer?.disconnect());
watch(
  () => [props.value, props.marks],
  () => requestAnimationFrame(sync),
);

defineExpose({ field });
</script>

<template>
  <div class="highlight-field" :class="attrs.class">
    <div ref="mirror" class="text-content highlight-mirror" aria-hidden="true">
      <template v-for="(part, index) in parts" :key="index"
        ><mark v-if="part.kind" :class="`mark-${part.kind}`">{{ part.text }}</mark
        ><template v-else>{{ part.text }}</template></template
      >
    </div>
    <textarea
      ref="field"
      v-bind="fieldAttrs()"
      class="text-content highlight-input"
      :value="value"
      readonly
      spellcheck="false"
      @scroll="sync"
    ></textarea>
  </div>
</template>
