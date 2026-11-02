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

// Báo lỗi hoặc góp ý (decisions 0147, 0197): the user writes here, the website sends. The app
// itself has no internet access, so it only opens the report page with this text filled in.
const props = defineProps<{ version: string; screen: string }>();

const dialog = useTemplateRef<HTMLDialogElement>("dialog");
const field = useTemplateRef<HTMLTextAreaElement>("field");
const kind = ref<ReportKind>("missed");
const message = ref("");
const missing = ref(false);
const error = ref("");
const os = systemName(navigator.userAgent);
const example = computed(() => reportKinds.find((choice) => choice.kind === kind.value)!.example);
const details = computed(() =>
  [`OfflineMask ${props.version}`, os, `màn hình ${props.screen}`].filter(Boolean).join(" - "),
);

function open() {
  missing.value = false;
  error.value = "";
  dialog.value?.showModal();
}
async function send() {
  if (!message.value.trim()) {
    missing.value = true;
    field.value?.focus();
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
    error.value = "Chưa mở được trình duyệt. Bạn có thể vào OfflineMask.com/bao-loi để gửi.";
  }
}
defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="report-dialog glass" aria-labelledby="report-title">
    <form novalidate @submit.prevent="send">
      <header class="report-header">
        <h2 id="report-title">Báo lỗi hoặc góp ý</h2>
        <button
          type="button"
          class="icon-button report-close"
          aria-label="Đóng"
          @click="dialog?.close()"
        >
          <AppIcon name="close" :size="16" />
        </button>
      </header>
      <fieldset class="report-kinds">
        <legend>Bạn muốn báo điều gì?</legend>
        <label v-for="choice in reportKinds" :key="choice.kind">
          <input v-model="kind" type="radio" name="report-kind" :value="choice.kind" />{{
            choice.label
          }}
        </label>
      </fieldset>
      <label class="report-field" for="report-message">Kể thêm một chút</label>
      <textarea
        id="report-message"
        ref="field"
        v-model="message"
        autofocus
        rows="4"
        :maxlength="reportMessageLimit"
        :aria-invalid="missing || undefined"
        aria-describedby="report-hint"
        :placeholder="example"
        @input="missing = false"
      ></textarea>
      <p v-if="missing" id="report-hint" class="report-missing" role="alert">
        Bạn viết vài chữ trước khi tiếp tục nhé.
      </p>
      <p v-else id="report-hint" class="report-hint">
        Chỉ cần mô tả. Đừng dán tên, số điện thoại hay nội dung giấy tờ thật.
      </p>
      <p class="report-offline">
        <AppIcon name="info" :size="14" /><span
          >OfflineMask không kết nối Internet, nên phần gửi diễn ra trên OfflineMask.com: trình
          duyệt mở trang với nội dung trên, bạn chỉ cần bấm <strong>Gửi</strong>. Gửi kèm:
          {{ details }}.</span
        >
      </p>
      <p v-if="error" class="quick-error" role="alert">{{ error }}</p>
      <div class="report-actions">
        <button type="button" class="quiet-button" @click="dialog?.close()">Hủy</button>
        <button type="submit" class="primary-action">
          Tiếp tục trên trình duyệt<AppIcon name="external" :size="14" />
        </button>
      </div>
    </form>
  </dialog>
</template>
