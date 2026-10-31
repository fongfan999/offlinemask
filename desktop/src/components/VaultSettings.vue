<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import AppIcon from "./AppIcon.vue";
import PasscodeField from "./PasscodeField.vue";
import PasscodeSetup from "./PasscodeSetup.vue";
import { quickKey, sessionsKey, useProvided, vaultKey } from "../composables/context.ts";
import { isPrivate, keepDayChoices, type KeepDays } from "../core/sessions.ts";

/** App passcode: optional. Set it here or from the review screen; change or wipe it here. */
const vault = useProvided(vaultKey);
const store = useProvided(sessionsKey);
const quick = useProvided(quickKey);

const current = ref("");
const next = ref("");
const nextConfirm = ref("");
/** Outcome of the last action, shown at the top of the card where it is seen. */
const notice = ref("");
const noticeEl = useTemplateRef<HTMLParagraphElement>("noticeEl");
const changeOpen = ref(false);
async function announce(message: string) {
  notice.value = message;
  await nextTick();
  noticeEl.value?.focus({ preventScroll: true });
  noticeEl.value?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
/** The setup form opens on request, like the offer on the review screen. */
const settingUp = ref(false);
const card = useTemplateRef<HTMLElement>("card");

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
const privateCount = computed(() => store.sessions.value.filter(isPrivate).length);

async function change() {
  if (!changeReady.value) return;
  notice.value = "";
  if (await vault.changePasscode(current.value, next.value)) {
    current.value = "";
    next.value = "";
    nextConfirm.value = "";
    // The form closes so the confirmation, not empty fields, is what remains.
    changeOpen.value = false;
    await announce("Đã đổi mật mã. Lần sau hãy mở ứng dụng bằng mật mã mới.");
  }
}
/** A shorter keep period that would delete entries waits for a confirmation. */
const pendingDays = ref<KeepDays | null>(null);
const pendingCount = computed(() =>
  pendingDays.value === null ? 0 : store.expiring(pendingDays.value).length,
);
async function chooseKeepDays(days: KeepDays) {
  notice.value = "";
  pendingDays.value = null;
  if (days === store.keepDays.value) return;
  if (store.expiring(days).length > 0) pendingDays.value = days;
  else await applyKeepDays(days);
}
async function applyKeepDays(days: KeepDays) {
  pendingDays.value = null;
  const removed = store.setKeepDays(days);
  for (const id of removed) quick.forget(id);
  await announce(
    removed.length
      ? `Đã xóa ${removed.length} mục cũ. Lịch sử giờ tự xóa sau ${days} ngày.`
      : `Lịch sử sẽ tự xóa sau ${days} ngày.`,
  );
}
async function wipe() {
  notice.value = "";
  if (await vault.reset()) {
    store.removePrivate();
    await announce("Đã xóa lịch sử, bỏ mật mã và tắt lịch sử.");
  }
}
/** From the sidebar's note (decision 0172): the setup form, open and in view. */
defineExpose({
  async setUp() {
    if (vault.state.value !== "none") return card.value?.scrollIntoView({ block: "start" });
    settingUp.value = true;
    notice.value = "";
    await nextTick();
    card.value?.scrollIntoView({ block: "start", behavior: "smooth" });
    card.value?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <section ref="card" class="vault-settings glass glass-card" aria-labelledby="vault-title">
    <div class="model-card-heading">
      <h2 id="vault-title">Mật mã - Lưu lịch sử</h2>
      <span
        v-if="vault.state.value !== 'unavailable'"
        class="model-badge"
        :class="{ installed: vault.state.value === 'unlocked' }"
        >{{ vault.state.value === "unlocked" ? "Đang bảo vệ" : "Chưa đặt" }}</span
      >
    </div>
    <p v-if="notice" ref="noticeEl" class="settings-notice" role="status" tabindex="-1">
      <AppIcon name="check" :size="16" />{{ notice }}
    </p>
    <p v-if="vault.state.value === 'unavailable'" class="model-description">
      Mật mã và lịch sử chỉ có trong ứng dụng máy tính.
    </p>
    <template v-else-if="vault.state.value === 'none'">
      <p class="model-description">
        Đặt mật mã 6 số để bật lịch sử: các văn bản bạn ẩn được lưu trên máy này để mở lại
        sau.<template v-if="settingUp">
          Ứng dụng sẽ hỏi mật mã khi khởi động; quên mật mã thì phải xóa hết và bắt đầu
          lại.</template
        >
      </p>
      <button
        v-if="!settingUp"
        class="quiet-button accent vault-start"
        @click="
          settingUp = true;
          notice = '';
        "
      >
        Đặt mật mã
      </button>
      <PasscodeSetup
        v-else
        @created="
          settingUp = false;
          void announce(
            privateCount > 0
              ? `Đã bật lịch sử với ${privateCount} mục hiện có.`
              : 'Đã bật lịch sử. Các văn bản bạn ẩn sẽ được lưu trên máy này.',
          );
        "
      >
        <button type="button" class="quiet-button" @click="settingUp = false">Hủy</button>
      </PasscodeSetup>
    </template>
    <template v-else>
      <p class="model-description">
        Ứng dụng hỏi mật mã khi khởi động. Lịch sử được mã hóa bằng mật mã này, lưu trên máy và tự
        xóa khi quá hạn bên dưới; không gì rời khỏi máy.
      </p>
      <div class="settings-tool-row vault-keep">
        <h3 id="keep-title">Tự xóa lịch sử sau</h3>
        <fieldset class="theme-switch" aria-labelledby="keep-title">
          <label v-for="days in keepDayChoices" :key="days">
            <input
              type="radio"
              name="keep-days"
              :value="days"
              :checked="(pendingDays ?? store.keepDays.value) === days"
              @change="chooseKeepDays(days)"
            />{{ days }} ngày
          </label>
        </fieldset>
      </div>
      <div v-if="pendingDays !== null" class="model-uninstall vault-keep-confirm" role="alert">
        <p>
          {{ pendingCount }} mục cũ hơn {{ pendingDays }} ngày sẽ bị xóa ngay. Không thể hoàn tác.
        </p>
        <div class="model-uninstall-actions">
          <button class="quiet-button danger-button" @click="applyKeepDays(pendingDays)">
            Xóa và áp dụng
          </button>
          <button class="quiet-button" @click="pendingDays = null">Hủy</button>
        </div>
      </div>
      <div class="model-details">
        <details
          :open="changeOpen"
          @toggle="
            changeOpen = ($event.target as HTMLDetailsElement).open;
            if (changeOpen) notice = '';
          "
        >
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
            <p v-if="nextMismatch" class="input-error" role="alert">
              Hai lần nhập chưa giống nhau.
            </p>
            <p v-else-if="vault.error.value" class="input-error" role="alert">
              {{ vault.error.value }}
            </p>
            <button class="quiet-button" type="submit" :disabled="!changeReady || vault.busy.value">
              Đổi mật mã
            </button>
          </form>
        </details>
        <!-- The one destructive action stays tucked away; opening it is the first step. -->
        <details>
          <summary>Bỏ mật mã</summary>
          <div class="model-uninstall">
            <p>
              Xóa {{ privateCount }} mục trong lịch sử, bỏ mật mã và tắt lịch sử. Không thể hoàn
              tác.
            </p>
            <button class="quiet-button danger-button" :disabled="vault.busy.value" @click="wipe">
              Xóa và bỏ mật mã
            </button>
          </div>
        </details>
      </div>
    </template>
  </section>
</template>
