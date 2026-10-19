<script setup lang="ts">
// A looping illustration of Ẩn nhanh (decision 0098): text in another app is
// selected, the OfflineMask button appears beside it, a click hides the values in
// place. Pure CSS on sample text; with reduced motion it holds the moment before
// the click. Nothing here reads or shows the user's own data.
import AppIcon from "./AppIcon.vue";
import BrandMark from "./BrandMark.vue";
</script>

<template>
  <figure
    class="quick-demo"
    role="img"
    aria-label="Minh họa: bôi đen chữ trong ứng dụng khác, bấm nút OfflineMask, thông tin được ẩn ngay tại chỗ"
  >
    <div class="qd-window" aria-hidden="true">
      <div class="qd-bar"><i></i><i></i><i></i><span>Ứng dụng bất kỳ</span></div>
      <p class="qd-line">
        Tóm tắt giúp tôi:<br />
        khách
        <span class="qd-sel"
          ><span class="qd-before">Nguyễn Văn An, số 0901 234 567</span
          ><span class="qd-after"><b>[TEN_1_3030]</b>, số <b>[SDT_1_4821]</b></span
          ><span class="qd-dot"
            ><BrandMark class="qd-mark" :size="17" /><AppIcon
              class="qd-check"
              name="check"
              :size="16" /></span
          ><svg class="qd-pointer" width="16" height="20" viewBox="0 0 16 20">
            <path d="M1 1v15l4-4 3 7 3-1.4-3-6.6h6z" /></svg
        ></span>
      </p>
    </div>
  </figure>
</template>
