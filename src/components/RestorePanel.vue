<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import { restoreAliases, type Restoration } from "../core/restore.ts";
import type { TextAnalysis } from "../core/text.ts";

const props = defineProps<{ sessionId: string; analysis: TextAnalysis }>();

const reply = ref("");
const result = ref<Restoration | null>(null);
const copied = ref(false);
const copyStatus = ref("");
const open = ref(false);
const output = useTemplateRef<HTMLTextAreaElement>("output");
const panel = useTemplateRef<HTMLDetailsElement>("panel");

/** After the masked copy is on the clipboard, the next step opens and comes into view. */
defineExpose({
  async reveal() {
    open.value = true;
    await nextTick();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.value?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
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
    open.value = false;
  },
);
watch(reply, () => {
  result.value = null;
  copied.value = false;
  copyStatus.value = "";
});

const status = computed(() => {
  const current = result.value;
  if (!current) return "";
  if (!current.restored && !current.unknown.length)
    return "Không tìm thấy mã thay thế của phiên này trong nội dung đã dán.";
  return current.restored === 1
    ? "Đã khôi phục 1 mã thay thế."
    : `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} mã thay thế.`;
});
const unknownNote = computed(() => {
  const unknown = result.value?.unknown ?? [];
  if (!unknown.length) return "";
  return `${unknown.length === 1 ? "1 mã thay thế" : `${unknown.length} mã thay thế`} không thuộc phiên này được giữ nguyên: ${unknown.join(", ")}.`;
});

function restore() {
  if (!reply.value.trim()) return;
  result.value = restoreAliases(reply.value, props.analysis);
  copied.value = false;
  copyStatus.value = "";
}
async function copy() {
  const current = result.value;
  if (!current) return;
  try {
    await navigator.clipboard.writeText(current.text);
    copied.value = true;
    copyStatus.value = "Đã sao chép bản khôi phục.";
  } catch {
    output.value?.focus();
    output.value?.select();
    copyStatus.value = "Nhấn ⌘C hoặc Ctrl+C để sao chép phần đã chọn.";
  }
}
</script>

<template>
  <details
    ref="panel"
    class="restore glass"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary>
      <span class="step-number" aria-hidden="true">4</span>Dán câu trả lời của AI để đọc lại tên
      thật
      <span class="restore-hint"
        >Mã thay thế trong phiên này được đổi lại thành thông tin thật, ngay trên máy bạn.</span
      >
    </summary>
    <div class="restore-body">
      <label class="sr-only" for="restore-input">Phản hồi của AI chứa mã thay thế</label>
      <textarea
        id="restore-input"
        v-model="reply"
        class="text-content restore-input"
        placeholder="Dán phản hồi của AI vào đây…"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        @keydown.meta.enter.prevent="restore"
        @keydown.ctrl.enter.prevent="restore"
      ></textarea>
      <div class="restore-actions">
        <p v-if="status" class="restore-status" role="status">
          {{ status }}<span v-if="unknownNote" class="restore-unknown">{{ unknownNote }}</span>
        </p>
        <button class="primary-action" :disabled="!reply.trim()" @click="restore">
          <AppIcon name="undo" :size="16" />Khôi phục
        </button>
      </div>
      <template v-if="result && result.restored">
        <label class="sr-only" for="restore-output">Bản đã khôi phục</label>
        <textarea
          id="restore-output"
          ref="output"
          class="text-content restore-input"
          :value="result.text"
          readonly
          spellcheck="false"
        ></textarea>
        <div class="restore-actions">
          <p v-if="copyStatus" class="restore-status" role="status">{{ copyStatus }}</p>
          <button class="quiet-button" @click="copy">
            <AppIcon :name="copied ? 'check' : 'copy'" :size="15" />{{
              copied ? "Đã sao chép" : "Sao chép bản khôi phục"
            }}
          </button>
        </div>
      </template>
    </div>
  </details>
</template>
