<script setup lang="ts">
import { quickShortcutLabel, trayLabel } from "../adapters/quick-actions.ts";
import { quickKey, useProvided } from "../composables/context.ts";

/** Quick actions (decisions 0090 to 0096): the shortcut, the circle and the clipboard watch. */
const quick = useProvided(quickKey);
</script>

<template>
  <section class="app-settings glass glass-card" aria-labelledby="quick-title">
    <h2 id="quick-title" class="app-settings-title">Thao tác nhanh</h2>
    <p class="quick-intro">
      Bôi đen văn bản trong ứng dụng khác là có một nút tròn nhỏ để ẩn hoặc khôi phục thông tin ngay
      tại chỗ, không cần mở OfflineMask. Chỉ phần bạn đang chọn được đọc, không đọc phím bạn gõ.
    </p>
    <p v-if="!quick.desktop" class="quick-note">Chỉ có trên ứng dụng máy tính.</p>

    <!-- Step one: the permission. The circle and its shortcut only exist once granted. -->
    <div
      v-if="quick.desktop && quick.inputPermission.value !== 'granted'"
      class="settings-tool-row"
    >
      <div>
        <h3>Cho phép đọc phần bạn chọn</h3>
        <p id="quick-permission-help">
          {{
            quick.inputPermission.value === "unsupported"
              ? "Hệ điều hành này không cho OfflineMask đọc phần bạn chọn trong ứng dụng khác."
              : "macOS cần bạn cho phép OfflineMask (quyền Trợ năng) để đọc phần bạn bôi đen và thay kết quả vào chỗ đó. Chỉ khi bạn bôi đen hoặc nhấn phím tắt."
          }}
        </p>
        <p v-if="quick.inputPermission.value === 'denied'" class="quick-note">
          Đã bật trong Cài đặt hệ thống mà dòng này vẫn còn? Trong danh sách Trợ năng, chọn
          OfflineMask, bấm − để xóa, rồi bấm Cấp quyền ở đây một lần nữa. Dòng này tự biến mất khi
          quyền có hiệu lực.
        </p>
      </div>
      <button
        v-if="quick.inputPermission.value !== 'unsupported'"
        class="primary-action quick-grant"
        aria-describedby="quick-permission-help"
        @click="quick.checkInputPermission(true)"
      >
        Cấp quyền
      </button>
    </div>

    <template v-if="quick.desktop && quick.inputPermission.value === 'granted'">
      <div class="settings-tool-row">
        <div>
          <h3 id="quick-popover-title">Nút tròn khi bôi đen</h3>
          <p id="quick-popover-help">
            Kéo chuột hoặc ⌘A để chọn: nút tròn hiện cạnh phần đã chọn, bấm một lần là xong. Ô nhập
            được thay ngay tại chỗ; văn bản chỉ đọc mở bản xem trước để sao chép.
          </p>
          <p v-if="!quick.popoverSupported.value" class="quick-note">
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
            class="app-switch"
            role="switch"
            aria-labelledby="quick-popover-title"
            :checked="quick.popoverOn.value"
            :disabled="!quick.popoverSupported.value"
            aria-describedby="quick-popover-help"
            @change="quick.setPopover(($event.target as HTMLInputElement).checked)"
          />
        </label>
      </div>
      <!-- The shortcut is the circle's click from the keyboard: a sub-option of it. -->
      <div class="settings-tool-row quick-sub" :class="{ 'is-off': !quick.popoverOn.value }">
        <div>
          <h3 id="quick-shortcut-title">
            Phím tắt <kbd class="quick-key">{{ quickShortcutLabel }}</kbd>
          </h3>
          <p id="quick-shortcut-help">
            Giống bấm nút tròn, không cần chờ nút hiện.<template v-if="!quick.popoverOn.value">
              Bật nút tròn ở trên để dùng.</template
            >
          </p>
          <p v-if="quick.shortcutFailure.value" class="quick-error" role="alert">
            {{ quick.shortcutFailure.value }}
          </p>
        </div>
        <label class="quick-toggle">
          <input
            type="checkbox"
            class="app-switch"
            role="switch"
            aria-labelledby="quick-shortcut-title"
            :checked="quick.shortcutOn.value"
            :disabled="!quick.popoverOn.value"
            aria-describedby="quick-shortcut-help"
            @change="quick.setShortcut(($event.target as HTMLInputElement).checked)"
          />
        </label>
      </div>
    </template>

    <div class="settings-tool-row">
      <div>
        <h3 id="quick-launch-title">Chạy nền</h3>
        <p id="quick-launch-help">
          Đóng cửa sổ thì OfflineMask vẫn chạy để phím tắt và nút tròn dùng được; mở lại hoặc thoát
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
          class="app-switch"
          role="switch"
          :checked="quick.launchAtLogin.value"
          :disabled="!quick.desktop"
          aria-describedby="quick-launch-help"
          @change="quick.setLaunchAtLogin(($event.target as HTMLInputElement).checked)"
        />Khởi động cùng máy
      </label>
    </div>
    <div class="settings-tool-row">
      <div>
        <h3 id="quick-watch-title">Theo dõi clipboard</h3>
        <p id="quick-watch-help">
          Tắt mặc định. Khi bật, mỗi lần bạn sao chép văn bản, OfflineMask kiểm tra ngay trên máy
          bằng quy tắc có sẵn (email, số điện thoại, số tài khoản) và chỉ nhắc ở góc màn hình nếu
          thấy. Không lưu, không ghi lại, không gửi đi đâu.
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
          class="app-switch"
          role="switch"
          aria-labelledby="quick-watch-title"
          :checked="quick.watchOn.value"
          :disabled="!quick.desktop || !quick.watchSupported.value"
          aria-describedby="quick-watch-help"
          @change="quick.setClipboardWatch(($event.target as HTMLInputElement).checked)"
        />
      </label>
    </div>
    <p v-if="quick.lastStatus.value" class="quick-last" role="status">
      Lần gần nhất: {{ quick.lastStatus.value.message }}
    </p>
  </section>
</template>
