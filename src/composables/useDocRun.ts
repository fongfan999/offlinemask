import { computed, ref, shallowRef, watch, type Ref } from "vue";
import {
  exportName,
  saveFile,
  SheetAdapterError,
  type SheetFiles,
} from "../adapters/sheet-files.ts";
import { maxDocBytes, type DocEdits, type DocParagraph, type DocError } from "../core/doc/docx.ts";
import { maskParagraphs, previewParagraphs, restoreParagraphs } from "../core/doc/mask.ts";
import { detectionOptions, localOptions, type DetectionOption } from "../core/detection/options.ts";
import type { Detection } from "../core/detection/types.ts";
import { aliasScope, newSessionId, type DocSession, type Session } from "../core/sessions.ts";
import type { TextDetector } from "./useMaskingRun.ts";
import { scanTexts } from "./scanTexts.ts";
import type { SheetProgress } from "./useSheetRun.ts";

export const docPreviewParagraphs = 20;
export const docErrorMessages: Record<DocError, string> = {
  unsupported: "Chỉ hỗ trợ tệp .docx. Tệp .doc cũ hãy mở bằng Word và lưu lại thành .docx trước.",
  "too-large": "Tệp lớn hơn 20 MB. Hãy chia nhỏ tài liệu rồi thử lại.",
  unreadable: "Chưa đọc được tệp này. Hãy kiểm tra tệp có mở được trong Word không.",
  empty: "Tài liệu không có chữ để ẩn.",
};
export const docFailure =
  "Chưa xử lý được tài liệu trên thiết bị. Tệp gốc không bị thay đổi. Hãy thử lại.";
const docxName = /\.docx$/i;

export interface DocDraft {
  sessionId: string;
  fileName: string;
  handle: string;
  paragraphs: DocParagraph[];
  notes: string[];
  mailto: string[];
}
export interface DocRestore {
  fileName: string;
  handle: string;
  paragraphs: DocParagraph[];
  edits: DocEdits;
  restored: number;
  unknown: string[];
}
interface Original {
  handle: string;
  edits: DocEdits;
  paragraphs: DocParagraph[];
  notes: string[];
  mailto: string[];
}
export interface DocRunDependencies {
  detector: TextDetector;
  files: SheetFiles;
  pack: { ready: Ref<boolean>; readyRoot: Ref<string | null> };
  sessions: Ref<readonly Session[]>;
  onSession: (session: Session) => void;
}

function errorMessage(error: unknown) {
  return error instanceof SheetAdapterError && error.code in docErrorMessages
    ? docErrorMessages[error.code as DocError]
    : docErrorMessages.unreadable;
}

/** The Word flow (decision 0078): open a .docx, preview the first paragraphs with the
 * aliases they will get, mask every paragraph in the background, save a masked copy,
 * and later restore the AI's returned document. Documents stay in the worker, in RAM. */
export function useDocRun({ detector, files, pack, sessions, onSession }: DocRunDependencies) {
  const draft = shallowRef<DocDraft | null>(null);
  const opening = ref(false);
  const fileError = ref("");
  const processing = ref(false);
  const progress = ref<SheetProgress | null>(null);
  const processingError = ref("");
  const previewDetections = shallowRef(new Map<number, Detection[]>());
  const previewScanning = ref(false);
  const originals = new Map<string, Original>();
  let cancelled = false;

  const options = computed<DetectionOption[]>(() =>
    pack.ready.value ? detectionOptions.map((option) => option.id) : [...localOptions],
  );
  const scan = (
    items: { key: number; text: string }[],
    report?: (step: { stage: "loading" | "reading"; done: number; total: number }) => void,
    into = new Map<number, Detection[]>(),
    stopped: () => boolean = () => false,
  ) =>
    scanTexts(
      detector,
      items,
      options.value,
      pack.readyRoot.value ?? undefined,
      report,
      into,
      stopped,
    );

  /** First paragraphs with the aliases they will get. */
  const preview = computed(() => {
    const current = draft.value;
    if (!current) return [];
    const head = current.paragraphs.slice(0, docPreviewParagraphs);
    const result = maskParagraphs(head, previewDetections.value, aliasScope(current.sessionId));
    return previewParagraphs(head, result.edits.paragraphs, docPreviewParagraphs);
  });
  let previewRun = 0;
  watch([draft, options], async () => {
    const run = ++previewRun;
    const head = (draft.value?.paragraphs ?? []).slice(0, docPreviewParagraphs);
    if (!head.length) return;
    previewScanning.value = true;
    try {
      const found = await scan(
        head.map((paragraph) => ({ key: paragraph.id, text: paragraph.text })),
      );
      if (run === previewRun) previewDetections.value = found;
    } catch {
      // The preview stays unmasked; masking the whole document reports its own errors.
    } finally {
      if (run === previewRun) previewScanning.value = false;
    }
  });

  function release(handle: string) {
    const used =
      draft.value?.handle === handle ||
      [...originals.values()].some((original) => original.handle === handle);
    if (!used) files.close(handle);
  }
  async function openFile(file: File) {
    fileError.value = "";
    if (!docxName.test(file.name)) {
      fileError.value = docErrorMessages.unsupported;
      return;
    }
    if (file.size > maxDocBytes) {
      fileError.value = docErrorMessages["too-large"];
      return;
    }
    opening.value = true;
    try {
      const opened = await files.openDoc(file);
      discardDraft();
      previewDetections.value = new Map();
      draft.value = {
        sessionId: newSessionId(sessions.value),
        fileName: file.name,
        handle: opened.handle,
        paragraphs: opened.paragraphs,
        notes: opened.notes,
        mailto: opened.mailto,
      };
    } catch (error) {
      fileError.value = errorMessage(error);
    } finally {
      opening.value = false;
    }
  }
  function discardDraft() {
    const handle = draft.value?.handle;
    draft.value = null;
    if (handle) release(handle);
  }
  function prune() {
    for (const [id, original] of originals)
      if (!sessions.value.some((session) => session.id === id)) {
        originals.delete(id);
        release(original.handle);
      }
  }

  async function maskAll(): Promise<DocSession | undefined> {
    const current = draft.value;
    if (!current || processing.value) return;
    processing.value = true;
    processingError.value = "";
    cancelled = false;
    const startedAt = Date.now();
    progress.value = { stage: "loading", done: 0, total: 0, startedAt };
    try {
      const detections = await scan(
        current.paragraphs.map((paragraph) => ({ key: paragraph.id, text: paragraph.text })),
        (step) => (progress.value = { ...step, startedAt }),
        new Map(),
        () => cancelled,
      );
      progress.value = { stage: "masking", done: 0, total: 0, startedAt };
      const id = sessions.value.some((s) => aliasScope(s.id) === aliasScope(current.sessionId))
        ? newSessionId(sessions.value)
        : current.sessionId;
      const result = maskParagraphs(current.paragraphs, detections, aliasScope(id), current.mailto);
      const session: DocSession = {
        id,
        number: sessions.value.reduce((max, s) => Math.max(max, s.number), 0) + 1,
        format: "word",
        fixture: "private-doc-v1",
        createdAt: new Date().toISOString(),
        fileName: current.fileName,
        paragraphs: current.paragraphs.length,
        preview: previewParagraphs(
          current.paragraphs,
          result.edits.paragraphs,
          docPreviewParagraphs,
        ),
        findings: result.findings,
        masked: result.masked,
      };
      originals.set(id, {
        handle: current.handle,
        edits: result.edits,
        paragraphs: current.paragraphs,
        notes: current.notes,
        mailto: current.mailto,
      });
      draft.value = null;
      onSession(session);
      prune();
      return session;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError") && !cancelled)
        processingError.value = docFailure;
    } finally {
      processing.value = false;
      progress.value = null;
    }
  }
  function cancelMask() {
    if (!processing.value) return;
    cancelled = true;
    detector.cancel(true);
  }
  function canReopen(session: DocSession) {
    return originals.has(session.id);
  }
  /** Step 1 of a masked document: the same file, ready to mask again as a new session. */
  function reopen(session: DocSession) {
    const original = originals.get(session.id);
    if (!original) return false;
    const previous = draft.value?.handle;
    previewDetections.value = new Map();
    draft.value = {
      sessionId: newSessionId(sessions.value),
      fileName: session.fileName,
      handle: original.handle,
      paragraphs: original.paragraphs,
      notes: original.notes,
      mailto: original.mailto,
    };
    if (previous && previous !== original.handle) release(previous);
    return true;
  }
  async function download(session: DocSession): Promise<boolean> {
    const original = originals.get(session.id);
    if (!original) return false;
    const bytes = await files.writeDoc(original.handle, original.edits);
    return saveFile(bytes, exportName(session.fileName, "đã ẩn"));
  }
  async function openReturned(session: DocSession, file: File): Promise<DocRestore | string> {
    if (!docxName.test(file.name)) return docErrorMessages.unsupported;
    if (file.size > maxDocBytes) return docErrorMessages["too-large"];
    try {
      const opened = await files.openDoc(file);
      const result = restoreParagraphs(opened.paragraphs, session.findings, opened.mailto);
      return {
        fileName: file.name,
        handle: opened.handle,
        paragraphs: opened.paragraphs,
        ...result,
      };
    } catch (error) {
      return errorMessage(error);
    }
  }
  async function downloadRestored(restore: DocRestore): Promise<boolean> {
    const bytes = await files.writeDoc(restore.handle, restore.edits);
    return saveFile(
      bytes,
      exportName(restore.fileName.replace(/ \(đã ẩn\)(?=\.[^.]+$)/, ""), "đã khôi phục"),
    );
  }
  function closeReturned(restore: DocRestore | null) {
    if (restore) files.close(restore.handle);
  }

  return {
    draft,
    opening,
    fileError,
    processing,
    progress,
    processingError,
    previewScanning,
    preview,
    openFile,
    discardDraft,
    maskAll,
    cancelMask,
    canReopen,
    reopen,
    download,
    openReturned,
    downloadRestored,
    closeReturned,
  };
}
export type DocRun = ReturnType<typeof useDocRun>;
