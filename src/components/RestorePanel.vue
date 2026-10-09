<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
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
    return "Không tìm thấy bí danh của phiên này trong nội dung đã dán.";
  return current.restored === 1
    ? "Đã khôi phục 1 bí danh."
    : `Đã khôi phục ${current.restored.toLocaleString("vi-VN")} bí danh.`;
});
const unknownNote = computed(() => {
  const unknown = result.value?.unknown ?? [];
  if (!unknown.length) return "";
  return `${unknown.length === 1 ? "1 bí danh" : `${unknown.length} bí danh`} không thuộc phiên này được giữ nguyên: ${unknown.join(", ")}.`;
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
    class="restore glass"
    :open="open"
    @toggle="open = ($event.target as HTMLDetailsElement).open"
  >
    <summary>
      <AppIcon name="undo" :size="16" />Khôi phục bản gốc từ phản hồi của AI
      <span class="restore-hint"
        >Bí danh trong phiên này được thay lại bằng thông tin thật, trên máy bạn.</span
      >
    </summary>
    <div class="restore-body">
      <label class="sr-only" for="restore-input">Phản hồi của AI chứa bí danh</label>
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
