<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import { formatModelBytes as sizes, type ModelStatus } from "../adapters/models";
import { recognitionPack } from "../core/detection/pack.ts";
const props = defineProps<{
  status: ModelStatus;
  desktop: boolean;
  busy: boolean;
  error: string;
  /** A masking run may be using the pack; uninstalling waits for it. */
  processing: boolean;
}>();
const emit = defineEmits<{ download: []; pause: []; uninstall: [] }>();
const confirmingUninstall = ref(false);
watch(
  () => props.status.stage,
  (stage) => {
    if (stage !== "ready") confirmingUninstall.value = false;
  },
);
function uninstall() {
  confirmingUninstall.value = false;
  emit("uninstall");
}
const installing = computed(
  () =>
    props.status.stage === "installing" ||
    (props.status.stage === "cancelling" && props.status.installed > 0),
);
const progressBytes = computed(() =>
  installing.value ? props.status.installed : props.status.downloaded,
);
const progressTotal = computed(() =>
  installing.value ? props.status.installedBytes : props.status.total,
);
const progress = computed(() =>
  Math.min(100, Math.floor((progressBytes.value / Math.max(1, progressTotal.value)) * 100)),
);
const downloading = computed(() =>
  ["downloading", "installing", "cancelling"].includes(props.status.stage),
);
// No badge while the launch check looks for the pack, nor before it is downloaded.
const labels: Partial<Record<ModelStatus["stage"], string>> = {
  downloading: "Đang tải",
  installing: "Đang cài đặt",
  cancelling: "Đang tạm dừng",
  paused: "Đã tạm dừng",
  error: "Chưa hoàn tất",
  ready: "Sẵn sàng",
};
const errorMessage = computed(() => {
  if (props.error) return props.error;
  if (["storage", "space"].includes(props.status.error ?? ""))
    return "Không đủ dung lượng hoặc không lưu được gói nhận diện. Giải phóng dung lượng rồi thử lại.";
  if (["checksum", "archive"].includes(props.status.error ?? ""))
    return "Tệp chưa hợp lệ. Thử lại để kiểm tra và tải lại phần bị lỗi.";
  if (props.status.error === "unavailable") return "Gói nhận diện chưa có bản tải về.";
  return "Chưa hoàn tất gói nhận diện. Kiểm tra kết nối rồi thử lại; các phần đã tải sẽ được giữ lại.";
});
</script>
<template>
  <section class="model-settings glass glass-card" aria-labelledby="model-title">
    <div class="model-card-heading">
      <h2 id="model-title">{{ recognitionPack.name }}</h2>
      <span
        v-if="labels[status.stage]"
        class="model-badge"
        :class="{ installed: status.stage === 'ready' }"
        >{{ labels[status.stage] }}</span
      >
    </div>
    <p class="model-description">Nhận diện họ tên, địa chỉ và thông tin riêng tư khác.</p>
    <div
      v-if="downloading || status.stage === 'paused' || status.stage === 'error'"
      class="download-progress"
    >
      <div>
        <span>{{
          installing
            ? status.installed === status.installedBytes
              ? "Đang kiểm tra lần cuối…"
              : "Đang cài đặt trên máy…"
            : `${sizes(status.downloaded)} / ${sizes(status.total)}`
        }}</span
        ><span>{{ progress }}%</span>
      </div>
      <progress
        :value="progressBytes"
        :max="progressTotal"
        :aria-label="installing ? 'Tiến độ cài đặt gói nhận diện' : 'Tiến độ tải gói nhận diện'"
      ></progress>
      <p>
        {{
          status.stage === "paused"
            ? "Phần đã tải được giữ lại."
            : status.stage === "cancelling"
              ? "Đang kết thúc phần tải hiện tại…"
              : "Bạn có thể tiếp tục dùng ứng dụng trong khi tải."
        }}
      </p>
    </div>
    <p v-if="error || status.stage === 'error'" class="model-error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="!desktop" class="model-description">
      Mở ứng dụng OfflineMask trên máy tính để tải gói nhận diện.
    </p>
    <p v-if="status.stage === 'checking'" class="model-checking" role="status">
      Đang tìm gói trên máy…
    </p>
    <div v-else class="model-download-actions">
      <div
        v-if="!downloading && status.stage !== 'paused' && status.stage !== 'error'"
        class="download-size"
      >
        <strong>{{ sizes(status.stage === "ready" ? status.installedBytes : status.total) }}</strong
        ><span>{{
          status.stage === "ready"
            ? "Đã cài trên máy"
            : status.installedBytes !== status.total
              ? `Tải một lần · chiếm ${sizes(status.installedBytes)} trên máy`
              : "Chỉ cần tải một lần"
        }}</span>
      </div>
      <button
        v-if="downloading"
        class="quiet-button"
        :disabled="busy || status.stage === 'cancelling'"
        @click="$emit('pause')"
      >
        {{ status.stage === "cancelling" ? "Đang tạm dừng…" : "Tạm dừng" }}
      </button>
      <button
        v-else-if="status.stage !== 'ready'"
        class="primary-action"
        :disabled="!desktop || busy"
        @click="$emit('download')"
      >
        <AppIcon name="download" :size="17" />{{
          status.stage === "paused"
            ? "Tiếp tục tải"
            : status.stage === "error"
              ? "Thử lại"
              : "Tải về"
        }}
      </button>
    </div>
    <div class="model-details">
      <details>
        <summary>Chi tiết</summary>
        <p>{{ recognitionPack.attribution }}</p>
        <div v-if="status.stage === 'ready'" class="model-uninstall">
          <template v-if="confirmingUninstall">
            <p>
              Gỡ gói sẽ xóa {{ sizes(status.installedBytes) }} khỏi máy. Muốn tự ẩn họ tên và địa
              chỉ lại, bạn cần tải lại {{ sizes(status.total) }}.
            </p>
            <div class="model-uninstall-actions">
              <button class="quiet-button danger-button" :disabled="busy" @click="uninstall">
                Gỡ gói
              </button>
              <button class="quiet-button" @click="confirmingUninstall = false">Hủy</button>
            </div>
          </template>
          <template v-else>
            <button
              class="quiet-button"
              :disabled="busy || processing"
              @click="confirmingUninstall = true"
            >
              Gỡ gói nhận diện
            </button>
            <p v-if="processing">Chờ lượt xử lý hiện tại xong để gỡ gói.</p>
          </template>
        </div>
      </details>
    </div>
  </section>
</template>
