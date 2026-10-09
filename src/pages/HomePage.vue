<script setup lang="ts">
import { useTemplateRef } from "vue";
import AppIcon from "../components/AppIcon.vue";
import ComingSoonBadge from "../components/ComingSoonBadge.vue";
import MaskingPreview from "../components/MaskingPreview.vue";
import type { Format } from "../core/sessions.ts";

const emit = defineEmits<{ navigate: [destination: Format] }>();
const heading = useTemplateRef<HTMLHeadingElement>("heading");
defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="introduction">
    <span class="hero-logo brand-mark" aria-hidden="true">
      <AppIcon name="mask" :size="26" />
    </span>
    <h1 ref="heading" tabindex="-1">Ẩn thông tin nhạy cảm<span>trước khi chia sẻ với AI.</span></h1>
    <p>
      Tên, số tài khoản, số điện thoại… được thay bằng bí danh ngay trên máy bạn. Không cần
      Internet.
    </p>
    <MaskingPreview />
  </div>
  <section class="format-grid" aria-labelledby="format-heading">
    <h2 id="format-heading">Chọn nội dung để bắt đầu</h2>
    <button class="format-card glass" @click="emit('navigate', 'text')">
      <span class="format-icon"><AppIcon name="text" :size="29" /></span
      ><span class="format-title">Văn bản<AppIcon name="arrow" :size="20" /></span
      ><span class="format-description">Email, tin nhắn, tài liệu</span>
    </button>
    <button class="format-card glass" @click="emit('navigate', 'excel')">
      <span class="format-icon"><AppIcon name="table" :size="29" /></span
      ><span class="format-title">Bảng tính<AppIcon name="arrow" :size="20" /></span
      ><span class="format-description">Excel, CSV</span>
    </button>
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
