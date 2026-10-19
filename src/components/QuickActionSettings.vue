<script setup lang="ts">
import { quickShortcutLabel, trayLabel } from "../adapters/quick-actions.ts";
import BrandMark from "./BrandMark.vue";
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
          Chọn văn bản trong ứng dụng khác rồi nhấn: văn bản thường được ẩn, câu trả lời của AI có
          mã thay thế được khôi phục, và kết quả thay ngay vào chỗ đã chọn. Không chọn gì thì phím
          tắt làm việc với clipboard.
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
    <div
      v-if="quick.desktop && quick.inputPermission.value !== 'granted'"
      class="settings-tool-row"
    >
      <div>
        <h3>Thay ngay tại chỗ</h3>
        <p id="quick-permission-help">
          {{
            quick.inputPermission.value === "unsupported"
              ? "Hệ điều hành này không cho OfflineMask gửi phím ⌘C và ⌘V thay bạn, nên kết quả nằm trong clipboard."
              : "macOS cần bạn cho phép OfflineMask gửi phím ⌘C và ⌘V thay bạn (quyền Trợ năng). Chỉ hai phím đó, chỉ khi bạn nhấn phím tắt."
          }}
        </p>
        <p v-if="quick.inputPermission.value === 'denied'" class="quick-note">
          Đã bật trong Cài đặt hệ thống mà dòng này vẫn còn? macOS đang giữ một bản cũ của ứng dụng:
          trong danh sách Trợ năng, chọn OfflineMask, bấm − để xóa, rồi bấm Cấp quyền ở đây một lần
          nữa. Dòng này tự biến mất khi quyền có hiệu lực.
        </p>
      </div>
      <button
        v-if="quick.inputPermission.value !== 'unsupported'"
        class="quiet-button"
        aria-describedby="quick-permission-help"
        @click="quick.checkInputPermission(true)"
      >
        Cấp quyền
      </button>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3>Nút nổi khi bôi đen</h3>
        <p id="quick-popover-help">
          Tắt mặc định. Khi bật, vừa chọn văn bản trong ứng dụng khác (kéo chuột hoặc ⌘A) là một nút
          tròn nhỏ hiện ngay phía trên; bấm một lần là xong. OfflineMask chỉ đọc phần đang được chọn
          ở ứng dụng phía trước, không đọc phím bạn gõ.
        </p>
        <p v-if="quick.desktop && !quick.popoverSupported.value" class="quick-note">
          Hệ này chưa hỗ trợ (Linux sẽ có sau trên X11).
        </p>
        <p v-if="quick.popoverFailure.value" class="quick-error" role="alert">
          {{ quick.popoverFailure.value }}
        </p>
        <p v-if="quick.popoverOn.value && quick.lastSkip.value" class="quick-note" role="status">
          Lần chọn gần nhất không hiện nút vì {{ quick.lastSkip.value }}.
        </p>
      </div>
      <label class="quick-toggle">
        <input
          type="checkbox"
          :checked="quick.popoverOn.value"
          :disabled="!quick.desktop || !quick.popoverSupported.value"
          aria-describedby="quick-popover-help"
          @change="quick.setPopover(($event.target as HTMLInputElement).checked)"
        />Bật
      </label>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3 id="quick-panel-title">Bảng nổi</h3>
        <p id="quick-panel-help">
          Một ô nhỏ luôn nổi trên các cửa sổ khác với hai nút
          <BrandMark :size="15" class="inline-mark" />Ẩn thông tin và
          <BrandMark variant="restore" :size="15" class="inline-mark" />Khôi phục. Kéo để đặt ở chỗ
          bạn muốn.
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
    <div class="settings-tool-row">
      <div>
        <h3>Chạy nền</h3>
        <p id="quick-launch-help">
          Đóng cửa sổ thì OfflineMask vẫn chạy để phím tắt và bảng nổi dùng được; mở lại hoặc thoát
          hẳn từ biểu tượng OfflineMask ở {{ trayLabel }}. Khởi động cùng máy mở ứng dụng ở chế độ
          nền, không hiện cửa sổ.
        </p>
        <p v-if="quick.launchFailure.value" class="quick-error" role="alert">
          {{ quick.launchFailure.value }}
        </p>
      </div>
      <label class="quick-toggle">
        <input
          type="checkbox"
          :checked="quick.launchAtLogin.value"
          :disabled="!quick.desktop"
          aria-describedby="quick-launch-help"
          @change="quick.setLaunchAtLogin(($event.target as HTMLInputElement).checked)"
        />Khởi động cùng máy
      </label>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3>Theo dõi clipboard</h3>
        <p id="quick-watch-help">
          Tắt mặc định. Khi bật, mỗi lần bạn sao chép văn bản, OfflineMask kiểm tra ngay trên máy
          bằng quy tắc có sẵn (email, số điện thoại, số tài khoản) và chỉ nhắc ở bảng nổi nếu thấy.
          Không lưu, không ghi lại, không gửi đi đâu.
        </p>
        <p v-if="quick.desktop && !quick.watchSupported.value" class="quick-note">
          Hệ này không báo khi clipboard đổi, nên chưa theo dõi được.
        </p>
        <p v-if="quick.watchFailure.value" class="quick-error" role="alert">
          {{ quick.watchFailure.value }}
        </p>
      </div>
      <label class="quick-toggle">
        <input
          type="checkbox"
          :checked="quick.watchOn.value"
          :disabled="!quick.desktop || !quick.watchSupported.value"
          aria-describedby="quick-watch-help"
          @change="quick.setClipboardWatch(($event.target as HTMLInputElement).checked)"
        />Bật
      </label>
    </div>
    <p v-if="quick.lastStatus.value" class="quick-last" role="status">
      Lần gần nhất: {{ quick.lastStatus.value.message }}
    </p>
  </section>
</template>
