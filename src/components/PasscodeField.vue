<script setup lang="ts">
import { useTemplateRef } from "vue";

/** Six-digit passcode entry, like a phone: digits only, masked, auto-advances. */
const props = defineProps<{
  id: string;
  label: string;
  modelValue: string;
  autocomplete: "current-password" | "new-password";
  disabled?: boolean;
  autofocus?: boolean;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string]; complete: [] }>();
const input = useTemplateRef<HTMLInputElement>("input");
const passcodeLength = 6;

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const digits = target.value.replace(/\D/g, "").slice(0, passcodeLength);
  target.value = digits;
  emit("update:modelValue", digits);
  if (digits.length === passcodeLength && props.modelValue !== digits) emit("complete");
}
defineExpose({
  focus() {
    input.value?.focus();
  },
});
</script>

<template>
  <label class="sr-only" :for="id">{{ label }}</label>
  <input
    :id="id"
    ref="input"
    class="passcode-input"
    type="password"
    inputmode="numeric"
    pattern="[0-9]*"
    :maxlength="passcodeLength"
    :autocomplete="autocomplete"
    :autofocus="autofocus"
    :value="modelValue"
    :disabled="disabled"
    placeholder="••••••"
    @input="onInput"
  />
</template>
