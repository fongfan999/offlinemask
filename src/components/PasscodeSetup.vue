<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

/** Create the app passcode and store the current private sessions behind it.
 * Used by the offer on the review screen and by Settings. */
const props = defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ created: [] }>();
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const passcode = ref("");
const confirm = ref("");
const mismatch = computed(() => !!confirm.value && passcode.value !== confirm.value);
const disabled = computed(
  () => !passcode.value || !confirm.value || mismatch.value || vault.busy.value,
);

async function create() {
  if (disabled.value) return;
  if (await vault.create(passcode.value, store.sessions.value)) {
    passcode.value = "";
    confirm.value = "";
    emit("created");
  }
}
</script>

<template>
  <form class="passcode-form" :class="{ compact: props.compact }" @submit.prevent="create">
    <label class="sr-only" for="setup-passcode">Mật mã, ít nhất 4 ký tự</label>
    <input
      id="setup-passcode"
      v-model="passcode"
      class="passcode-input"
      type="password"
      autocomplete="new-password"
      placeholder="Mật mã (ít nhất 4 ký tự)"
      :disabled="vault.busy.value"
    />
    <label class="sr-only" for="setup-confirm">Nhập lại mật mã</label>
    <input
      id="setup-confirm"
      v-model="confirm"
      class="passcode-input"
      type="password"
      autocomplete="new-password"
      placeholder="Nhập lại mật mã"
      :aria-invalid="mismatch"
      :disabled="vault.busy.value"
    />
    <p v-if="mismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
    <p v-else-if="vault.error.value" class="input-error" role="alert">{{ vault.error.value }}</p>
    <button class="primary-action" type="submit" :disabled="disabled">
      <span v-if="vault.busy.value" class="spinner" aria-hidden="true"></span
      ><AppIcon v-else name="lock" :size="17" />{{
        vault.busy.value ? "Đang lưu…" : "Đặt mật mã và lưu"
      }}
    </button>
  </form>
</template>
