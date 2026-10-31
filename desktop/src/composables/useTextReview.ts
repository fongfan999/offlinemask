import { nextTick, ref, type Ref } from "vue";
import {
  addManualMask,
  addManualMasks,
  previewSelection,
  unmaskedOccurrences,
  type SourceSelection,
} from "../core/manual-mask.ts";
import type { TextAnalysis } from "../core/text.ts";
import { aliasScope, type Session, type TextSession } from "../core/sessions.ts";

export const reviewHint = "Thấy tên hay số nào còn sót? Bôi đen là ẩn ngay.";
export const hiddenMessage = "Đã ẩn phần đã chọn.";
export const undoneMessage = "Đã hoàn tác lần ẩn thêm vừa rồi.";

export type ReviewView = "original" | "masked";
export interface ReviewSelection {
  sessionId: string;
  text: string;
  view: ReviewView;
  range: SourceSelection;
}
type SelectionElement = Pick<
  HTMLTextAreaElement,
  "selectionStart" | "selectionEnd" | "focus" | "setSelectionRange"
>;

export interface TextReviewOptions {
  session: () => Session | undefined;
  view: Ref<ReviewView>;
  visibleText: () => string;
  element: () => SelectionElement | null | undefined;
  manualCopy: () => boolean;
}

/** Manual correction of a private text session: select missed text in either
 * view, hide that occurrence, undo the last correction. Nothing is persisted.
 */
export function useTextReview(options: TextReviewOptions) {
  const selectedText = ref<ReviewSelection | null>(null);
  const reviewStatus = ref("");

  function privateSession(): TextSession | undefined {
    const session = options.session();
    return session?.fixture === "private-text-v1" ? session : undefined;
  }
  function clear() {
    selectedText.value = null;
    reviewStatus.value = "";
  }
  function captureSelection() {
    const session = privateSession();
    const element = options.element();
    selectedText.value = null;
    if (!session || !element || options.manualCopy()) return;
    const range = previewSelection(
      session.original,
      session.analysis,
      session.decisions,
      options.view.value === "masked",
      element.selectionStart,
      element.selectionEnd,
    );
    if (range) {
      selectedText.value = {
        sessionId: session.id,
        text: options.visibleText(),
        view: options.view.value,
        range,
      };
    }
  }
  async function hideSelection() {
    const session = privateSession();
    const selection = selectedText.value;
    if (
      !session ||
      !selection ||
      session.id !== selection.sessionId ||
      selection.text !== options.visibleText() ||
      selection.view !== options.view.value
    )
      return false;
    const update = addManualMask(
      session.original,
      session.analysis,
      session.decisions,
      aliasScope(session.id),
      selection.range,
      session.manualMaskCount,
    );
    apply(session, update);
    reviewStatus.value = hiddenMessage;
    await nextTick();
    const element = options.element();
    element?.focus();
    element?.setSelectionRange(0, 0);
    return true;
  }
  /** One click on a likely name in the warning: every clear-text occurrence of it
   * shares one new alias, undoable like any manual correction. */
  async function hideOccurrences(value: string) {
    const session = privateSession();
    if (!session) return false;
    const ranges = unmaskedOccurrences(session.original, session.analysis, value);
    if (!ranges.length) return false;
    apply(
      session,
      addManualMasks(
        session.original,
        session.analysis,
        session.decisions,
        aliasScope(session.id),
        ranges,
        session.manualMaskCount,
      ),
    );
    reviewStatus.value =
      ranges.length === 1 ? `Đã ẩn "${value}".` : `Đã ẩn "${value}" ở ${ranges.length} chỗ.`;
    return true;
  }
  function apply(
    session: TextSession,
    update: {
      analysis: TextAnalysis;
      decisions: TextSession["decisions"];
      manualMaskCount: number;
    },
  ) {
    session.reviewUndo = { analysis: session.analysis, decisions: { ...session.decisions } };
    session.manualMaskCount = update.manualMaskCount;
    session.analysis = update.analysis;
    session.decisions = update.decisions;
    options.view.value = "masked";
    selectedText.value = null;
  }
  async function undoManualMask() {
    const session = privateSession();
    if (!session?.reviewUndo) return false;
    const previous = session.reviewUndo;
    session.analysis = previous.analysis;
    session.decisions = previous.decisions;
    delete session.reviewUndo;
    selectedText.value = null;
    reviewStatus.value = undoneMessage;
    await nextTick();
    options.element()?.focus();
    return true;
  }
  return {
    selectedText,
    reviewStatus,
    captureSelection,
    hideSelection,
    hideOccurrences,
    undoManualMask,
    clear,
  };
}
