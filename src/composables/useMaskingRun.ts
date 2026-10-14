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
import { decodeText } from "../core/decode-text.ts";
import { maxTextLength, validateText } from "../core/text.ts";
import type { SheetProgress } from "./useSheetRun.ts";

export const processingFailure =
  "Chưa xử lý được văn bản trên thiết bị. Nội dung vẫn được giữ nguyên. Hãy thử lại hoặc kiểm tra gói nhận diện trong Cài đặt.";
/** Detector progress in the shape the shared progress panel shows (decision 0082).
 * `completed` is fractional across the pack's models, so it is scaled to whole steps. */
export function textProgress(progress: DetectionProgress, startedAt: number): SheetProgress {
  return progress.stage === "loading"
    ? { stage: "loading", done: 0, total: 0, startedAt }
    : {
        stage: "reading",
        done: Math.round((progress.completed / Math.max(1, progress.total)) * 1000),
        total: 1000,
        startedAt,
      };
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
  const progress = ref<SheetProgress | null>(null);
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
    progress.value = null;
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
    const startedAt = Date.now();
    progress.value = { stage: "loading", done: 0, total: 0, startedAt };
    try {
      const modelRoot = pack.readyRoot.value ?? undefined;
      const detections = await detector.detect(
        original,
        (step) => {
          if (run === currentRun) progress.value = textProgress(step, startedAt);
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
        progress.value = null;
      }
    }
  }
  /** A .txt or .md file becomes the draft (decision 0083); an error message otherwise.
   * Four bytes per character is the most UTF-8 needs, so larger files are refused unread. */
  async function openTextFile(file: File): Promise<string> {
    if (processing.value) return "Trang Văn bản đang ẩn một văn bản khác. Hãy thử lại khi xong.";
    const text =
      file.size > maxTextLength * 4 ? null : decodeText(new Uint8Array(await file.arrayBuffer()));
    if (text === null || text.length > maxTextLength)
      return `Tệp văn bản dài hơn ${maxTextLength.toLocaleString("vi-VN")} ký tự. Hãy chia nhỏ rồi dán từng phần.`;
    if (!text.trim()) return "Tệp không có chữ để ẩn.";
    draft.value = text;
    processingError.value = "";
    return "";
  }
  return {
    openTextFile,
    draft,
    selectedOptions,
    selectionEdited,
    processing,
    progress,
    processingError,
    draftError,
    missingSelectedModels,
    mask,
    cancel,
    destroy,
  };
}
