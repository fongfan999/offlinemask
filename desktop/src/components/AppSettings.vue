<script setup lang="ts">
import { version } from "../../package.json";
import BrandMark from "./BrandMark.vue";
import ComingSoonBadge from "./ComingSoonBadge.vue";
import { themeChoices, useTheme } from "../composables/useTheme.ts";

/** App-wide preferences: appearance, updates and the version they refer to. */
const { theme, setTheme } = useTheme();
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
        <h3>Cập nhật <ComingSoonBadge /></h3>
        <p class="about-lockup">
          <span class="brand-mark"><BrandMark :size="14" /></span
          ><span class="brand-name">Offline<span class="brand-accent">Mask</span></span>
          <span class="about-version">Phiên bản {{ version }}</span>
        </p>
        <p id="updates-policy">
          OfflineMask không tự kết nối Internet; bạn chủ động kiểm tra bản mới cho ứng dụng và gói
          nhận diện.
        </p>
      </div>
      <!-- One future, explicitly initiated check for all supported update types.
           Do not attach update requests to mounting, polling, or navigation. -->
      <button class="quiet-button" disabled aria-describedby="updates-policy">
        Kiểm tra cập nhật
      </button>
    </div>
  </section>
</template>
