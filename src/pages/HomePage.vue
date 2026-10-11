<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { desktopModels, formatModelBytes } from "../adapters/models.ts";
import AppIcon from "../components/AppIcon.vue";
import ComingSoonBadge from "../components/ComingSoonBadge.vue";
import MaskingPreview from "../components/MaskingPreview.vue";
import { packKey, useProvided, type Page } from "../composables/context.ts";
import { packProgress } from "../composables/useRecognitionPack.ts";

const emit = defineEmits<{ navigate: [destination: Page] }>();
const pack = useProvided(packKey);
const heading = useTemplateRef<HTMLHeadingElement>("heading");
defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
});

// The hero promises offline use; until the pack is installed the one-time download is said up front.
const offlineClaim = computed(() =>
  pack.ready.value || pack.status.value.stage === "checking"
    ? "Không cần Internet."
    : "Tải một lần, sau đó không cần Internet.",
);

interface PackNotice {
  icon: "check" | "download";
  title: string;
  detail?: string;
  action?: { label: string; run: () => void; needsDesktop?: boolean };
}
const packNotice = computed<PackNotice | null>(() => {
  const status = pack.status.value;
  const size = formatModelBytes(status.total);
  const download = (label: string) => ({
    label,
    run: () => void pack.run("download"),
    needsDesktop: true,
  });
  const progress = () => ({ label: "Xem tiến độ", run: () => emit("navigate", "settings") });
  switch (status.stage) {
    case "checking":
      return null;
    case "ready":
      return { icon: "check", title: "Đã sẵn sàng. Dùng không cần Internet." };
    case "downloading":
      return {
        icon: "download",
        title: `Đang tải về… ${packProgress(status)} %`,
        detail: "Chỉ cần tải một lần.",
        action: progress(),
      };
    case "installing":
    case "cancelling":
      return {
        icon: "download",
        title: `Đang cài đặt… ${packProgress(status)} %`,
        detail: "Chỉ cần tải một lần.",
        action: progress(),
      };
    case "paused":
      return {
        icon: "download",
        title: "Đã tạm dừng tải.",
        detail: "Phần đã tải được giữ lại.",
        action: download("Tiếp tục tải"),
      };
    case "error":
      return {
        icon: "download",
        title: "Chưa tải xong.",
        detail: pack.error.value || "Kiểm tra kết nối rồi thử lại.",
        action: download("Thử lại"),
      };
    default:
      return {
        icon: "download",
        title: `Lần đầu cần tải thêm ${size}, chỉ một lần.`,
        detail: pack.error.value || "Sau đó mọi thứ chạy trên máy bạn, không cần Internet.",
        action: download("Tải về"),
      };
  }
});
</script>

<template>
  <div class="introduction">
    <span class="hero-logo brand-mark" aria-hidden="true">
      <AppIcon name="mask" :size="26" />
    </span>
    <h1 ref="heading" tabindex="-1">Ẩn thông tin nhạy cảm<span>trước khi chia sẻ với AI.</span></h1>
    <p>
      Tên, số tài khoản, số điện thoại… được thay bằng mã thay thế ngay trên máy bạn.
      {{ offlineClaim }}
    </p>
    <MaskingPreview />
  </div>
  <section class="format-grid" aria-labelledby="format-heading">
    <h2 id="format-heading">Chọn nội dung để bắt đầu</h2>
    <button class="format-card glass" @click="emit('navigate', 'text')">
      <span class="format-icon"><AppIcon name="text" :size="29" /></span
      ><span class="format-title">Văn bản<AppIcon name="arrow" :size="20" /></span
      ><span class="format-description">Email, tin nhắn, hợp đồng, CV</span>
    </button>
    <button class="format-card glass" @click="emit('navigate', 'excel')">
      <span class="format-icon"><AppIcon name="table" :size="29" /></span
      ><span class="format-title">Bảng tính<AppIcon name="arrow" :size="20" /></span
      ><span class="format-description">Excel, CSV</span>
    </button>
    <div
      v-if="packNotice"
      class="pack-notice"
      :class="{ 'pack-ready': pack.ready.value }"
      role="status"
    >
      <AppIcon :name="packNotice.icon" :size="16" />
      <p>
        {{ packNotice.title }}<span v-if="packNotice.detail">{{ packNotice.detail }}</span>
      </p>
      <button
        v-if="packNotice.action"
        class="quiet-button"
        :disabled="pack.busy.value || (packNotice.action.needsDesktop && !desktopModels)"
        @click="packNotice.action.run()"
      >
        {{ packNotice.action.label }}<AppIcon name="chevron" :size="12" />
      </button>
    </div>
  </section>
  <aside class="coming-soon" aria-labelledby="upcoming-formats">
    <span id="upcoming-formats" class="upcoming-formats-label">Định dạng <ComingSoonBadge /></span>
    <ul aria-labelledby="upcoming-formats">
      <li>PDF</li>
      <li>Word</li>
      <li>Hình ảnh</li>
    </ul>
  </aside>
</template>
