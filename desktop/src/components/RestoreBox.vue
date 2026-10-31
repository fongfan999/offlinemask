<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import FileDropZone from "./FileDropZone.vue";
import RestoreIntro from "./RestoreIntro.vue";
import RestorePanel from "./RestorePanel.vue";
import { docKey, folderKey, quickKey, sheetKey, useProvided } from "../composables/context.ts";
import type { DocRestore } from "../composables/useDocRun.ts";
import type { SheetRestore } from "../composables/useSheetRun.ts";
import { fileKind } from "../core/file-kind.ts";
import type { Finding } from "../core/review.ts";

/** "Nhận lại bản đầy đủ", home's second tab (decision 0172). A pasted reply or a returned
 * file is restored with every alias this launch knows, so nobody has to remember which
 * text, file or folder the reply came from. */
const props = defineProps<{
  /** A page's own codes, such as a folder's at its step 3 (decision 0171); home leaves it
   * out and reads every code this launch knows. Inside the page's card, without its own. */
  scope?: readonly Finding[];
  subject?: string;
  newLabel?: string;
}>();
const emit = defineEmits<{ hide: [] }>();
const quick = useProvided(quickKey);
const folder = useProvided(folderKey);
const doc = useProvided(docKey);
const sheet = useProvided(sheetKey);
const panel = useTemplateRef<InstanceType<typeof RestorePanel>>("panel");

const findings = computed(() =>
  props.scope ? [...props.scope] : [...quick.knownFindings.value, ...folder.findings.value],
);
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
  return `Đã đổi lại ${current.restored.toLocaleString("vi-VN")} mã thay thế trong "${current.fileName}".`;
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
  /** A reply pasted anywhere on home lands in the box. */
  fill(text: string) {
    kind.value = "text";
    void nextTick(() => panel.value?.fill(text));
  },
});
</script>

<template>
  <section :class="scope ? 'restore-box' : 'glass-card glass restore-box'">
    <!-- Nothing masked in this launch yet: show what the tab will do with a reply, the
         hero's swap read backwards, and lead to the first tab. -->
    <div v-if="!findings.length && !scope" class="restore-empty">
      <p class="restore-demo" aria-hidden="true">
        <span class="restore-demo-from">AI trả lời</span>Chào
        <span class="restore-pair"><s>[TEN_1_4e8c]</s><b>Phong Phan</b></span
        >, mình đã ghi nhận số
        <span class="restore-pair"><s>[SDT_1_4e8c]</s><b>0901234567</b></span> của bạn.
      </p>
      <h2>Chưa có gì để nhận lại</h2>
      <p class="restore-empty-text">
        Hãy ẩn thông tin trước, rồi gửi bản đã ẩn cho AI. Khi AI trả lời, dán câu trả lời vào đây:
        các mã sẽ đổi lại thành thông tin thật.
      </p>
      <button class="primary-action" @click="emit('hide')">
        <AppIcon name="mask" :size="17" />Ẩn thông tin riêng<AppIcon name="arrow" :size="16" />
      </button>
    </div>

    <div v-else class="step-panel">
      <header class="card-header">
        <div class="view-switch" aria-label="Nhận lại từ">
          <button :aria-pressed="kind === 'text'" @click="kind = 'text'">
            Câu trả lời dạng chữ</button
          ><button :aria-pressed="kind === 'file'" @click="kind = 'file'">Tệp AI trả về</button>
        </div>
      </header>
      <RestorePanel
        v-if="kind === 'text'"
        ref="panel"
        session-id="all"
        :analysis="analysis"
        :subject="subject ?? ''"
        :new-label="newLabel ?? 'Ẩn nội dung mới'"
        @new-text="emit('hide')"
      />
      <template v-else>
        <div class="restore-body"><RestoreIntro :subject="subject" /></div>
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
