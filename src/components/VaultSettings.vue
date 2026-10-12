<script setup lang="ts">
import { computed, ref } from "vue";
import PasscodeField from "./PasscodeField.vue";
import PasscodeSetup from "./PasscodeSetup.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

/** App passcode: optional. Set it here or from the review screen; change or wipe it here. */
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);

const current = ref("");
const next = ref("");
const nextConfirm = ref("");
const notice = ref("");
const confirmingWipe = ref(false);

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
    notice.value = "Đã đổi mật mã.";
  }
}
async function wipe() {
  confirmingWipe.value = false;
  notice.value = "";
  if (await vault.reset()) {
    store.removePrivate();
    notice.value = "Đã xóa toàn bộ phiên đã lưu và bỏ mật mã.";
  }
}
</script>

<template>
  <section class="vault-settings glass glass-card" aria-labelledby="vault-title">
    <div class="model-card-heading">
      <h2 id="vault-title">Mật mã ứng dụng</h2>
      <span
        v-if="vault.state.value !== 'unavailable'"
        class="model-badge"
        :class="{ installed: vault.state.value === 'unlocked' }"
        >{{ vault.state.value === "unlocked" ? "Đang bảo vệ" : "Chưa đặt" }}</span
      >
    </div>
    <p v-if="vault.state.value === 'unavailable'" class="model-description">
      Mật mã và lưu phiên chỉ có trong ứng dụng máy tính. Bản xem trước giữ phiên trong bộ nhớ.
    </p>
    <template v-else-if="vault.state.value === 'none'">
      <p class="model-description">
        Không bắt buộc. Có mật mã, các phiên của bạn được mã hóa và lưu trên máy này để mở lại lần
        sau; ứng dụng sẽ hỏi mật mã khi khởi động. Không có mật mã, phiên mất khi đóng ứng dụng.
        Quên mật mã thì chỉ có thể xóa hết và bắt đầu lại.
      </p>
      <PasscodeSetup
        @created="
          notice =
            privateCount > 0
              ? `Đã lưu ${privateCount} phiên hiện có. Các phiên mới cũng sẽ được lưu.`
              : 'Đã đặt mật mã. Các phiên của bạn sẽ được lưu trên máy này.'
        "
      />
    </template>
    <template v-else>
      <p class="model-description">
        Ứng dụng hỏi mật mã khi khởi động. Các phiên được mã hóa bằng mật mã này và lưu trên máy;
        không gì rời khỏi máy.
      </p>
      <details class="model-details">
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
          <p v-if="nextMismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
          <p v-else-if="vault.error.value" class="input-error" role="alert">
            {{ vault.error.value }}
          </p>
          <button class="quiet-button" type="submit" :disabled="!changeReady || vault.busy.value">
            Đổi mật mã
          </button>
        </form>
      </details>
      <div class="model-uninstall">
        <template v-if="!confirmingWipe">
          <button class="quiet-button danger-button" @click="confirmingWipe = true">
            Xóa phiên đã lưu và bỏ mật mã
          </button>
        </template>
        <template v-else>
          <p>Xóa {{ privateCount }} phiên đã lưu và bỏ mật mã? Không thể hoàn tác.</p>
          <div class="lock-reset-actions">
            <button class="quiet-button" @click="confirmingWipe = false">Hủy</button>
            <button class="quiet-button danger-button" :disabled="vault.busy.value" @click="wipe">
              Xóa và bỏ mật mã
            </button>
          </div>
        </template>
      </div>
    </template>
    <p v-if="notice" class="restore-status" role="status">{{ notice }}</p>
  </section>
</template>
