<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import BrandMark from "./BrandMark.vue";
import PasscodeField from "./PasscodeField.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

/** Shown at launch when a passcode exists. It unlocks on the sixth digit, like a
 * phone; there is no button to press. Forgetting the passcode wipes the vault. */
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const passcode = ref("");
const confirmingReset = ref(false);
const shake = ref(0);
const digitsOnly = ref(false);
const input = useTemplateRef<InstanceType<typeof PasscodeField>>("input");

onMounted(() => input.value?.focus());
// Typing again clears the last error.
watch(passcode, (value) => {
  if (value) vault.error.value = "";
});
// A letter or symbol is dropped; say why for a moment.
let hintTimer: ReturnType<typeof setTimeout> | undefined;
function rejected() {
  digitsOnly.value = true;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (digitsOnly.value = false), 2500);
}
onBeforeUnmount(() => clearTimeout(hintTimer));

async function unlock() {
  if (passcode.value.length !== 6 || vault.busy.value) return;
  const sessions = await vault.unlock(passcode.value);
  passcode.value = "";
  // Loaded here, not emitted: the unlock already swapped this page out, and Vue
  // drops events from an unmounted component, so the history never opened
  // (decision 0123).
  if (sessions) store.load(sessions);
  else {
    shake.value++;
    // The field is re-enabled on the next render; focus it after that.
    await nextTick();
    input.value?.focus();
  }
}
async function reset() {
  if (await vault.reset()) store.removePrivate();
}
</script>

<template>
  <main class="lock-page">
    <form class="lock-card glass" @submit.prevent="unlock">
      <span class="hero-logo brand-mark" aria-hidden="true"><BrandMark :size="38" /></span>
      <h1>Nhập mật mã để mở OfflineMask</h1>
      <p>Mở khóa để xem lịch sử của bạn.</p>
      <PasscodeField
        id="lock-passcode"
        ref="input"
        v-model="passcode"
        label="Mật mã 6 số"
        autocomplete="current-password"
        :disabled="vault.busy.value"
        :invalid="!!vault.error.value"
        :shake="shake"
        autofocus
        @complete="unlock"
        @rejected="rejected"
      />
      <p class="lock-status" :class="{ 'is-error': vault.error.value }" aria-live="polite">
        <template v-if="vault.busy.value"
          ><span class="spinner" aria-hidden="true"></span>Đang mở...</template
        ><template v-else-if="vault.error.value">{{ vault.error.value }}</template
        ><template v-else-if="digitsOnly">Chỉ nhập số.</template>
      </p>
      <button
        v-if="!confirmingReset"
        type="button"
        class="link-button"
        @click="confirmingReset = true"
      >
        Quên mật mã?
      </button>
      <div v-else class="lock-reset" role="group" aria-label="Quên mật mã">
        <p>Không có cách lấy lại mật mã. Xóa lịch sử và bỏ mật mã? Không thể hoàn tác.</p>
        <div class="lock-reset-actions">
          <button type="button" class="quiet-button" @click="confirmingReset = false">Hủy</button>
          <button
            type="button"
            class="quiet-button danger-button"
            :disabled="vault.busy.value"
            @click="reset"
          >
            Xóa và bỏ mật mã
          </button>
        </div>
      </div>
    </form>
  </main>
</template>
