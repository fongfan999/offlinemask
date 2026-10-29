<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { longJobSeconds, roughDuration } from "../core/folder.ts";

/** Over ten minutes on this machine (decision 0173), the same note for a text, a file and a
 * folder: it can still start, and a machine kept for OfflineMask suits regular big jobs. */
const props = defineProps<{ seconds: number; subject: string }>();
const shown = computed(() => props.seconds > longJobSeconds);
</script>

<template>
  <!-- One line with the time set apart; the suggestion opens on a click. -->
  <details v-if="shown" class="long-job-note">
    <summary>
      <AppIcon name="clock" :size="16" /><span
        ><strong>{{ subject }} khá lớn</strong>, cần
        <b class="long-job-time">{{ roughDuration(seconds) }}</b> trên máy này</span
      ><AppIcon class="folder-chevron" name="chevron" :size="14" />
    </summary>
    <p>
      <strong>Gợi ý</strong><br />Nếu thường xuyên cần ẩn nhiều tài liệu, hãy dành riêng một máy
      chạy OfflineMask cho công việc hoặc cho cả công ty, để máy làm việc của bạn không bị ảnh
      hưởng.
    </p>
  </details>
</template>
