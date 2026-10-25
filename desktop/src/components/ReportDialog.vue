<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import { openReportPage } from "../adapters/desktop.ts";
import {
  reportKinds,
  reportMessageLimit,
  reportUrl,
  systemName,
  type ReportKind,
} from "../core/report.ts";

// Báo lỗi (decision 0147): the user writes here, the website sends. The app itself has no
// internet access, so it only opens the report page with this text filled in.
const props = defineProps<{ version: string; screen: string }>();

const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const kind = ref<ReportKind>("missed");
const message = ref("");
const error = ref("");
const os = systemName(navigator.userAgent);
const details = computed(() =>
  [`OfflineMask ${props.version}`, os, `màn hình ${props.screen}`].filter(Boolean).join(" · "),
);

function open() {
  error.value = "";
  dialog.value?.showModal();
}
async function send() {
  if (!message.value.trim()) {
    error.value = "Bạn viết vài chữ về chuyện đã xảy ra nhé.";
    return;
  }
  error.value = "";
  const url = reportUrl({
    kind: kind.value,
    message: message.value,
    version: props.version,
    os,
    screen: props.screen,
  });
  try {
    await openReportPage(url);
    dialog.value?.close();
    kind.value = "missed";
    message.value = "";
  } catch {
    error.value = "Chưa mở được trình duyệt. Bạn có thể vào OfflineMask.com/bao-loi để báo lỗi.";
  }
}
defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="report-dialog glass" aria-labelledby="report-title">
    <form @submit.prevent="send">
      <header class="report-header">
        <h2 id="report-title">Báo lỗi</h2>
        <button type="button" class="report-close" aria-label="Đóng" @click="dialog?.close()">
          <AppIcon name="close" :size="16" />
        </button>
      </header>
      <p class="report-offline">
        <AppIcon name="info" :size="16" /><span
          >OfflineMask không kết nối Internet nên không tự gửi được. Khi bạn bấm
          <strong>Mở trang báo lỗi</strong>, trình duyệt sẽ mở OfflineMask.com với nội dung bạn viết
          ở đây. Bạn chỉ cần bấm <strong>Gửi</strong> trên trang đó.</span
        >
      </p>
      <fieldset class="report-kinds">
        <legend>Chuyện gì đã xảy ra?</legend>
        <label v-for="choice in reportKinds" :key="choice.kind">
          <input v-model="kind" type="radio" name="report-kind" :value="choice.kind" />{{
            choice.label
          }}
        </label>
      </fieldset>
      <label class="report-field" for="report-message">Kể thêm một chút</label>
      <textarea
        id="report-message"
        v-model="message"
        autofocus
        rows="4"
        :maxlength="reportMessageLimit"
        aria-describedby="report-hint"
        placeholder="Ví dụ: số điện thoại có dấu chấm ở giữa không được ẩn."
      ></textarea>
      <p id="report-hint" class="report-hint">
        Chỉ cần mô tả. Đừng dán tên, số điện thoại hay nội dung giấy tờ thật.
      </p>
      <p class="report-hint">Gửi kèm: {{ details }}</p>
      <p v-if="error" class="quick-error" role="alert">{{ error }}</p>
      <div class="report-actions">
        <button type="button" class="quiet-button" @click="dialog?.close()">Hủy</button>
        <button type="submit" class="primary-action">
          Mở trang báo lỗi<AppIcon name="external" :size="14" />
        </button>
      </div>
    </form>
  </dialog>
</template>
