<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";

/** A file or folder with nothing to hide, or one that cannot open: one card in place of the
 * page, and one way on, home to start over (decision 0172). */
const props = defineProps<{ icon: string; title: string; detail: string; button: string }>();
const emit = defineEmits<{ again: [] }>();

/** What the eye should catch in the reason: sizes ("2,8 GB") and where to change the
 * setting ("Cài đặt › Nâng cao"). Odd parts are the highlighted ones. */
const highlight = /(\d+(?:,\d+)? [GM]B|Cài đặt › Nâng cao)/;
const parts = computed(() => props.detail.split(highlight));
</script>

<template>
  <div class="cannot-open" role="alert">
    <AppIcon :name="icon" :size="28" />
    <h2>{{ title }}</h2>
    <p>
      <template v-for="(part, index) in parts" :key="index"
        ><strong v-if="index % 2">{{ part }}</strong
        ><template v-else>{{ part }}</template></template
      >
    </p>
    <button class="primary-action" @click="emit('again')">
      <AppIcon name="upload" :size="17" />{{ button }}
    </button>
  </div>
</template>
