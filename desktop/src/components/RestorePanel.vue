<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import HighlightedText from "./HighlightedText.vue";
import RestoreIntro from "./RestoreIntro.vue";
import { restoreAliases, type Restoration } from "../core/restore.ts";
import type { TextAnalysis } from "../core/text.ts";

const props = withDefaults(
  defineProps<{
    sessionId: string;
    analysis: TextAnalysis;
    /** What was masked, as the page names it: văn bản, bảng tính, tài liệu. Empty on the
     * restore page, which reads replies about anything masked (decision 0172). */
    subject?: string;
    newLabel?: string;
  }>(),
  { subject: "văn bản", newLabel: "Ẩn văn bản mới" },
);
/** After copying, the next step is another reply or a new text; nothing needs "finishing".
 * `pasted` tells the page a reply is in, so its "paste the reply here" note can go. */
const emit = defineEmits<{ newText: []; pasted: [boolean] }>();

const reply = ref("");
const result = ref<Restoration | null>(null);
const copied = ref(false);
const copyStatus = ref("");
const output = useTemplateRef<InstanceType<typeof HighlightedText>>("output");
const input = useTemplateRef<HTMLTextAreaElement>("input");

defineExpose({
  focusInput() {
    input.value?.focus({ preventScroll: true });
  },
});

// Pasted replies and results belong to one session and never outlive it.
watch(
  () => props.sessionId,
  () => {
    reply.value = "";
    result.value = null;
    copied.value = false;
    copyStatus.value = "";
  },
);
// Restoring is instant and local, so it follows the pasted reply as it changes.
watch(reply, (text) => {
  result.value = text.trim() ? restoreAliases(text, props.analysis) : null;
  copied.value = false;
  copyStatus.value = "";
  emit("pasted", Boolean(result.value));
});
// Leaving the step drops the pasted reply with this panel.
onBeforeUnmount(() => emit("pasted", false));

const status = computed(() => {
  const current = result.value;
  if (!current) return "";
  if (!current.restored && !current.unknown.length)
    return props.subject
      ? `Không tìm thấy mã thay thế của ${props.subject} này trong nội dung đã dán.`
      : "Không tìm thấy mã thay thế nào bạn đã ẩn trong nội dung đã dán.";
  return current.restored === 1
    ? "Đã khôi phục 1 mã thay thế."
    : `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} mã thay thế.`;
});
const unknownNote = computed(() => {
  const unknown = result.value?.unknown ?? [];
  if (!unknown.length) return "";
  const owner = props.subject ? `${props.subject} này` : "nội dung nào bạn đã ẩn trên máy này";
  return `${unknown.length === 1 ? "1 mã thay thế" : `${unknown.length} mã thay thế`} không thuộc ${owner} được giữ nguyên: ${unknown.join(", ")}.`;
});

/** Clear the box for the AI's next reply in the same conversation. */
function anotherReply() {
  reply.value = "";
  input.value?.focus({ preventScroll: true });
  input.value?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
async function copy() {
  const current = result.value;
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.text);
    copied.value = true;
    copyStatus.value = "Đã sao chép bản đã khôi phục.";
  } catch {
    output.value?.field?.focus();
    output.value?.field?.select();
    copyStatus.value = "Nhấn ⌘C hoặc Ctrl+C để sao chép phần đã chọn.";
  }
}
</script>

<template>
  <!-- Once a reply is in, the result is what matters: the pasted reply shrinks and the
       restored copy gets the room, under its own label (decision 0134). -->
  <div class="restore-body" :class="{ 'has-result': result?.restored }">
    <RestoreIntro :subject="subject" />
    <label class="sr-only" for="restore-input">Câu trả lời của AI chứa mã thay thế</label>
    <textarea
      id="restore-input"
      ref="input"
      v-model="reply"
      class="text-content restore-input"
      placeholder="Dán câu trả lời của AI vào đây…"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
    ></textarea>
    <p v-if="status" class="restore-status" role="status">
      <strong v-if="result?.restored">Bản đã khôi phục</strong>{{ status
      }}<span v-if="unknownNote" class="restore-unknown">{{ unknownNote }}</span>
    </p>
    <template v-if="result && result.restored">
      <label class="sr-only" for="restore-output">Bản đã khôi phục</label>
      <HighlightedText
        id="restore-output"
        ref="output"
        class="restore-output"
        :value="result.text"
        :marks="result.marks"
      />
    </template>
  </div>
  <!-- One action row for the step, kept in view; the page adds its own buttons. -->
  <footer class="card-footer">
    <span class="action-hint" role="status"
      ><template v-if="copyStatus">{{ copyStatus }}</template
      ><slot v-else name="hint"
    /></span>
    <slot />
    <template v-if="result && result.restored">
      <template v-if="copied">
        <button class="quiet-button" @click="anotherReply">Dán câu trả lời khác</button>
        <button class="quiet-button" @click="emit('newText')">
          <AppIcon name="plus" :size="15" />{{ newLabel }}
        </button>
      </template>
      <button v-else class="primary-action" @click="copy">
        <AppIcon name="copy" :size="17" />Sao chép bản đã khôi phục
      </button>
    </template>
  </footer>
</template>
