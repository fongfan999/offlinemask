<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import BrandMascot from "./BrandMascot.vue";

/** A file or folder with nothing to hide, or one that cannot open: one card in place of the
 * page, and one way on, home to start over (decision 0172). The mascot tilts its head at it
 * (decision 0175). */
const props = defineProps<{ title: string; detail: string; button: string }>();
const emit = defineEmits<{ again: [] }>();

/** What the eye should catch in the reason: sizes ("2,8 GB"). Odd parts are highlighted. */
const highlight = /(\d+(?:,\d+)? [GM]B)/;
const parts = computed(() => props.detail.split(highlight));
</script>

<template>
  <div class="cannot-open" role="alert">
    <BrandMascot class="cannot-open-mascot" :size="72" />
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
