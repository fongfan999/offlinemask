<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import PasscodeField from "./PasscodeField.vue";
import { sessionsKey, useProvided, vaultKey } from "../composables/context.ts";

/** Create the six-digit app passcode and store the current private sessions behind it.
 * Used by the offer on the review screen and by Settings. */
const props = defineProps<{ compact?: boolean }>();
const emit = defineEmits<{ created: [] }>();
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const passcode = ref("");
const confirm = ref("");
const confirmField = useTemplateRef<InstanceType<typeof PasscodeField>>("confirmField");
const complete = computed(() => passcode.value.length === 6 && confirm.value.length === 6);
const mismatch = computed(() => complete.value && passcode.value !== confirm.value);
const disabled = computed(() => !complete.value || mismatch.value || vault.busy.value);

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
    <span class="passcode-caption">Mật mã 6 số</span>
    <PasscodeField
      id="setup-passcode"
      v-model="passcode"
      label="Mật mã 6 số"
      autocomplete="new-password"
      :disabled="vault.busy.value"
      autofocus
      @complete="confirmField?.focus()"
    />
    <span class="passcode-caption">Nhập lại</span>
    <PasscodeField
      id="setup-confirm"
      ref="confirmField"
      v-model="confirm"
      label="Nhập lại mật mã"
      autocomplete="new-password"
      :disabled="vault.busy.value"
      @complete="create"
    />
    <p v-if="mismatch" class="input-error" role="alert">Hai lần nhập chưa giống nhau.</p>
    <p v-else-if="vault.error.value" class="input-error" role="alert">{{ vault.error.value }}</p>
    <div class="passcode-actions">
      <button class="primary-action" type="submit" :disabled="disabled">
        <span v-if="vault.busy.value" class="spinner" aria-hidden="true"></span
        ><AppIcon v-else name="lock" :size="17" />{{
          vault.busy.value ? "Đang lưu..." : "Đặt mật mã và lưu"
        }}
      </button>
      <!-- Optional secondary action, such as cancelling, beside the submit button. -->
      <slot />
    </div>
  </form>
</template>
