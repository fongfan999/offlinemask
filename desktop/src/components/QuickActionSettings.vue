<script setup lang="ts">
import { computed, ref } from "vue";
import { quickShortcutLabel, trayLabel } from "../adapters/quick-actions.ts";
import { quickKey, useProvided } from "../composables/context.ts";
import AppIcon from "./AppIcon.vue";
import QuickDemo from "./QuickDemo.vue";

/** Quick actions (decisions 0090 to 0097): the circle, its shortcut and the start at login. */
const quick = useProvided(quickKey);
/** The stale-grant advice is only for someone who already pressed Cấp quyền. */
const asked = ref(false);
function grant() {
  asked.value = true;
  void quick.grantAndEnable();
}
/** Where the circle shows by itself (decision 0135), always in view as two groups of
 * chips, apps and sites, each removable (decision 0136). Sites show their host. */
const placeGroups = computed(() =>
  [
    { label: "Ứng dụng", places: quick.places.value.filter((place) => place.kind === "app") },
    { label: "Trang web", places: quick.places.value.filter((place) => place.kind === "host") },
  ].filter((group) => group.places.length),
);
</script>

<template>
  <section class="app-settings glass glass-card" aria-labelledby="quick-title">
    <!-- What it is, said once, with the illustration beside it (decision 0098). It stays
         in every state so the card never changes height when the permission arrives. -->
    <div class="quick-head">
      <div>
        <h2 id="quick-title" class="app-settings-title">Thao tác nhanh</h2>
        <p class="quick-lead">
          Bôi đen chữ trong
          {{ quick.placesSupported.value ? "ChatGPT, Claude hay Gemini" : "ứng dụng bất kỳ" }}, bấm
          nút OfflineMask để ẩn hoặc khôi phục ngay tại chỗ.
        </p>
        <p class="quick-intro">Chỉ đọc chữ bạn bôi đen, xử lý trên máy này.</p>
      </div>
      <QuickDemo class="is-compact" />
    </div>
    <p v-if="!quick.desktop" class="quick-note">Chỉ có trên ứng dụng máy tính.</p>

    <!-- Step one: the permission. The circle and its shortcut only exist once granted. -->
    <div
      v-if="quick.desktop && quick.inputPermission.value !== 'granted'"
      class="settings-tool-row"
    >
      <div>
        <h3>Ẩn nhanh khi bôi đen</h3>
        <p id="quick-permission-help">
          {{
            quick.inputPermission.value === "unsupported"
              ? "Hệ điều hành này chưa hỗ trợ."
              : "Cần quyền Trợ năng của macOS để đọc chữ bạn bôi đen."
          }}
        </p>
        <p v-if="asked && quick.inputPermission.value === 'denied'" class="quick-note">
          Đã cấp mà vẫn thấy dòng này? Xóa OfflineMask khỏi danh sách Trợ năng rồi cấp lại.
        </p>
      </div>
      <button
        v-if="quick.inputPermission.value !== 'unsupported'"
        class="primary-action quick-grant"
        aria-describedby="quick-permission-help"
        @click="grant"
      >
        Cấp quyền
      </button>
    </div>

    <template v-if="quick.desktop && quick.inputPermission.value === 'granted'">
      <div class="settings-tool-row">
        <div>
          <h3 id="quick-popover-title">Ẩn nhanh khi bôi đen</h3>
          <p id="quick-popover-help">
            Ô nhập được thay ngay; chữ không sửa được thì hiện bản xem trước để sao chép.
          </p>
          <p v-if="quick.quickReady.value && !quick.lastSkip.value" class="quick-ready">
            Đang bật · thử bôi đen một đoạn trong
            {{ quick.placesSupported.value ? "ChatGPT hay Claude" : "ứng dụng khác" }}.
          </p>
          <p v-if="!quick.popoverSupported.value" class="quick-note">
            Hệ điều hành này chưa hỗ trợ.
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
            {{
              quick.popoverOn.value
                ? "Bôi đen rồi nhấn phím tắt, thay cho bấm nút."
                : "Bật Ẩn nhanh ở trên để dùng."
            }}
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
            :checked="quick.shortcutOn.value && quick.popoverOn.value"
            :disabled="!quick.popoverOn.value"
            aria-describedby="quick-shortcut-help"
            @change="quick.setShortcut(($event.target as HTMLInputElement).checked)"
          />
        </label>
      </div>
      <!-- Where the circle shows by itself, always in view: the list is what the setting
           means, so it is not behind a link (decision 0136). -->
      <div
        v-if="quick.placesSupported.value"
        class="settings-tool-row quick-sub quick-places-row"
        :class="{ 'is-off': !quick.popoverOn.value }"
      >
        <div>
          <h3 id="quick-places-title">Nơi nút tự hiện</h3>
          <p id="quick-places-help">
            Các ứng dụng và trang AI dưới đây. Ở nơi khác, nhấn {{ quickShortcutLabel }} để dùng.
          </p>
          <template v-for="group in placeGroups" :key="group.label">
            <p class="quick-places-label">{{ group.label }}</p>
            <ul class="quick-places" :aria-label="`${group.label} có nút OfflineMask`">
              <li
                v-for="place in group.places"
                :key="`${place.kind}:${place.id}`"
                :title="place.kind === 'host' ? place.name : undefined"
              >
                {{ place.kind === "host" ? place.id : place.name }}
                <button
                  class="quick-place-remove"
                  :aria-label="`Bỏ ${place.kind === 'host' ? place.id : place.name}`"
                  @click="quick.forgetPlace(place)"
                >
                  <AppIcon name="close" :size="11" />
                </button>
              </li>
            </ul>
          </template>
          <!-- Adding comes from use, so the way to add is said under the list (decision 0136). -->
          <p class="quick-note quick-places-hint">
            {{ quick.places.value.length ? "Thêm nơi khác:" : "Chưa có nơi nào. Để thêm:" }}
            bôi đen chữ ở đó, nhấn {{ quickShortcutLabel }} rồi chọn “Luôn hiện nút ở …”.
          </p>
          <button
            v-if="quick.placesChanged.value"
            class="link-button quick-places-reset"
            @click="quick.resetPlaces()"
          >
            Khôi phục mặc định
          </button>
        </div>
      </div>
    </template>

    <div class="settings-tool-row">
      <div>
        <h3 id="quick-launch-title">Khởi động cùng máy</h3>
        <p id="quick-launch-help">
          Mở sẵn OfflineMask ở {{ trayLabel }} khi bạn bật máy, để dùng Ẩn nhanh ngay.
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
          aria-labelledby="quick-launch-title"
          aria-describedby="quick-launch-help"
          @change="quick.setLaunchAtLogin(($event.target as HTMLInputElement).checked)"
        />
      </label>
    </div>
  </section>
</template>
