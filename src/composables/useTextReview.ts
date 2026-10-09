import { nextTick, ref, type Ref } from "vue";
import { addManualMask, previewSelection, type SourceSelection } from "../core/manual-mask.ts";
import type { Session, TextSession } from "../core/sessions.ts";

export const reviewHint = "Bôi đen phần còn sót để ẩn thêm.";
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
      session.id.slice(0, 8),
      selection.range,
      session.manualMaskCount,
    );
    session.reviewUndo = { analysis: session.analysis, decisions: { ...session.decisions } };
    session.manualMaskCount = update.manualMaskCount;
    session.analysis = update.analysis;
    session.decisions = update.decisions;
    options.view.value = "masked";
    selectedText.value = null;
    reviewStatus.value = hiddenMessage;
    await nextTick();
    const element = options.element();
    element?.focus();
    element?.setSelectionRange(0, 0);
    return true;
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
  return { selectedText, reviewStatus, captureSelection, hideSelection, undoManualMask, clear };
}
