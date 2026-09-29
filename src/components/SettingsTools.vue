<script setup lang="ts">
import ComingSoonBadge from "./ComingSoonBadge.vue";
</script>

<template>
  <section class="settings-tools" aria-label="Cập nhật và cài đặt">
    <div class="settings-tool-row">
      <div>
        <h2>Cập nhật <ComingSoonBadge /></h2>
        <p id="updates-policy">OfflineMask không tự kiểm tra qua Internet.</p>
        <p id="updates-scope">Bạn chủ động kiểm tra bản mới cho ứng dụng và gói nhận diện.</p>
      </div>
      <!-- One future, explicitly initiated check for all supported update types.
           Do not attach update requests to mounting, polling, or navigation. -->
      <button class="quiet-button" disabled aria-describedby="updates-policy updates-scope">Kiểm tra cập nhật</button>
    </div>
    <details class="offline-install">
      <summary>Cài từ tệp <ComingSoonBadge /></summary>
      <div class="settings-tool-row">
        <p id="offline-install-hint">Tải gói trên <span class="placeholder-link" role="link" aria-disabled="true" aria-label="offlinemask.com — trang tải gói sắp có">offlinemask.com</span>, rồi chọn tệp để cài.</p>
        <!-- The download page and file installer are placeholders until available. -->
        <button class="quiet-button" disabled aria-describedby="offline-install-hint">Chọn tệp</button>
      </div>
    </details>
  </section>
</template>
