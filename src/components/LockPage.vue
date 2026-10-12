<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";
import type { TextSession } from "../core/sessions.ts";

/** First launch sets the app passcode; every later launch asks for it. */
const props = defineProps<{ mode: "setup" | "unlock" }>();
const emit = defineEmits<{ unlocked: [sessions: TextSession[]]; ready: [] }>();
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const passcode = ref("");
const confirm = ref("");
const confirmingReset = ref(false);
const input = useTemplateRef<HTMLInputElement>("input");
const mismatch = computed(
  () => props.mode === "setup" && !!confirm.value && passcode.value !== confirm.value,
);
const disabled = computed(
  () =>
    vault.busy.value ||
    !passcode.value ||
    (props.mode === "setup" && (!confirm.value || mismatch.value)),
);

onMounted(() => input.value?.focus());

async function submit() {
  if (disabled.value) return;
  if (props.mode === "setup") {
    if (await vault.create(passcode.value, store.sessions.value)) {
      passcode.value = "";
      confirm.value = "";
      emit("ready");
    }
    return;
  }
  const sessions = await vault.unlock(passcode.value);
  passcode.value = "";
  if (sessions) emit("unlocked", sessions);
  else input.value?.focus();
}
async function reset() {
  if (await vault.reset()) {
    store.removePrivate();
    confirmingReset.value = false;
    passcode.value = "";
  }
}
</script>

<template>
  <main class="lock-page">
    <form class="lock-card glass" @submit.prevent="submit">
      <span class="hero-logo brand-mark" aria-hidden="true"
        ><AppIcon name="mask" :size="26"
      /></span>
      <template v-if="mode === 'setup'">
        <h1>Tạo mật mã cho OfflineMask</h1>
        <p>
          Mật mã bảo vệ ứng dụng và các phiên của bạn, được mã hóa và lưu trên máy này. Không có
          cách lấy lại mật mã đã quên.
        </p>
        <label class="sr-only" for="lock-passcode">Mật mã, ít nhất 4 ký tự</label>
        <input
          id="lock-passcode"
          ref="input"
          v-model="passcode"
          class="passcode-input"
          type="password"
          autocomplete="new-password"
          placeholder="Mật mã (ít nhất 4 ký tự)"
          :disabled="vault.busy.value"
        />
        <label class="sr-only" for="lock-confirm">Nhập lại mật mã</label>
        <input
          id="lock-confirm"
          v-model="confirm"
          class="passcode-input"
          type="password"
          autocomplete="new-password"
          placeholder="Nhập lại mật mã"
          :aria-invalid="mismatch"
          :disabled="vault.busy.value"
        />
        <p v-if="mismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
        <p v-else-if="vault.error.value" class="input-error" role="alert">
          {{ vault.error.value }}
        </p>
        <button class="primary-action" type="submit" :disabled="disabled">
          <span v-if="vault.busy.value" class="spinner" aria-hidden="true"></span
          ><AppIcon v-else name="lock" :size="17" />{{
            vault.busy.value ? "Đang tạo…" : "Tạo mật mã"
          }}
        </button>
      </template>
      <template v-else>
        <h1>Nhập mật mã để mở OfflineMask</h1>
        <p>Các phiên của bạn được mã hóa trên máy này. Mật mã không được lưu ở đâu cả.</p>
        <label class="sr-only" for="lock-passcode">Mật mã</label>
        <input
          id="lock-passcode"
          ref="input"
          v-model="passcode"
          class="passcode-input"
          type="password"
          autocomplete="current-password"
          placeholder="Mật mã"
          :disabled="vault.busy.value"
        />
        <p v-if="vault.error.value" class="input-error" role="alert">{{ vault.error.value }}</p>
        <button class="primary-action" type="submit" :disabled="disabled">
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
            Không có cách lấy lại mật mã. Xóa toàn bộ phiên đã lưu, tạo mật mã mới và bắt đầu lại
            với danh sách trống?
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
      </template>
    </form>
  </main>
</template>
