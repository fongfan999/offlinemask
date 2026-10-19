<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";

/** Six-digit passcode entry, like a phone: six slots that fill as you type. One real
 * input sits over the slots, so keyboard, paste, autofill and screen readers work as
 * with any password field; the slots only draw its state. */
const props = defineProps<{
  id: string;
  label: string;
  modelValue: string;
  autocomplete: "current-password" | "new-password";
  disabled?: boolean;
  autofocus?: boolean;
  /** Marks the field as wrong; each increase of `shake` replays a short shake. */
  invalid?: boolean;
  shake?: number;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  complete: [];
  /** Something other than a digit was typed or pasted. */
  rejected: [];
}>();
const input = useTemplateRef<HTMLInputElement>("input");
const passcodeLength = 6;
const focused = ref(false);
const shaking = ref(false);
const slots = computed(() => Array.from({ length: passcodeLength }, (_, index) => index));

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const typed = target.value;
  const digits = typed.replace(/\D/g, "").slice(0, passcodeLength);
  if (/\D/.test(typed)) emit("rejected");
  target.value = digits;
  emit("update:modelValue", digits);
  if (digits.length === passcodeLength && props.modelValue !== digits) emit("complete");
}
watch(
  () => props.shake,
  (next, previous) => {
    if (!next || next === previous) return;
    shaking.value = false;
    requestAnimationFrame(() => (shaking.value = true));
  },
);
defineExpose({
  focus() {
    input.value?.focus();
  },
});
</script>

<template>
  <div
    class="passcode-field"
    :class="{ 'is-focused': focused, 'is-invalid': invalid, 'is-shaking': shaking }"
    @animationend="shaking = false"
  >
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
      :aria-invalid="invalid || undefined"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
    />
    <span class="passcode-slots" aria-hidden="true">
      <span
        v-for="index in slots"
        :key="index"
        class="passcode-slot"
        :class="{
          'is-filled': index < modelValue.length,
          'is-active': focused && index === Math.min(modelValue.length, passcodeLength - 1),
        }"
      ></span>
    </span>
  </div>
</template>
