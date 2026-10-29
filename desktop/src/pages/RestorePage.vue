<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef } from "vue";
import AppIcon from "../components/AppIcon.vue";
import FileDropZone from "../components/FileDropZone.vue";
import RestoreIntro from "../components/RestoreIntro.vue";
import RestorePanel from "../components/RestorePanel.vue";
import {
  docKey,
  folderKey,
  quickKey,
  sheetKey,
  useProvided,
  type Page,
} from "../composables/context.ts";
import type { DocRestore } from "../composables/useDocRun.ts";
import type { SheetRestore } from "../composables/useSheetRun.ts";
import { fileKind } from "../core/file-kind.ts";

/** "Lấy lại thông tin thật" (decision 0172): the third step as a place of its own. A
 * pasted reply or a returned file is restored with every alias this launch knows, so
 * nobody has to remember which text, file or folder the reply came from. */
const emit = defineEmits<{ navigate: [destination: Page] }>();
const quick = useProvided(quickKey);
const folder = useProvided(folderKey);
const doc = useProvided(docKey);
const sheet = useProvided(sheetKey);
const heading = useTemplateRef<HTMLHeadingElement>("heading");

const findings = computed(() => [...quick.knownFindings.value, ...folder.findings.value]);
const analysis = computed(() => ({ findings: findings.value, spans: [] }));
const kind = ref<"text" | "file">("text");

type Returned = { from: "doc"; result: DocRestore } | { from: "sheet"; result: SheetRestore };
const returned = shallowRef<Returned | null>(null);
const busy = ref(false);
const error = ref("");
const saved = ref(false);

function close() {
  const current = returned.value;
  if (current?.from === "doc") doc.closeReturned(current.result);
  if (current?.from === "sheet") sheet.closeReturned(current.result);
  returned.value = null;
  saved.value = false;
}
onBeforeUnmount(close);

async function openFile(file: File) {
  close();
  error.value = "";
  const type = fileKind(file.name);
  if (type !== "excel" && type !== "word" && type !== "text") {
    error.value = "Chỉ lấy lại được từ tệp Word (.docx, .odt), Excel, CSV, .md hoặc .txt.";
    return;
  }
  busy.value = true;
  if (type === "excel") {
    const result = await sheet.openReply(findings.value, file);
    if (typeof result === "string") error.value = result;
    else returned.value = { from: "sheet", result };
  } else {
    const result = await doc.openReply(findings.value, file);
    if (typeof result === "string") error.value = result;
    else returned.value = { from: "doc", result };
  }
  busy.value = false;
}
const status = computed(() => {
  const current = returned.value?.result;
  if (!current) return "";
  if (!current.restored)
    return "Không tìm thấy mã thay thế nào bạn đã ẩn trong tệp này. Hãy kiểm tra đúng tệp AI trả về.";
  return `Đã đổi lại ${current.restored.toLocaleString("vi-VN")} mã thay thế trong “${current.fileName}”.`;
});
async function download() {
  const current = returned.value;
  if (!current) return;
  try {
    saved.value =
      current.from === "doc"
        ? await doc.downloadRestored(current.result)
        : await sheet.downloadRestored(current.result);
  } catch {
    error.value = "Chưa lưu được tệp. Hãy thử lại.";
  }
}

defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <h1 ref="heading" tabindex="-1">Lấy lại thông tin thật</h1>
      <p>
        Dán câu trả lời của AI, hoặc kéo vào tệp AI trả về. Tên thật hiện lại, chỉ trên máy bạn.
      </p>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Lấy lại thông tin thật">
    <!-- Nothing masked in this launch yet: there is nothing to put back. -->
    <div v-if="!findings.length" class="step-panel">
      <div class="restore-body">
        <p class="restore-intro">
          Chưa có gì để lấy lại. Hãy ẩn một văn bản, tệp hoặc thư mục trước, gửi bản đã ẩn cho AI,
          rồi quay lại đây với câu trả lời.
        </p>
      </div>
      <footer class="card-footer">
        <button class="primary-action" @click="emit('navigate', 'home')">
          <AppIcon name="mask" :size="17" />Ẩn thông tin<AppIcon name="arrow" :size="16" />
        </button>
      </footer>
    </div>

    <div v-else class="step-panel">
      <header class="card-header">
        <div class="view-switch" aria-label="Lấy lại từ">
          <button :aria-pressed="kind === 'text'" @click="kind = 'text'">
            Câu trả lời dạng chữ</button
          ><button :aria-pressed="kind === 'file'" @click="kind = 'file'">Tệp AI trả về</button>
        </div>
      </header>
      <RestorePanel
        v-if="kind === 'text'"
        session-id="all"
        :analysis="analysis"
        subject=""
        new-label="Ẩn nội dung mới"
        @new-text="emit('navigate', 'home')"
      />
      <template v-else>
        <div class="restore-body"><RestoreIntro /></div>
        <FileDropZone
          v-if="!returned"
          icon="undo"
          title="Kéo thả tệp AI trả về vào đây"
          hint="Word, Excel, CSV, .md, .txt"
          accept=".docx,.odt,.md,.txt,.xlsx,.xls,.ods,.csv"
          :busy="busy"
          @file="openFile"
        />
        <template v-else>
          <p class="sheet-summary" role="status">
            <AppIcon :name="returned.result.restored ? 'check' : 'info'" :size="15" />{{ status }}
          </p>
          <p v-if="returned.result.unknown.length" class="sheet-note restore-unknown">
            {{ returned.result.unknown.length }} mã thay thế không thuộc nội dung nào bạn đã ẩn trên
            máy này được giữ nguyên.
          </p>
        </template>
        <p v-if="error" class="input-error drop-error" role="alert">{{ error }}</p>
        <footer class="card-footer sheet-footer">
          <span class="action-hint" role="status">{{
            saved ? "Đã lưu tệp đã khôi phục." : ""
          }}</span>
          <button
            v-if="returned && (saved || !returned.result.restored)"
            class="quiet-button"
            @click="close"
          >
            Chọn tệp khác
          </button>
          <button
            v-if="returned && returned.result.restored && !saved"
            class="primary-action"
            @click="download"
          >
            <AppIcon name="download" :size="17" />Lưu tệp đã khôi phục
          </button>
        </footer>
      </template>
    </div>
  </section>
</template>
