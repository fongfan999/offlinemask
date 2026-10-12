<script setup lang="ts">
import { themeChoices, useTheme } from "../composables/useTheme.ts";

const { theme, setTheme } = useTheme();
</script>

<template>
  <section class="settings-tools theme-settings" aria-labelledby="theme-title">
    <div class="settings-tool-row">
      <div>
        <h2 id="theme-title">Giao diện</h2>
        <p>Tự động theo chế độ sáng hoặc tối của máy.</p>
      </div>
      <fieldset class="theme-switch">
        <legend class="sr-only">Chọn giao diện</legend>
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
  </section>
</template>
