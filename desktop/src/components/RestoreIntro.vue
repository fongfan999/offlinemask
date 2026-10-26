<script setup lang="ts">
import BrandMark from "./BrandMark.vue";

/** The restore step's one line, the same above a pasted reply and a returned file;
 * what to do sits in the box itself (placeholder, drop zone). */
defineProps<{ subject: string }>();
</script>

<template>
  <p class="restore-intro">
    <BrandMark variant="restore" :size="16" class="inline-mark" />Mã thay thế của {{ subject }} này
    được đổi lại thành thông tin thật, ngay trên máy bạn.
  </p>
</template>
