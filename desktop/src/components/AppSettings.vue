<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { version } from "../../package.json";
import { openProductWebsite, productWebsite } from "../adapters/desktop.ts";
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
import { themeChoices, useTheme } from "../composables/useTheme.ts";
import { machineMemory, memoryChoice, setMemoryChoice } from "../composables/memoryBudget.ts";
import { memoryBudget, memoryChoices, memorySize } from "../core/memory.ts";

/** App-wide preferences: appearance, and the version with where to look for a newer
 * one. The app never checks by itself; the user opens the homepage (decision 0137).
 * Under "Nâng cao", folded: how much memory the app may use (decision 0173). */
const { theme, setTheme } = useTheme();
const memory = ref<number | null>(null);
const advancedOpen = memoryChoice.value !== "normal";
const chosenMemory = computed(
  () => memoryChoices.find((choice) => choice.id === memoryChoice.value) ?? memoryChoices[1]!,
);
onMounted(async () => (memory.value = await machineMemory()));
const memoryFigure = (id: (typeof memoryChoices)[number]["id"]) =>
  memorySize(memoryBudget(memory.value, id));
const websiteError = ref("");
async function visitWebsite(event: MouseEvent) {
  websiteError.value = "";
  try {
    await openProductWebsite(event);
  } catch {
    websiteError.value = "Chưa mở được trình duyệt. Bạn có thể truy cập OfflineMask.com.";
  }
}
</script>

<template>
  <section class="app-settings glass glass-card" aria-labelledby="app-title">
    <h2 id="app-title" class="app-settings-title">Ứng dụng</h2>
    <div class="settings-tool-row">
      <h3 id="theme-title">Giao diện</h3>
      <fieldset class="theme-switch" aria-labelledby="theme-title">
        <label v-for="choice in themeChoices" :key="choice.id">
          <input
            type="radio"
            name="theme"
            :value="choice.id"
            :checked="theme === choice.id"
            @change="setTheme(choice.id)"
          />{{ choice.label }}
        </label>
      </fieldset>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3>Cập nhật</h3>
        <p class="about-lockup">
          <span class="brand-mark"><BrandMark :size="14" /></span
          ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
          <span class="about-version">Phiên bản {{ version }}</span>
        </p>
        <p id="updates-policy">
          OfflineMask không tự kết nối Internet nên không tự báo bản mới. Thỉnh thoảng hãy mở
          OfflineMask.com để xem phiên bản mới nhất và so với bản {{ version }} ở trên.
        </p>
        <p v-if="websiteError" class="quick-error" role="alert">{{ websiteError }}</p>
      </div>
      <a
        class="quiet-button"
        :href="productWebsite"
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby="updates-policy"
        @click="visitWebsite"
      >
        Mở OfflineMask.com<AppIcon name="external" :size="13" />
      </a>
    </div>
    <!-- Opens by itself only when a choice other than the default is set; after that,
         only the person opens or closes it. -->
    <details class="settings-advanced" :open="advancedOpen">
      <summary>Nâng cao<AppIcon class="folder-chevron" name="chevron" :size="13" /></summary>
      <div class="settings-tool-row memory-setting">
        <div>
          <h3 id="memory-title">Bộ nhớ cho OfflineMask</h3>
          <p id="memory-hint">
            Tệp cần nhiều hơn mức này sẽ không mở, để máy không bị chậm.
            {{ chosenMemory.detail }}
          </p>
        </div>
        <fieldset
          class="theme-switch"
          aria-labelledby="memory-title"
          aria-describedby="memory-hint"
        >
          <label v-for="choice in memoryChoices" :key="choice.id">
            <input
              type="radio"
              name="memory"
              :value="choice.id"
              :checked="memoryChoice === choice.id"
              @change="setMemoryChoice(choice.id)"
            />{{ choice.label }} <span>{{ memoryFigure(choice.id) }}</span>
          </label>
        </fieldset>
      </div>
    </details>
  </section>
</template>
