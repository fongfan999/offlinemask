<script setup lang="ts">
// The one-time Ẩn nhanh suggestion (decision 0098), shown under the result after
// the first masked copy, in the same note style as the passcode offer: what the feature does, a sentence before macOS's permission
// dialog, a wait for the grant, and a short confirmation that fades on its own.
import { nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue";
import { quickKey, useProvided } from "../composables/context.ts";
import BrandMark from "./BrandMark.vue";
import QuickDemo from "./QuickDemo.vue";

const quick = useProvided(quickKey);
const card = useTemplateRef<HTMLElement>("card");
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => quick.introStage.value,
  (stage) => {
    clearTimeout(timer);
    // It opens under the copy button, often below the fold: bring it into view,
    // instantly. With a smooth scroll here the macOS webview stopped taking clicks
    // until reloaded (decision 0098).
    if (stage === "offer") void nextTick(() => card.value?.scrollIntoView({ block: "nearest" }));
    if (stage === "done") timer = setTimeout(() => quick.dismissIntro(), 8000);
  },
  // Mounted together with the copy confirmation, already on "offer".
  { immediate: true },
);
onBeforeUnmount(() => {
  clearTimeout(timer);
  quick.closeIntro();
});
</script>

<template>
  <Transition name="quick-intro-fade">
    <section
      v-if="quick.introStage.value"
      ref="card"
      class="quick-intro-card"
      :class="{ 'has-demo': quick.introStage.value === 'offer' }"
      aria-labelledby="quick-intro-title"
    >
      <BrandMark class="quick-intro-mark" :size="20" />
      <div class="quick-intro-body">
        <template v-if="quick.introStage.value === 'offer'">
          <strong id="quick-intro-title">Lần sau, không cần dán vào đây</strong>
          <span>Bôi đen chữ trong ChatGPT, Claude hay Gemini, bấm nút OfflineMask là xong.</span>
          <div class="quick-intro-actions">
            <button class="quiet-button" @click="quick.dismissIntro()">Để sau</button>
            <button class="quiet-button accent" @click="quick.startIntro()">Bật Ẩn nhanh</button>
          </div>
        </template>
        <template v-else-if="quick.introStage.value === 'prime'">
          <strong id="quick-intro-title">Bật Ẩn nhanh</strong>
          <span>
            macOS sẽ hỏi quyền Trợ năng. OfflineMask chỉ dùng quyền này để đọc chữ bạn bôi đen và
            đặt kết quả vào đó, không gửi đi đâu.
          </span>
          <div class="quick-intro-actions">
            <button class="quiet-button" @click="quick.dismissIntro()">Để sau</button>
            <button class="quiet-button accent" @click="quick.grantAndEnable()">Tiếp tục</button>
          </div>
        </template>
        <template v-else-if="quick.introStage.value === 'waiting'">
          <strong id="quick-intro-title">Bật Ẩn nhanh</strong>
          <span role="status">
            Trong Cài đặt hệ thống > Trợ năng, bật OfflineMask rồi quay lại đây. Ẩn nhanh sẽ tự bật.
          </span>
          <div class="quick-intro-actions">
            <button class="quiet-button" @click="quick.dismissIntro()">Để sau</button>
          </div>
        </template>
        <template v-else>
          <strong id="quick-intro-title">Đã bật Ẩn nhanh</strong>
          <span role="status">Thử bôi đen một đoạn trong ChatGPT hay Claude.</span>
          <div class="quick-intro-actions">
            <button class="quiet-button" @click="quick.dismissIntro()">Đóng</button>
          </div>
        </template>
      </div>
      <QuickDemo v-if="quick.introStage.value === 'offer'" class="is-compact" />
    </section>
  </Transition>
</template>
