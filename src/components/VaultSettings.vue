<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import PasscodeField from "./PasscodeField.vue";
import PasscodeSetup from "./PasscodeSetup.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

/** App passcode: optional. Set it here or from the review screen; change or wipe it here. */
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);

const current = ref("");
const next = ref("");
const nextConfirm = ref("");
/** Outcome of the last action, shown at the top of the card where it is seen. */
const notice = ref("");
const noticeEl = useTemplateRef<HTMLParagraphElement>("noticeEl");
const changeOpen = ref(false);
async function announce(message: string) {
  notice.value = message;
  await nextTick();
  noticeEl.value?.focus({ preventScroll: true });
  noticeEl.value?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
/** The setup form opens on request, like the offer on the review screen. */
const settingUp = ref(false);

const nextMismatch = computed(
  () => nextConfirm.value.length === 6 && next.value !== nextConfirm.value,
);
const changeReady = computed(
  () =>
    current.value.length === 6 &&
    next.value.length === 6 &&
    nextConfirm.value.length === 6 &&
    !nextMismatch.value,
);
const privateCount = computed(
  () => store.sessions.value.filter((session) => session.fixture === "private-text-v1").length,
);

async function change() {
  if (!changeReady.value) return;
  notice.value = "";
  if (await vault.changePasscode(current.value, next.value)) {
    current.value = "";
    next.value = "";
    nextConfirm.value = "";
    // The form closes so the confirmation, not empty fields, is what remains.
    changeOpen.value = false;
    await announce("Đã đổi mật mã. Lần sau hãy mở ứng dụng bằng mật mã mới.");
  }
}
async function wipe() {
  notice.value = "";
  if (await vault.reset()) {
    store.removePrivate();
    await announce("Đã xóa lịch sử, bỏ mật mã và tắt lịch sử.");
  }
}
</script>

<template>
  <section class="vault-settings glass glass-card" aria-labelledby="vault-title">
    <div class="model-card-heading">
      <h2 id="vault-title">Mật mã · Lưu lịch sử</h2>
      <span
        v-if="vault.state.value !== 'unavailable'"
        class="model-badge"
        :class="{ installed: vault.state.value === 'unlocked' }"
        >{{ vault.state.value === "unlocked" ? "Đang bảo vệ" : "Chưa đặt" }}</span
      >
    </div>
    <p v-if="notice" ref="noticeEl" class="settings-notice" role="status" tabindex="-1">
      <AppIcon name="check" :size="16" />{{ notice }}
    </p>
    <p v-if="vault.state.value === 'unavailable'" class="model-description">
      Mật mã và lịch sử chỉ có trong ứng dụng máy tính.
    </p>
    <template v-else-if="vault.state.value === 'none'">
      <p class="model-description">
        Đặt mật mã 6 số để bật lịch sử: các văn bản bạn ẩn được lưu trên máy này để mở lại
        sau.<template v-if="settingUp">
          Ứng dụng sẽ hỏi mật mã khi khởi động; quên mật mã thì phải xóa hết và bắt đầu
          lại.</template
        >
      </p>
      <button
        v-if="!settingUp"
        class="quiet-button accent vault-start"
        @click="
          settingUp = true;
          notice = '';
        "
      >
        Đặt mật mã
      </button>
      <PasscodeSetup
        v-else
        @created="
          settingUp = false;
          void announce(
            privateCount > 0
              ? `Đã bật lịch sử với ${privateCount} mục hiện có.`
              : 'Đã bật lịch sử. Các văn bản bạn ẩn sẽ được lưu trên máy này.',
          );
        "
      >
        <button type="button" class="quiet-button" @click="settingUp = false">Hủy</button>
      </PasscodeSetup>
    </template>
    <template v-else>
      <p class="model-description">
        Ứng dụng hỏi mật mã khi khởi động. Lịch sử được mã hóa bằng mật mã này và lưu trên máy;
        không gì rời khỏi máy.
      </p>
      <div class="model-details">
        <details
          :open="changeOpen"
          @toggle="
            changeOpen = ($event.target as HTMLDetailsElement).open;
            if (changeOpen) notice = '';
          "
        >
          <summary>Đổi mật mã</summary>
          <form class="passcode-form" @submit.prevent="change">
            <span class="passcode-caption">Mật mã hiện tại</span>
            <PasscodeField
              id="vault-current"
              v-model="current"
              label="Mật mã hiện tại"
              autocomplete="current-password"
            />
            <span class="passcode-caption">Mật mã mới (6 số)</span>
            <PasscodeField
              id="vault-next"
              v-model="next"
              label="Mật mã mới, 6 số"
              autocomplete="new-password"
            />
            <span class="passcode-caption">Nhập lại mật mã mới</span>
            <PasscodeField
              id="vault-next-confirm"
              v-model="nextConfirm"
              label="Nhập lại mật mã mới"
              autocomplete="new-password"
            />
            <p v-if="nextMismatch" class="input-error" role="alert">
              Hai lần nhập chưa giống nhau.
            </p>
            <p v-else-if="vault.error.value" class="input-error" role="alert">
              {{ vault.error.value }}
            </p>
            <button class="quiet-button" type="submit" :disabled="!changeReady || vault.busy.value">
              Đổi mật mã
            </button>
          </form>
        </details>
        <!-- The one destructive action stays tucked away; opening it is the first step. -->
        <details>
          <summary>Bỏ mật mã</summary>
          <div class="model-uninstall">
            <p>
              Xóa {{ privateCount }} mục trong lịch sử, bỏ mật mã và tắt lịch sử. Không thể hoàn
              tác.
            </p>
            <button class="quiet-button danger-button" :disabled="vault.busy.value" @click="wipe">
              Xóa và bỏ mật mã
            </button>
          </div>
        </details>
      </div>
    </template>
  </section>
</template>
