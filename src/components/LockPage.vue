<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import PasscodeField from "./PasscodeField.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";
import type { TextSession } from "../core/sessions.ts";

/** Shown at launch when a passcode exists. Forgetting it wipes the vault. */
const emit = defineEmits<{ unlocked: [sessions: TextSession[]] }>();
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const passcode = ref("");
const confirmingReset = ref(false);
const input = useTemplateRef<InstanceType<typeof PasscodeField>>("input");

onMounted(() => input.value?.focus());

async function unlock() {
  if (!passcode.value || vault.busy.value) return;
  const sessions = await vault.unlock(passcode.value);
  passcode.value = "";
  if (sessions) emit("unlocked", sessions);
  else input.value?.focus();
}
async function reset() {
  if (await vault.reset()) store.removePrivate();
}
</script>

<template>
  <main class="lock-page">
    <form class="lock-card glass" @submit.prevent="unlock">
      <span class="hero-logo brand-mark" aria-hidden="true"
        ><AppIcon name="mask" :size="26"
      /></span>
      <h1>Nhập mật mã để mở OfflineMask</h1>
      <p>Các phiên của bạn được mã hóa trên máy này. Mật mã không được lưu ở đâu cả.</p>
      <PasscodeField
        id="lock-passcode"
        ref="input"
        v-model="passcode"
        label="Mật mã 6 số"
        autocomplete="current-password"
        :disabled="vault.busy.value"
        autofocus
        @complete="unlock"
      />
      <p v-if="vault.error.value" class="input-error" role="alert">{{ vault.error.value }}</p>
      <button
        class="primary-action"
        type="submit"
        :disabled="passcode.length !== 6 || vault.busy.value"
      >
        <span v-if="vault.busy.value" class="spinner" aria-hidden="true"></span
        ><AppIcon v-else name="lock" :size="17" />{{ vault.busy.value ? "Đang mở…" : "Mở khóa" }}
      </button>
      <button
        v-if="!confirmingReset"
        type="button"
        class="link-button"
        @click="confirmingReset = true"
      >
        Quên mật mã?
      </button>
      <div v-else class="lock-reset" role="group" aria-label="Quên mật mã">
        <p>
          Không có cách lấy lại mật mã. Xóa toàn bộ phiên đã lưu và mở ứng dụng với danh sách trống?
        </p>
        <div class="lock-reset-actions">
          <button type="button" class="quiet-button" @click="confirmingReset = false">Hủy</button>
          <button
            type="button"
            class="quiet-button danger-button"
            :disabled="vault.busy.value"
            @click="reset"
          >
            Xóa và bắt đầu lại
          </button>
        </div>
      </div>
    </form>
  </main>
</template>
