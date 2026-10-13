import { computed, ref, watch, type Ref } from "vue";
import type { createTextDetector } from "../adapters/text-detection.ts";
import {
  detectionOptions,
  localOptions,
  requiresModels,
  type DetectionOption,
} from "../core/detection/options.ts";
import type { DetectionProgress } from "../core/detection/types.ts";
import { createTextSession, type Format, type Session } from "../core/sessions.ts";
import { validateText } from "../core/text.ts";

export const loadingStatus = "Đang chuẩn bị… Lần đầu có thể mất một lúc.";
export const processingFailure =
  "Chưa xử lý được văn bản trên thiết bị. Nội dung vẫn được giữ nguyên. Hãy thử lại hoặc kiểm tra gói nhận diện trong Cài đặt.";
export function processingStatusFor(progress: DetectionProgress): string {
  return progress.stage === "loading"
    ? loadingStatus
    : `Đang phân tích ${Math.round((progress.completed / progress.total) * 100)}%…`;
}

export type TextDetector = Pick<
  ReturnType<typeof createTextDetector>,
  "detect" | "prepare" | "cancel" | "destroy"
>;
export interface MaskingRunDependencies {
  detector: TextDetector;
  pack: { ready: Ref<boolean>; readyRoot: Ref<string | null> };
  sessions: Ref<readonly Session[]>;
  /** Receives every finished session. The caller decides whether to show it. */
  onSession: (session: Session) => void;
}

/** The draft, category choices and one in-flight detection run. The run keeps
 * going while the user navigates; the shell decides where its session lands.
 */
export function useMaskingRun({ detector, pack, sessions, onSession }: MaskingRunDependencies) {
  const draft = ref("");
  const selectedOptions = ref<DetectionOption[]>([...localOptions]);
  const selectionEdited = ref(false);
  const processing = ref(false);
  const processingStatus = ref("");
  const processingError = ref("");
  const draftError = computed(() => validateText(draft.value));
  const missingSelectedModels = computed(
    () => requiresModels(selectedOptions.value) && !pack.ready.value,
  );
  let currentRun = 0;
  let preparedRoot: string | null = null;

  // Prepare installed weights as soon as they are verified, and offer every
  // category once, unless the user already made their own selection.
  watch(
    pack.readyRoot,
    (root) => {
      if (!root) {
        // An uninstalled pack must not stay loaded in the detector.
        if (preparedRoot) cancel();
        preparedRoot = null;
        return;
      }
      if (!selectionEdited.value)
        selectedOptions.value = detectionOptions.map((option) => option.id);
      if (preparedRoot !== root) {
        preparedRoot = root;
        detector.prepare(root);
      }
    },
    { immediate: true },
  );

  function cancel(preserveModels = false) {
    currentRun++;
    detector.cancel(preserveModels);
    processing.value = false;
    processingStatus.value = "";
  }
  function destroy() {
    currentRun++;
    detector.destroy();
  }
  async function mask(format: Format): Promise<Session | undefined> {
    // Spreadsheets have their own flow (useSheetRun, decision 0076).
    if (format !== "text") return;
    if (
      processing.value ||
      draftError.value ||
      !selectedOptions.value.length ||
      missingSelectedModels.value
    )
      return;
    processing.value = true;
    processingError.value = "";
    const run = ++currentRun;
    const original = draft.value;
    const options = [...selectedOptions.value];
    try {
      const modelRoot = pack.readyRoot.value ?? undefined;
      const detections = await detector.detect(
        original,
        (progress) => {
          if (run === currentRun) processingStatus.value = processingStatusFor(progress);
        },
        modelRoot,
        options,
      );
      if (run !== currentRun) return;
      const session = createTextSession(original, sessions.value, detections, options);
      draft.value = "";
      onSession(session);
      return session;
    } catch {
      if (run === currentRun) processingError.value = processingFailure;
    } finally {
      if (run === currentRun) {
        processing.value = false;
        processingStatus.value = "";
      }
    }
  }
  return {
    draft,
    selectedOptions,
    selectionEdited,
    processing,
    processingStatus,
    processingError,
    draftError,
    missingSelectedModels,
    mask,
    cancel,
    destroy,
  };
}
