<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import HighlightedText from "./HighlightedText.vue";
import { restoreAliases, type Restoration } from "../core/restore.ts";
import type { TextAnalysis } from "../core/text.ts";

const props = defineProps<{ sessionId: string; analysis: TextAnalysis; newLabel?: string }>();
/** After copying, the next step is another reply or a new text; nothing needs "finishing". */
const emit = defineEmits<{ newText: [] }>();

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
});

const status = computed(() => {
  const current = result.value;
  if (!current) return "";
  if (!current.restored && !current.unknown.length)
    return "Không tìm thấy mã thay thế của văn bản này trong nội dung đã dán.";
  return current.restored === 1
    ? "Đã khôi phục 1 mã thay thế."
    : `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} mã thay thế.`;
});
const unknownNote = computed(() => {
  const unknown = result.value?.unknown ?? [];
  if (!unknown.length) return "";
  return `${unknown.length === 1 ? "1 mã thay thế" : `${unknown.length} mã thay thế`} không thuộc văn bản này được giữ nguyên: ${unknown.join(", ")}.`;
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
    copyStatus.value = "Đã sao chép bản khôi phục.";
  } catch {
    output.value?.field?.focus();
    output.value?.field?.select();
    copyStatus.value = "Nhấn ⌘C hoặc Ctrl+C để sao chép phần đã chọn.";
  }
}
</script>

<template>
  <div class="restore-body">
    <p class="restore-intro">
      Dán câu trả lời của AI vào đây. Mã thay thế của văn bản này được đổi lại thành thông tin thật,
      ngay trên máy bạn.
    </p>
    <label class="sr-only" for="restore-input">Phản hồi của AI chứa mã thay thế</label>
    <textarea
      id="restore-input"
      ref="input"
      v-model="reply"
      class="text-content restore-input"
      placeholder="Dán phản hồi của AI vào đây…"
      spellcheck="false"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
    ></textarea>
    <p v-if="status" class="restore-status" role="status">
      {{ status }}<span v-if="unknownNote" class="restore-unknown">{{ unknownNote }}</span>
    </p>
    <template v-if="result && result.restored">
      <label class="sr-only" for="restore-output">Bản đã khôi phục</label>
      <HighlightedText
        id="restore-output"
        ref="output"
        :value="result.text"
        :marks="result.marks"
      />
      <div class="restore-actions">
        <p v-if="copyStatus" class="restore-status" role="status">{{ copyStatus }}</p>
        <template v-if="copied">
          <button class="quiet-button" @click="anotherReply">Dán câu trả lời khác</button>
          <button class="quiet-button" @click="emit('newText')">
            <AppIcon name="plus" :size="15" />{{ newLabel ?? "Ẩn văn bản mới" }}
          </button>
        </template>
        <button v-else class="primary-action" @click="copy">
          <AppIcon name="copy" :size="17" />Sao chép bản khôi phục
        </button>
      </div>
    </template>
  </div>
</template>
