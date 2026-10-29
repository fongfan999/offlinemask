<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/** A file or folder with nothing to hide, or one that cannot open: one card in place of the
 * page, and one way on, home to start over (decision 0172). */
defineProps<{ icon: string; title: string; button: string }>();
const emit = defineEmits<{ again: [] }>();
</script>

<template>
  <div class="cannot-open" role="alert">
    <AppIcon :name="icon" :size="28" />
    <h2>{{ title }}</h2>
    <p><slot /></p>
    <button class="primary-action" @click="emit('again')">
      <AppIcon name="upload" :size="17" />{{ button }}
    </button>
  </div>
</template>
