import { computed, ref, shallowRef, watch, type Ref } from "vue";
import {
  exportName,
  maskedSuffix,
  unmaskedSuffix,
  saveFile,
  SheetAdapterError,
  type SheetFiles,
  withoutMaskedSuffix,
} from "../adapters/sheet-files.ts";
import type { DocumentFormat } from "../core/doc/document.ts";
import { maxDocBytes, type DocEdits, type DocParagraph, type DocError } from "../core/doc/docx.ts";
import {
  editedAliases,
  editedPlaces,
  keepReplacements,
  maskParagraphs,
  previewLength,
  previewParagraphs,
  restoreParagraphs,
} from "../core/doc/mask.ts";
import { detectionOptions, localOptions, type DetectionOption } from "../core/detection/options.ts";
import type { Detection } from "../core/detection/types.ts";
import { countAliases, reviewGroups } from "../core/file-review.ts";
import type { Finding } from "../core/review.ts";
import { aliasScope, newSessionId, type DocSession, type Session } from "../core/sessions.ts";
import type { TextDetector } from "./useMaskingRun.ts";
import { scanTexts } from "./scanTexts.ts";
import { useKeptValues } from "./useKeptValues.ts";
import type { SheetProgress } from "./useSheetRun.ts";

export const docPreviewParagraphs = 20;
export const docErrorMessages: Record<DocError, string> = {
  unsupported:
    "Chỉ hỗ trợ tệp .docx, .odt và .pdf. Tệp .doc cũ hãy mở bằng Word và lưu lại thành .docx trước.",
  "too-large": "Tệp lớn hơn 20 MB. Hãy chia nhỏ tài liệu rồi thử lại.",
  unreadable:
    "Chưa đọc được tệp này. Hãy kiểm tra tệp mở được trong Word hoặc LibreOffice và không có mật khẩu.",
  empty: "Tài liệu không có chữ để ẩn.",
  password:
    "PDF này cần mật khẩu để mở. Hãy mở bằng trình đọc PDF, lưu lại bản không mật khẩu rồi thử lại.",
  "too-many-pages": "PDF dài hơn 300 trang. Hãy tách thành các tệp nhỏ hơn rồi thử lại.",
  scanned:
    "PDF này là ảnh scan. Máy này chưa đọc được chữ trong ảnh scan: cần macOS 14 trở lên; trên Windows sắp có.",
  "old-font":
    "Chữ trong PDF này dùng phông chữ cũ (như TCVN3, VNI) nên chưa đọc được. Hãy mở tệp gốc, chuyển sang Unicode rồi xuất lại PDF.",
  cancelled: "",
  "no-ocr": "Máy này chưa đọc được chữ trong hình ảnh: cần macOS 14 trở lên; trên Windows sắp có.",
};
export const docFailure =
  "Chưa xử lý được tài liệu trên thiết bị. Tệp gốc không bị thay đổi. Hãy thử lại.";
const documentName = /\.(docx|odt|pdf)$/i;
/** Pictures open on machines with text recognition (decision 0171). */
export const imageName = /\.(png|jpe?g)$/i;
/** What the AI may return for each kind of document: a document like the one sent, or,
 * for a PDF or a picture, whose masked copy is Markdown (decisions 0149, 0171), text or
 * a document. */
const returnedName = /\.(docx|odt)$/i;
const returnedForPdf = /\.(md|txt|docx|odt)$/i;
export const unsupportedReturn = "Chỉ khôi phục được tệp .md, .txt, .docx hoặc .odt.";
/** A PDF or picture session is told apart by its file name; its session data is a Word
 * one's. Its masked copy is text. */
export const isPdfSession = (session: { fileName: string }) =>
  /\.pdf$/i.test(session.fileName) || imageName.test(session.fileName);
/** "Hợp đồng.pdf" → "Hợp đồng (OfflineMasked).md"; a picture likewise. */
export function maskedName(fileName: string): string {
  const name = exportName(fileName, maskedSuffix);
  return isPdfSession({ fileName }) ? name.replace(/\.(pdf|png|jpe?g)$/i, ".md") : name;
}

export interface DocDraft {
  sessionId: string;
  fileName: string;
  format: DocumentFormat;
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
  format: DocumentFormat;
  edits: DocEdits;
  paragraphs: DocParagraph[];
  notes: string[];
  mailto: string[];
  /** Every value the document hid, before any is kept, and how often. */
  findings: Finding[];
  counts: Map<string, number>;
}
export interface DocRunDependencies {
  detector: TextDetector;
  files: SheetFiles;
  pack: { ready: Ref<boolean>; readyRoot: Ref<string | null> };
  /** Whether this machine reads text in pictures (decision 0171). */
  ocr: Ref<boolean>;
  sessions: Ref<readonly Session[]>;
  onSession: (session: Session) => void;
}

function errorMessage(error: unknown) {
  return error instanceof SheetAdapterError && error.code in docErrorMessages
    ? docErrorMessages[error.code as DocError]
    : docErrorMessages.unreadable;
}

/** The document flow (decisions 0078, 0084, 0149): open a .docx, .odt or .pdf, preview the first paragraphs with the
 * aliases they will get, mask every paragraph in the background, save a masked copy,
 * and later restore the AI's returned document. Documents stay in the worker, in RAM. */
export function useDocRun({ detector, files, pack, ocr, sessions, onSession }: DocRunDependencies) {
  const draft = shallowRef<DocDraft | null>(null);
  const opening = ref(false);
  /** Pages read while a PDF opens. */
  const openingProgress = ref<{ done: number; total: number } | null>(null);
  let openingAbort: AbortController | undefined;
  const fileError = ref("");
  const processing = ref(false);
  const progress = ref<SheetProgress | null>(null);
  const processingError = ref("");
  const previewDetections = shallowRef(new Map<number, Detection[]>());
  const previewScanning = ref(false);
  const originals = new Map<string, Original>();
  const kept = useKeptValues();
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
    const head = current.paragraphs.slice(
      0,
      previewLength(current.paragraphs, docPreviewParagraphs),
    );
    const result = maskParagraphs(head, previewDetections.value, aliasScope(current.sessionId));
    return previewParagraphs(head, result.edits.paragraphs, head.length);
  });
  let previewRun = 0;
  watch([draft, options], async () => {
    const run = ++previewRun;
    const paragraphs = draft.value?.paragraphs ?? [];
    const head = paragraphs.slice(0, previewLength(paragraphs, docPreviewParagraphs));
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
    if (imageName.test(file.name) && !ocr.value) {
      fileError.value = docErrorMessages["no-ocr"];
      return;
    }
    if (!documentName.test(file.name) && !imageName.test(file.name)) {
      fileError.value = docErrorMessages.unsupported;
      return;
    }
    if (file.size > maxDocBytes) {
      fileError.value = docErrorMessages["too-large"];
      return;
    }
    opening.value = true;
    openingProgress.value = null;
    const abort = (openingAbort = new AbortController());
    try {
      const opened = await files.openDoc(file, {
        progress: (done, total) => (openingProgress.value = { done, total }),
        signal: abort.signal,
        ocr: ocr.value,
      });
      discardDraft();
      previewDetections.value = new Map();
      draft.value = {
        sessionId: newSessionId(sessions.value),
        fileName: file.name,
        format: opened.format,
        handle: opened.handle,
        paragraphs: opened.paragraphs,
        notes: opened.notes,
        mailto: opened.mailto,
      };
    } catch (error) {
      if (!abort.signal.aborted) fileError.value = errorMessage(error);
    } finally {
      opening.value = false;
      openingProgress.value = null;
      openingAbort = undefined;
    }
  }
  /** Hủy while a PDF is read: the worker stops at the next page. */
  function cancelOpen() {
    openingAbort?.abort();
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
        kept.forget(id);
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
          previewLength(current.paragraphs, docPreviewParagraphs),
        ),
        findings: result.findings,
        masked: result.masked,
      };
      originals.set(id, {
        handle: current.handle,
        format: current.format,
        edits: result.edits,
        paragraphs: current.paragraphs,
        notes: current.notes,
        mailto: current.mailto,
        findings: result.findings,
        counts: countAliases(editedAliases(result.edits), result.findings),
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
      format: original.format,
      handle: original.handle,
      paragraphs: original.paragraphs,
      notes: original.notes,
      mailto: original.mailto,
    };
    if (previous && previous !== original.handle) release(previous);
    return true;
  }
  /** Hidden values of a masked document, while its file is open, for the review list. */
  function review(session: DocSession) {
    const original = originals.get(session.id);
    return original ? reviewGroups(original.findings, original.counts, kept.of(session.id)) : null;
  }
  /** Keep (or hide again) values everywhere in the document; the session's preview,
   * count and alias table follow, so restoring knows only what the file hides. */
  function setKept(session: DocSession, aliases: readonly string[], keep: boolean) {
    const original = originals.get(session.id);
    const stored = sessions.value.find((item) => item.id === session.id);
    if (!original || stored?.format !== "word") return;
    const now = kept.set(session.id, aliases, keep);
    const edits = keepReplacements(original.edits, now);
    stored.preview = previewParagraphs(
      original.paragraphs,
      edits.paragraphs,
      previewLength(original.paragraphs, docPreviewParagraphs),
    );
    stored.findings = original.findings.filter((finding) => !now.has(finding.alias));
    stored.masked = editedPlaces(edits);
  }
  function masked(session: DocSession) {
    const original = originals.get(session.id);
    if (!original) return null;
    return files.writeDoc(original.handle, keepReplacements(original.edits, kept.of(session.id)));
  }
  async function download(session: DocSession): Promise<boolean> {
    const bytes = await masked(session);
    return bytes ? saveFile(bytes, maskedName(session.fileName)) : false;
  }
  /** A PDF's masked Markdown to the clipboard, to paste straight into the AI. */
  async function copyMasked(session: DocSession): Promise<boolean> {
    const bytes = await masked(session);
    if (!bytes) return false;
    await navigator.clipboard.writeText(new TextDecoder().decode(bytes));
    return true;
  }
  async function openReturned(session: DocSession, file: File): Promise<DocRestore | string> {
    if (!(isPdfSession(session) ? returnedForPdf : returnedName).test(file.name))
      return isPdfSession(session) ? unsupportedReturn : docErrorMessages.unsupported;
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
    return saveFile(bytes, exportName(withoutMaskedSuffix(restore.fileName), unmaskedSuffix));
  }
  function closeReturned(restore: DocRestore | null) {
    if (restore) files.close(restore.handle);
  }

  return {
    /** Pictures and scanned pages can be read on this machine. */
    ocr,
    draft,
    opening,
    openingProgress,
    cancelOpen,
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
    review,
    setKept,
    download,
    copyMasked,
    openReturned,
    downloadRestored,
    closeReturned,
  };
}
export type DocRun = ReturnType<typeof useDocRun>;
