<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { roughDuration } from "../core/folder.ts";

/** How long the job will take, beside the button that starts it (decision 0173). */
const props = defineProps<{ seconds: number }>();
const text = computed(() => {
  const value = roughDuration(props.seconds);
  return value.charAt(0).toUpperCase() + value.slice(1);
});
</script>

<template>
  <span class="action-hint"
    ><AppIcon name="clock" :size="14" />{{ text }} trên máy này<slot
  /></span>
</template>
