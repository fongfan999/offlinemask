<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import PasscodeSetup from "./PasscodeSetup.vue";
import { useProvided, vaultKey } from "../composables/context.ts";

/** Step 2's one opt-in to history (decision 0071), the same on every page: without a
 * passcode the replacement table lives only while the app is open. "Để sau" holds for
 * the rest of the run, whichever page asked. */
const props = defineProps<{ subject: string }>();

const vault = useProvided(vaultKey);
const settingPasscode = ref(false);
const keptNotice = ref("");
const shown = computed(
  () => (vault.state.value === "none" && !vault.offerDismissed.value) || keptNotice.value,
);
const subjectTitle = computed(() => props.subject[0]!.toUpperCase() + props.subject.slice(1));
</script>

<template>
  <div v-if="shown" class="keep-offer" role="status">
    <AppIcon name="lock" :size="18" />
    <div class="keep-offer-body">
      <template v-if="keptNotice">
        <strong>{{ keptNotice }}</strong>
      </template>
      <template v-else-if="!settingPasscode">
        <strong>Muốn xem lại {{ subject }} này sau?</strong>
        <span
          >Đặt mật mã để lưu vào lịch sử trên máy này; nếu không, đóng ứng dụng sẽ mất bảng mã thay
          thế.</span
        >
      </template>
      <template v-else>
        <strong>Đặt mật mã cho OfflineMask</strong>
        <span
          >Ứng dụng sẽ hỏi mật mã khi khởi động. Quên mật mã thì phải xóa hết và bắt đầu lại.</span
        >
        <PasscodeSetup
          compact
          @created="
            settingPasscode = false;
            keptNotice = `Đã bật lịch sử. ${subjectTitle} này có trong thanh bên.`;
          "
        />
      </template>
    </div>
    <div v-if="!keptNotice" class="keep-offer-actions">
      <button
        class="quiet-button"
        @click="settingPasscode ? (settingPasscode = false) : (vault.offerDismissed.value = true)"
      >
        {{ settingPasscode ? "Hủy" : "Để sau" }}
      </button>
      <button v-if="!settingPasscode" class="quiet-button accent" @click="settingPasscode = true">
        Đặt mật mã
      </button>
    </div>
  </div>
</template>
