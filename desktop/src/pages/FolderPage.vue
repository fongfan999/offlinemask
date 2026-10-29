<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import type { PickedFolder } from "../adapters/folder.ts";
import AppIcon from "../components/AppIcon.vue";
import BrandMark from "../components/BrandMark.vue";
import FileDropZone from "../components/FileDropZone.vue";
import MaskProgress from "../components/MaskProgress.vue";
import ReviewList from "../components/ReviewList.vue";
import SheetPreview from "../components/SheetPreview.vue";
import { folderKey, packKey, useProvided } from "../composables/context.ts";
import { roughDuration, maxFolderFiles } from "../core/folder.ts";

/** A whole folder (decision 0171): what it holds and how long it will take, column
 * choices per spreadsheet layout, one run, one review of the folder's values, and a
 * mirrored folder of masked copies. */
const folder = useProvided(folderKey);
const pack = useProvided(packKey);
const heading = useTemplateRef<HTMLHeadingElement>("heading");
const primary = useTemplateRef<HTMLButtonElement>("primary");
const saveError = ref("");
const shownFiles = 200;

const phase = folder.phase;
const count = (n: number) => n.toLocaleString("vi-VN");
const docs = computed(() => folder.readable.value.filter((file) => file.kind === "word").length);
const sheets = computed(() => folder.readable.value.length - docs.value);
const subtitle = computed(() => {
  if (phase.value === "empty")
    return "Kéo thả một thư mục để ẩn mọi tài liệu và bảng tính trong đó.";
  const parts = [`${count(folder.files.value.length)} tệp`];
  if (docs.value) parts.push(`${count(docs.value)} tài liệu`);
  if (sheets.value) parts.push(`${count(sheets.value)} bảng tính`);
  return parts.join(" · ");
});
const surveyed = computed(
  () => folder.files.value.filter((file) => !["waiting", "reading"].includes(file.status)).length,
);
const duration = computed(() => roughDuration(folder.estimate.value));
const hidden = computed(() => folder.masked.value.reduce((sum, file) => sum + file.masked, 0));
const aliases = computed(() =>
  folder.review.value.reduce((sum, group) => sum + group.items.length, 0),
);
const statusLabel: Record<string, string> = {
  waiting: "Chờ",
  reading: "Đang đọc",
  ready: "Sẵn sàng",
  masking: "Đang ẩn",
  masked: "Đã ẩn",
  saved: "Đã lưu",
  failed: "Lỗi",
};
const planSummary = (plans: readonly { mode: string }[]) => {
  const hide = plans.filter((plan) => plan.mode === "hide").length;
  const scan = plans.filter((plan) => plan.mode === "scan").length;
  const keep = plans.length - hide - scan;
  return `Ẩn ${hide} cột · quét ${scan} cột · giữ ${keep} cột`;
};

async function open(picked: PickedFolder) {
  saveError.value = "";
  await folder.load(picked);
}
async function save() {
  saveError.value = "";
  try {
    await folder.save();
  } catch {
    saveError.value = "Chưa lưu được thư mục. Hãy chọn nơi lưu khác rồi thử lại.";
    if (folder.phase.value === "saving") folder.phase.value = "review";
  }
}

defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
  focusResult() {
    primary.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="editor-heading">
    <div>
      <h1 ref="heading" tabindex="-1">{{ folder.name.value || "Ẩn cả thư mục" }}</h1>
      <p>{{ subtitle }}</p>
    </div>
    <div v-if="phase !== 'empty' && !folder.busy.value" class="editor-actions">
      <button class="quiet-button" @click="folder.reset()">
        <AppIcon name="upload" :size="15" />Chọn thư mục khác
      </button>
    </div>
  </div>
  <section class="glass-card glass" aria-label="Ẩn thông tin trong thư mục">
    <!-- Pick a folder. -->
    <div v-if="phase === 'empty'" class="step-panel">
      <FileDropZone
        icon="upload"
        title="Kéo thả thư mục vào đây"
        hint="Word, PDF, Excel, CSV, TXT bên trong"
        accept=".docx,.odt,.pdf,.txt,.md,.xlsx,.xls,.ods,.csv"
        folders
        directory
        @folder="open"
      />
    </div>

    <!-- Read each file once to size the work. -->
    <div v-else-if="phase === 'surveying'" class="step-panel">
      <p class="sheet-caption-line opening-progress" role="status">
        <span class="spinner" aria-hidden="true"></span>Đang đọc thư mục {{ count(surveyed) }} /
        {{ count(folder.files.value.length) }} tệp
        <button type="button" class="quiet-button" @click="folder.cancel()">Hủy</button>
      </p>
    </div>

    <template v-else>
      <div class="step-panel">
        <!-- What the folder holds, how long it takes, and column choices. -->
        <template v-if="phase === 'ready'">
          <div v-if="folder.dedicated.value" class="folder-warning" role="note">
            <strong>Thư mục này khá lớn</strong>
            <p>
              {{ count(folder.readable.value.length) }} tệp, cần {{ duration }} trên máy này. Bạn
              vẫn có thể bắt đầu, máy sẽ chậm hơn trong lúc xử lý.
            </p>
            <p>
              Nếu thường xuyên cần ẩn nhiều tài liệu, bạn có thể dành riêng một máy chạy OfflineMask
              cho công việc hoặc cho cả công ty, để máy làm việc của bạn không bị ảnh hưởng.
            </p>
          </div>
          <p v-else-if="folder.readable.value.length" class="sheet-summary">
            <AppIcon name="info" :size="15" />Cần {{ duration }} trên máy này.
          </p>
          <p v-if="folder.overflow.value" class="sheet-note">
            <AppIcon name="info" :size="14" />Thư mục có hơn {{ count(maxFolderFiles) }} tệp; lần
            này chỉ ẩn {{ count(maxFolderFiles) }} tệp đầu. Hãy chia nhỏ thư mục cho phần còn lại.
          </p>
          <p v-if="!pack.ready.value" class="sheet-note">
            <AppIcon name="info" :size="14" />Đang tìm email, số điện thoại, số tài khoản. Tải gói
            nhận diện để tìm cả họ tên và địa chỉ.
          </p>

          <section v-if="folder.layouts.value.length" class="folder-layouts">
            <p class="sheet-hint">
              Bảng tính cùng tiêu đề cột được gộp làm một. Chọn cách xử lý từng cột, áp dụng cho mọi
              tệp cùng kiểu.
            </p>
            <details
              v-for="(layout, index) in folder.layouts.value"
              :key="layout.key"
              class="folder-layout"
              :open="folder.layouts.value.length === 1"
            >
              <summary>
                <strong>Kiểu bảng {{ index + 1 }}</strong>
                <span>{{ count(layout.sheets) }} trang · {{ planSummary(layout.plans) }}</span>
              </summary>
              <SheetPreview
                :header="layout.header"
                :rows="layout.sample"
                :plans="layout.plans"
                :label="`Kiểu bảng ${index + 1}, ví dụ ${layout.example}`"
                @plan="(column, plan) => folder.setPlan(layout.key, column, plan)"
              />
              <p class="sheet-caption-line">Ví dụ: {{ layout.example }}</p>
            </details>
          </section>
        </template>

        <MaskProgress
          v-if="phase === 'masking' && folder.progress.value"
          :progress="folder.progress.value"
        />
        <p
          v-if="phase === 'saving' && folder.progress.value"
          class="sheet-caption-line"
          role="status"
        >
          <span class="spinner" aria-hidden="true"></span>Đang lưu
          {{ count(folder.progress.value.done) }} / {{ count(folder.progress.value.total) }} tệp
        </p>

        <!-- The folder's values, once. -->
        <template v-if="phase === 'review' || phase === 'saved'">
          <p class="sheet-summary">
            <AppIcon name="check" :size="15" />Đã ẩn {{ count(hidden) }} chỗ trong
            {{ count(folder.masked.value.length) }} tệp · {{ count(aliases) }} mã thay thế, dùng
            chung cho cả thư mục
          </p>
          <p v-if="phase === 'saved'" class="sheet-summary" role="status">
            <AppIcon name="check" :size="15" />Đã lưu vào thư mục “{{ folder.saveTarget.value }}”.
            Tệp gốc không bị thay đổi.
          </p>
          <ReviewList
            v-if="folder.review.value.length && phase === 'review'"
            :groups="folder.review.value"
            :files="folder.fileCounts.value"
            @change="folder.setKept"
          />
        </template>

        <details v-if="folder.failed.value.length" class="folder-files" open>
          <summary>{{ count(folder.failed.value.length) }} tệp chưa xử lý được</summary>
          <ul>
            <li v-for="file in folder.failed.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ file.error }}</span>
            </li>
          </ul>
        </details>
        <details v-if="folder.skipped.value.length" class="folder-files">
          <summary>{{ count(folder.skipped.value.length) }} tệp bỏ qua</summary>
          <ul>
            <li v-for="file in folder.skipped.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ file.reason }}</span>
            </li>
          </ul>
        </details>
        <details v-if="folder.files.value.length" class="folder-files">
          <summary>Danh sách tệp</summary>
          <ul>
            <li v-for="file in folder.files.value.slice(0, shownFiles)" :key="file.path">
              <span class="folder-path">{{ file.path }}</span
              ><span class="folder-reason">{{ statusLabel[file.status] }}</span>
            </li>
            <li v-if="folder.files.value.length > shownFiles" class="folder-reason">
              và {{ count(folder.files.value.length - shownFiles) }} tệp khác
            </li>
          </ul>
        </details>
        <p v-if="saveError" class="input-error drop-error" role="alert">{{ saveError }}</p>

        <footer class="card-footer sheet-footer">
          <span class="action-hint">Thư mục gốc không bị thay đổi.</span>
          <button v-if="phase === 'masking'" class="quiet-button" @click="folder.cancel()">
            Hủy
          </button>
          <button
            v-if="phase === 'ready' || phase === 'masking'"
            ref="primary"
            class="primary-action"
            :disabled="phase === 'masking' || !folder.readable.value.length"
            @click="folder.maskAll()"
          >
            <span v-if="phase === 'masking'" class="spinner" aria-hidden="true"></span
            ><BrandMark v-else :size="17" />{{
              phase === "masking" ? "Đang ẩn…" : `Ẩn ${count(folder.readable.value.length)} tệp`
            }}<AppIcon name="arrow" :size="16" />
          </button>
          <button
            v-else-if="folder.masked.value.length"
            ref="primary"
            class="primary-action"
            :disabled="phase === 'saving'"
            @click="save"
          >
            <span v-if="phase === 'saving'" class="spinner" aria-hidden="true"></span
            ><AppIcon v-else name="download" :size="17" />{{
              phase === "saved" ? "Lưu thêm một bản" : "Lưu thư mục đã ẩn"
            }}<AppIcon name="arrow" :size="16" />
          </button>
        </footer>
      </div>
    </template>
  </section>
</template>
