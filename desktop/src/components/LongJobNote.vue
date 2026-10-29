<script setup lang="ts">
import { computed } from "vue";
import { dedicatedMachineSeconds, roughDuration } from "../core/folder.ts";

/** Over an hour on this machine (decision 0173), the same note for a text, a file and a
 * folder: it can still start, and a machine kept for OfflineMask suits regular big jobs. */
const props = defineProps<{ seconds: number; subject: string }>();
const shown = computed(() => props.seconds > dedicatedMachineSeconds);
</script>

<template>
  <div v-if="shown" class="folder-warning" role="note">
    <strong>{{ subject }} khá lớn</strong>
    <p>
      Cần {{ roughDuration(seconds) }} trên máy này. Bạn vẫn có thể bắt đầu, máy sẽ chậm hơn trong
      lúc xử lý.
    </p>
    <p>
      Nếu thường xuyên cần ẩn nhiều tài liệu, bạn có thể dành riêng một máy chạy OfflineMask cho
      công việc hoặc cho cả công ty, để máy làm việc của bạn không bị ảnh hưởng.
    </p>
  </div>
</template>
