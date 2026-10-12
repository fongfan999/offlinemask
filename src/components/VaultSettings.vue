<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);

const passcode = ref("");
const confirm = ref("");
const current = ref("");
const next = ref("");
const nextConfirm = ref("");
const notice = ref("");
const confirmingWipe = ref(false);

const mismatch = computed(() => !!confirm.value && passcode.value !== confirm.value);
const nextMismatch = computed(() => !!nextConfirm.value && next.value !== nextConfirm.value);
const privateCount = computed(
  () => store.sessions.value.filter((session) => session.fixture === "private-text-v1").length,
);

async function create() {
  if (!passcode.value || mismatch.value) return;
  notice.value = "";
  if (await vault.create(passcode.value, store.sessions.value)) {
    passcode.value = "";
    confirm.value = "";
    notice.value =
      privateCount.value > 0
        ? `Đã lưu ${privateCount.value} phiên hiện có. Từ giờ các phiên mới cũng được lưu.`
        : "Đã đặt mật mã. Các phiên của bạn sẽ được lưu trên máy này.";
  }
}
async function change() {
  if (!current.value || !next.value || nextMismatch.value) return;
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
    notice.value = "Đã xóa toàn bộ phiên đã lưu.";
  }
}
</script>

<template>
  <section class="vault-settings glass glass-card" aria-labelledby="vault-title">
    <div class="model-card-heading">
      <h2 id="vault-title">Phiên đã lưu</h2>
      <span
        v-if="vault.state.value !== 'unavailable'"
        class="model-badge"
        :class="{ installed: vault.state.value === 'unlocked' }"
        >{{ vault.state.value === "unlocked" ? "Đã bảo vệ" : "Chưa đặt mật mã" }}</span
      >
    </div>
    <p v-if="vault.state.value === 'unavailable'" class="model-description">
      Lưu phiên chỉ có trong ứng dụng máy tính. Trong bản xem trước, phiên chỉ nằm trong bộ nhớ.
    </p>
    <template v-else-if="vault.state.value === 'none'">
      <p class="model-description">
        Hiện các phiên chỉ nằm trong bộ nhớ và mất khi đóng ứng dụng. Đặt mật mã để mã hóa và giữ
        chúng trên máy này. Quên mật mã thì phải xóa hết và bắt đầu lại.
      </p>
      <form class="passcode-form" @submit.prevent="create">
        <label for="vault-passcode">Mật mã (ít nhất 4 ký tự)</label>
        <input
          id="vault-passcode"
          v-model="passcode"
          class="passcode-input"
          type="password"
          autocomplete="new-password"
        />
        <label for="vault-confirm">Nhập lại mật mã</label>
        <input
          id="vault-confirm"
          v-model="confirm"
          class="passcode-input"
          type="password"
          autocomplete="new-password"
          :aria-invalid="mismatch"
        />
        <p v-if="mismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
        <p v-else-if="vault.error.value" class="input-error" role="alert">
          {{ vault.error.value }}
        </p>
        <button
          class="primary-action"
          type="submit"
          :disabled="!passcode || !confirm || mismatch || vault.busy.value"
        >
          <AppIcon name="lock" :size="17" />Đặt mật mã và lưu phiên
        </button>
      </form>
    </template>
    <template v-else-if="vault.state.value === 'unlocked'">
      <p class="model-description">
        Các phiên được mã hóa bằng mật mã của bạn và lưu trên máy này. Không gì rời khỏi máy.
      </p>
      <details class="model-details">
        <summary>Đổi mật mã</summary>
        <form class="passcode-form" @submit.prevent="change">
          <label for="vault-current">Mật mã hiện tại</label>
          <input
            id="vault-current"
            v-model="current"
            class="passcode-input"
            type="password"
            autocomplete="current-password"
          />
          <label for="vault-next">Mật mã mới</label>
          <input
            id="vault-next"
            v-model="next"
            class="passcode-input"
            type="password"
            autocomplete="new-password"
          />
          <label for="vault-next-confirm">Nhập lại mật mã mới</label>
          <input
            id="vault-next-confirm"
            v-model="nextConfirm"
            class="passcode-input"
            type="password"
            autocomplete="new-password"
            :aria-invalid="nextMismatch"
          />
          <p v-if="nextMismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
          <p v-else-if="vault.error.value" class="input-error" role="alert">
            {{ vault.error.value }}
          </p>
          <button
            class="quiet-button"
            type="submit"
            :disabled="!current || !next || !nextConfirm || nextMismatch || vault.busy.value"
          >
            Đổi mật mã
          </button>
        </form>
      </details>
      <div class="model-uninstall">
        <template v-if="!confirmingWipe">
          <button class="quiet-button danger-button" @click="confirmingWipe = true">
            Xóa tất cả phiên đã lưu
          </button>
        </template>
        <template v-else>
          <p>Xóa {{ privateCount }} phiên và bỏ mật mã? Không thể hoàn tác.</p>
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
