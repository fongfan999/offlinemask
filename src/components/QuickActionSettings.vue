<script setup lang="ts">
import { quickShortcutLabel } from "../adapters/quick-actions.ts";
import { quickKey, useProvided } from "../composables/context.ts";

/** Clipboard quick actions (decision 0090): the shortcut and the floating panel. */
const quick = useProvided(quickKey);
</script>

<template>
  <section class="app-settings glass glass-card" aria-labelledby="quick-title">
    <h2 id="quick-title" class="app-settings-title">Thao tác nhanh</h2>
    <p class="quick-intro">
      Dùng ngay trong ứng dụng khác, không cần mở OfflineMask lên: sao chép văn bản, ẩn hoặc khôi
      phục, rồi dán. Clipboard chỉ được đọc khi bạn bấm.
    </p>
    <p v-if="!quick.desktop" class="quick-note">Chỉ có trên ứng dụng máy tính.</p>
    <div class="settings-tool-row">
      <div>
        <h3 id="quick-shortcut-title">
          Phím tắt <kbd class="quick-key">{{ quickShortcutLabel }}</kbd>
        </h3>
        <p id="quick-shortcut-help">
          Văn bản thường được ẩn; câu trả lời của AI có mã thay thế được khôi phục. Kết quả nằm
          trong clipboard, dán là xong.
        </p>
        <p v-if="quick.shortcutFailure.value" class="quick-error" role="alert">
          {{ quick.shortcutFailure.value }}
        </p>
      </div>
      <label class="quick-toggle">
        <input
          type="checkbox"
          :checked="quick.shortcutOn.value"
          :disabled="!quick.desktop"
          aria-describedby="quick-shortcut-help"
          @change="quick.setShortcut(($event.target as HTMLInputElement).checked)"
        />Bật
      </label>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3 id="quick-panel-title">Bảng nổi</h3>
        <p id="quick-panel-help">
          Một ô nhỏ luôn nổi trên các cửa sổ khác với hai nút Ẩn thông tin và Khôi phục. Kéo để đặt
          ở chỗ bạn muốn.
        </p>
      </div>
      <label class="quick-toggle">
        <input
          type="checkbox"
          :checked="quick.pinned.value"
          :disabled="!quick.desktop"
          aria-describedby="quick-panel-help"
          @change="quick.setPinned(($event.target as HTMLInputElement).checked)"
        />Hiện
      </label>
    </div>
    <p v-if="quick.lastStatus.value" class="quick-last" role="status">
      Lần gần nhất: {{ quick.lastStatus.value.message }}
    </p>
  </section>
</template>
