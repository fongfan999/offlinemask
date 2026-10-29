import { computed, ref, watch, type Ref } from "vue";
import { memoryRefusal } from "./memoryBudget.ts";
import type { createTextDetector } from "../adapters/text-detection.ts";
import {
  detectionOptions,
  localOptions,
  requiresModels,
  type DetectionOption,
} from "../core/detection/options.ts";
import type { DetectionProgress } from "../core/detection/types.ts";
import {
  createTextSession,
  type Format,
  type Session,
  type TextSession,
} from "../core/sessions.ts";
import { carryDetections } from "../core/detection/carry.ts";
import { filterDetections } from "../core/detection/options.ts";
import { localDetections } from "../core/detection/policy.ts";
import { decodeText } from "../core/decode-text.ts";
import { validateText } from "../core/text.ts";
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

const warmUpInterval = 60_000;
/** Synthetic, so the warm-up never touches real input: every model sees a name and an address. */
const warmUpText = "Nguyễn Văn An, 12 Lê Lợi, Quận 1, TP. Hồ Chí Minh, a@example.com";

export type TextDetector = Pick<
  ReturnType<typeof createTextDetector>,
  "detect" | "prepare" | "cancel" | "destroy"
>;
type Detections = Awaited<ReturnType<TextDetector["detect"]>>;
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
  let lastWarmUp = 0;

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
        lastWarmUp = 0;
        warmUp();
      }
    },
    { immediate: true },
  );

  /** Loaded weights still pay for their first inference and the native tokenizer, and
   * macOS compresses the idle model memory: one throwaway run on synthetic text puts
   * them back before the user masks. Runs once the pack is ready and when the window
   * comes back to the front, at most once a minute; queued like any request, nothing kept. */
  function warmUp() {
    const root = pack.readyRoot.value;
    if (!root || processing.value || Date.now() - lastWarmUp < warmUpInterval) return;
    lastWarmUp = Date.now();
    void detector
      .detect(
        warmUpText,
        () => {},
        root,
        detectionOptions.map((option) => option.id),
      )
      .catch(() => {});
  }
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
  /** One detection run over `original`, ending in a session handed to `onSession`
   * when `adopt` agrees. Returns undefined when a newer run superseded it; throws
   * when detection failed. */
  async function detectSession(
    original: string,
    options: readonly DetectionOption[],
    adopt: (session: TextSession) => boolean = () => true,
    known?: Detections,
  ): Promise<TextSession | undefined> {
    processing.value = true;
    processingError.value = "";
    const run = ++currentRun;
    const startedAt = Date.now();
    progress.value = { stage: "loading", done: 0, total: 0, startedAt };
    try {
      const modelRoot = pack.readyRoot.value ?? undefined;
      const detections =
        known ??
        (await detector.detect(
          original,
          (step) => {
            if (run === currentRun) progress.value = textProgress(step, startedAt);
          },
          modelRoot,
          [...options],
        ));
      if (run !== currentRun) return;
      const session = createTextSession(original, sessions.value, detections, options);
      if (adopt(session)) onSession(session);
      return session;
    } catch (error) {
      // A cancelled or superseded run fails quietly; only the current one reports.
      if (run !== currentRun) return;
      throw error;
    } finally {
      if (run === currentRun) {
        processing.value = false;
        progress.value = null;
      }
    }
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
    const original = draft.value;
    try {
      const session = await detectSession(original, selectedOptions.value);
      if (session) draft.value = "";
      return session;
    } catch {
      processingError.value = processingFailure;
    }
  }
  /** Mask text that did not come through the draft (the clipboard quick action,
   * decision 0090). The draft stays untouched; a run already in flight wins. A
   * result with nothing to hide is returned but not adopted, so it neither replaces
   * the text on screen (decision 0072) nor lands in history. */
  async function maskText(
    text: string,
  ): Promise<{ session: TextSession } | { error: "busy" | "invalid" | "failed"; message: string }> {
    const invalid = validateText(text);
    if (invalid) return { error: "invalid", message: invalid };
    if (processing.value) return { error: "busy", message: "" };
    const { options, run } = quickRun();
    // The detector runs one request at a time, and the circle's check in flight may be
    // this very text: wait for it rather than queue a second detection behind it.
    waiting = null;
    if (checking) await checking.detections.catch(() => {});
    // The circle's check already ran this detection: use it (decisions 0100, 0131).
    const known = lastQuick ? await reuse(text, run, options) : undefined;
    lastQuick = null;
    try {
      const session = await detectSession(
        text,
        options,
        (candidate) => candidate.analysis.findings.length > 0,
        known,
      );
      if (!session) return { error: "busy", message: "" };
      return { session };
    } catch {
      return { error: "failed", message: processingFailure };
    }
  }
  /** Quick actions hide as much as possible (decision 0096): every category the
   * machine can run, whatever is ticked on the text page; the built-in ones without
   * the pack. `run` ties a check to the run a click would make. */
  function quickRun() {
    const options: DetectionOption[] = pack.ready.value
      ? detectionOptions.map((option) => option.id)
      : [...localOptions];
    const root = pack.readyRoot.value ?? undefined;
    return { options, root, run: `${root ?? ""}\n${options.join(",")}` };
  }
  type Check = { run: string; text: string; detections: Promise<Detections> };
  /** The circle's last check, in memory only, for the click that usually follows. It
   * is kept while it runs, so the click can wait for it (decision 0131). */
  let lastQuick: Check | null = null;
  /** The check the detector is running now, and the newest selection waiting for it.
   * Only one check runs at a time: a selection replaced before its turn is never
   * checked, so a burst of selections cannot queue detections behind a click. */
  let checking: Check | null = null;
  let waiting: string | null = null;
  function startCheck(text: string): Check {
    const { options, root, run } = quickRun();
    const check = { run, text, detections: detector.detect(text, () => {}, root, [...options]) };
    lastQuick = checking = check;
    void check.detections
      .catch(() => {})
      .finally(() => {
        if (checking === check) checking = null;
      });
    return check;
  }
  /** The detections for `text`, from the check of that text if one exists; null when a
   * newer selection or a click took its turn. */
  async function check(text: string): Promise<Detections | null> {
    const { run } = quickRun();
    if (lastQuick?.run === run && lastQuick.text === text) return lastQuick.detections;
    if (checking) {
      waiting = text;
      while (checking) await checking.detections.catch(() => {});
      if (waiting !== text) return null;
      waiting = null;
    }
    return startCheck(text).detections;
  }
  /** The last check's detections as the click's, when it checked this text or the same
   * text with other whitespace. Line breaks the check did not see can change what the
   * built-in rules match, so they run again on the click's text; overlaps are resolved
   * as usual when the session is built. */
  async function reuse(
    text: string,
    run: string,
    options: readonly DetectionOption[],
  ): Promise<Detections | undefined> {
    const last = lastQuick;
    if (!last || last.run !== run) return;
    const detections = await last.detections.catch(() => undefined);
    if (!detections) return;
    if (last.text === text) return detections;
    const carried = carryDetections(detections, last.text, text);
    if (!carried) return;
    return [...carried, ...filterDetections(localDetections(text), options)];
  }
  /** Whether the built-in rules alone find something to hide: instant, no models. A
   * full check keeps every rule finding, so a yes here is a yes for the click. */
  function rulesFind(text: string): boolean {
    if (validateText(text)) return false;
    return filterDetections(localDetections(text), quickRun().options).length > 0;
  }
  /** How many values a click on the circle would hide (decision 0100): the very same
   * detection as `maskText`, models included, so the two cannot disagree. No session,
   * no progress, no draft; a failure, or a selection replaced before its turn, counts
   * as nothing. */
  async function probe(text: string): Promise<{ count: number; kinds: string[] }> {
    const nothing = { count: 0, kinds: [] };
    if (validateText(text)) return nothing;
    try {
      const detections = await check(text);
      if (!detections) return nothing;
      // Distinct values, like the "Đã ẩn n thông tin" count after masking.
      const values = new Set(detections.map((d) => d.type + ":" + text.slice(d.start, d.end)));
      return { count: values.size, kinds: [...new Set(detections.map((d) => d.label))] };
    } catch {
      return nothing;
    }
  }
  /** A .txt or .md file becomes the draft (decision 0083); an error message otherwise.
   * Any length the app's memory budget allows: the page says how long it will take
   * (decision 0173). */
  async function openTextFile(file: File): Promise<string> {
    if (processing.value) return "Trang Văn bản đang ẩn một văn bản khác. Hãy thử lại khi xong.";
    const refused = await memoryRefusal(file);
    if (refused) return refused;
    const text = decodeText(new Uint8Array(await file.arrayBuffer()));
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
    maskText,
    probe,
    rulesFind,
    warmUp,
    cancel,
    destroy,
  };
}
