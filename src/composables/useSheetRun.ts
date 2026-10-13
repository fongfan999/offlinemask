import { computed, ref, shallowRef, watch, type Ref } from "vue";
import {
  exportName,
  saveFile,
  SheetAdapterError,
  fileErrorMessages,
  type SheetFiles,
} from "../adapters/sheet-files.ts";
import { detectionOptions, localOptions, type DetectionOption } from "../core/detection/options.ts";
import type { Detection } from "../core/detection/types.ts";
import { suggestColumn, type ColumnPlan } from "../core/sheet/columns.ts";
import {
  applyEdits,
  maskTables,
  restoreTables,
  scanBatches,
  scanCells,
  splitDetections,
  type CellEdits,
  type SheetTable,
} from "../core/sheet/mask.ts";
import { maxFileBytes, sheetFormat } from "../core/sheet/files.ts";
import {
  aliasScope,
  newSessionId,
  sheetPreviewRows,
  type Session,
  type SheetSession,
} from "../core/sessions.ts";
import type { TextDetector } from "./useMaskingRun.ts";

export interface SheetDraft {
  /** Chosen when the file opens, so the preview shows the aliases the file will get. */
  sessionId: string;
  fileName: string;
  handle: string;
  tables: SheetTable[];
  notes: string[];
  plans: ColumnPlan[][];
}
export interface SheetRestore {
  fileName: string;
  handle: string;
  tables: SheetTable[];
  edits: CellEdits;
  restored: number;
  unknown: string[];
}
export interface SheetRunDependencies {
  detector: TextDetector;
  files: SheetFiles;
  pack: { ready: Ref<boolean>; readyRoot: Ref<string | null> };
  sessions: Ref<readonly Session[]>;
  onSession: (session: Session) => void;
}

export interface SheetProgress {
  stage: "loading" | "reading" | "masking";
  done: number;
  total: number;
  startedAt: number;
}
export const sheetFailure =
  "Chưa xử lý được bảng tính trên thiết bị. Tệp gốc không bị thay đổi. Hãy thử lại.";

/** The spreadsheet flow (decision 0076): open a file, choose what to hide per column
 * (or scan every cell), mask all rows in the background, save a masked copy, and
 * later restore the AI's returned file. Workbooks stay in the worker, in RAM. */
export function useSheetRun({ detector, files, pack, sessions, onSession }: SheetRunDependencies) {
  const draft = ref<SheetDraft | null>(null);
  const opening = ref(false);
  const fileError = ref("");
  const processing = ref(false);
  /** Masking all rows: what is happening, how far, and since when (for an estimate). */
  const progress = ref<SheetProgress | null>(null);
  let cancelled = false;
  const processingError = ref("");
  /** Detections for the preview rows, keyed like `maskTables` expects. */
  const previewDetections = shallowRef(new Map<string, Detection[]>());
  const previewScanning = ref(false);
  /** The original workbook and its edits per masked session, for downloading. RAM only. */
  const originals = new Map<string, { handle: string; edits: CellEdits }>();

  const options = computed<DetectionOption[]>(() =>
    pack.ready.value ? detectionOptions.map((option) => option.id) : [...localOptions],
  );
  // "Quét nội dung" on a column covers scanning; there is no separate all-cells mode.
  const plans = computed(() => draft.value?.plans ?? []);
  const previewTables = computed(() =>
    (draft.value?.tables ?? []).map((table) => ({
      ...table,
      rows: table.rows.slice(0, sheetPreviewRows),
    })),
  );
  /** Masked first rows, recomputed as plans change; scanned cells use cached detections. */
  const preview = computed(() => {
    if (!draft.value) return [];
    const result = maskTables(
      previewTables.value,
      { columns: plans.value, detections: previewDetections.value },
      aliasScope(draft.value.sessionId),
    );
    return previewTables.value.map((table, index) => applyEdits(table, result.edits[index]));
  });

  /** Detect once per distinct text: statements repeat the same merchant or note
   * hundreds of times. Texts without a letter cannot hold a name or an address, so
   * they skip the model and only meet the fast email, phone and account rules. */
  async function detectCells(
    cells: { key: string; text: string }[],
    report?: (progress: { stage: "loading" | "reading"; done: number; total: number }) => void,
    into = new Map<string, Detection[]>(),
    stopped: () => boolean = () => false,
  ) {
    const byText = new Map<string, string[]>();
    for (const cell of cells) {
      const keys = byText.get(cell.text);
      if (keys) keys.push(cell.key);
      else byText.set(cell.text, [cell.key]);
    }
    const unique = [...byText.keys()];
    const hasLetter = (text: string) => /\p{L}/u.test(text);
    const groups = [
      {
        texts: unique.filter(hasLetter),
        options: options.value,
        root: pack.readyRoot.value ?? undefined,
      },
      {
        texts: unique.filter((text) => !hasLetter(text)),
        options: [...localOptions],
        root: undefined,
      },
    ];
    const total = unique.length;
    let done = 0;
    for (const group of groups) {
      // Small batches keep progress moving and make cancelling quick.
      const batches = scanBatches(
        group.texts.map((text, index) => ({ key: String(index), text })),
        8_000,
      );
      for (const batch of batches) {
        if (stopped()) throw new DOMException("Cancelled", "AbortError");
        const found = await detector.detect(
          batch.text,
          (step) =>
            report?.(
              step.stage === "loading"
                ? { stage: "loading", done, total }
                : {
                    stage: "reading",
                    done:
                      done +
                      Math.floor((batch.parts.length * step.completed) / Math.max(1, step.total)),
                    total,
                  },
            ),
          group.root,
          group.options,
        );
        const spans = splitDetections(batch, found);
        for (const part of batch.parts)
          for (const key of byText.get(group.texts[Number(part.key)]!)!)
            into.set(key, spans.get(part.key) ?? []);
        done += batch.parts.length;
        report?.({ stage: "reading", done, total });
      }
    }
    return into;
  }
  // Scan the preview rows of scanned columns whenever the plan or pack changes.
  let previewRun = 0;
  watch(
    [plans, options],
    async () => {
      const run = ++previewRun;
      const cells = scanCells(previewTables.value, plans.value).filter(
        (cell) => !previewDetections.value.has(cell.key),
      );
      if (!cells.length) return;
      previewScanning.value = true;
      try {
        const found = await detectCells(cells, undefined, new Map(previewDetections.value));
        if (run === previewRun) previewDetections.value = found;
      } catch {
        // The preview stays unscanned; masking all rows reports its own errors.
      } finally {
        if (run === previewRun) previewScanning.value = false;
      }
    },
    { deep: true },
  );
  watch(options, () => (previewDetections.value = new Map()));

  async function openFile(file: File) {
    fileError.value = "";
    if (!sheetFormat(file.name)) {
      fileError.value = fileErrorMessages.unsupported;
      return;
    }
    if (file.size > maxFileBytes) {
      fileError.value = fileErrorMessages["too-large"];
      return;
    }
    opening.value = true;
    try {
      const opened = await files.open(file);
      discardDraft();
      previewDetections.value = new Map();
      draft.value = {
        sessionId: newSessionId(sessions.value),
        fileName: file.name,
        handle: opened.handle,
        tables: opened.tables,
        notes: opened.notes,
        plans: opened.tables.map((table) =>
          table.header.map((header, column) =>
            suggestColumn(
              header,
              table.rows.slice(0, 50).map((row) => row[column] ?? ""),
            ),
          ),
        ),
      };
    } catch (error) {
      fileError.value =
        error instanceof SheetAdapterError ? error.message : fileErrorMessages.unreadable;
    } finally {
      opening.value = false;
    }
  }
  function discardDraft() {
    if (draft.value) files.close(draft.value.handle);
    draft.value = null;
  }
  function setPlan(sheet: number, column: number, plan: ColumnPlan) {
    if (draft.value) draft.value.plans[sheet]![column] = plan;
  }
  /** Workbooks of sessions that no longer exist (replaced or removed) are released. */
  function prune() {
    for (const [id, original] of originals)
      if (!sessions.value.some((session) => session.id === id)) {
        files.close(original.handle);
        originals.delete(id);
      }
  }

  async function maskAll(): Promise<SheetSession | undefined> {
    const current = draft.value;
    if (!current || processing.value) return;
    processing.value = true;
    processingError.value = "";
    cancelled = false;
    const startedAt = Date.now();
    progress.value = { stage: "loading", done: 0, total: 0, startedAt };
    try {
      const columns = plans.value.map((sheet) => sheet.map((plan) => ({ ...plan })));
      const cells = scanCells(current.tables, columns);
      const detections = await detectCells(
        cells,
        (step) => (progress.value = { ...step, startedAt }),
        new Map(),
        () => cancelled,
      );
      progress.value = { stage: "masking", done: 0, total: 0, startedAt };
      const id = sessions.value.some((s) => aliasScope(s.id) === aliasScope(current.sessionId))
        ? newSessionId(sessions.value)
        : current.sessionId;
      const result = maskTables(current.tables, { columns, detections }, aliasScope(id));
      const session: SheetSession = {
        id,
        number: sessions.value.reduce((max, s) => Math.max(max, s.number), 0) + 1,
        format: "excel",
        fixture: "private-sheet-v1",
        createdAt: new Date().toISOString(),
        fileName: current.fileName,
        mode: "columns",
        sheets: current.tables.map((table, index) => ({
          name: table.name,
          rows: table.rows.length,
          plans: columns[index]!,
        })),
        preview: current.tables.map((table, index) => {
          const view = applyEdits(table, result.edits[index], sheetPreviewRows);
          return { preamble: view.preamble, header: view.header, rows: view.rows };
        }),
        findings: result.findings,
        masked: result.masked,
      };
      originals.set(id, { handle: current.handle, edits: result.edits });
      draft.value = null;
      onSession(session);
      prune();
      return session;
    } catch (error) {
      // Cancelling keeps the file and its choices; nothing is reported as an error.
      if (!(error instanceof DOMException && error.name === "AbortError") && !cancelled)
        processingError.value = sheetFailure;
    } finally {
      processing.value = false;
      progress.value = null;
    }
  }
  function cancelMask() {
    if (!processing.value) return;
    cancelled = true;
    // Keep the loaded model for the next try.
    detector.cancel(true);
  }
  function canDownload(session: SheetSession) {
    return originals.has(session.id);
  }
  async function download(session: SheetSession): Promise<boolean> {
    const original = originals.get(session.id);
    if (!original) return false;
    const bytes = await files.write(original.handle, original.edits);
    return saveFile(bytes, exportName(session.fileName, "đã ẩn"));
  }

  /** Open the file that came back from the AI and swap this session's aliases back. */
  async function openReturned(session: SheetSession, file: File): Promise<SheetRestore | string> {
    if (!sheetFormat(file.name)) return fileErrorMessages.unsupported;
    if (file.size > maxFileBytes) return fileErrorMessages["too-large"];
    try {
      const opened = await files.open(file);
      const result = restoreTables(opened.tables, session.findings);
      return { fileName: file.name, handle: opened.handle, tables: opened.tables, ...result };
    } catch (error) {
      return error instanceof SheetAdapterError ? error.message : fileErrorMessages.unreadable;
    }
  }
  async function downloadRestored(restore: SheetRestore): Promise<boolean> {
    const bytes = await files.write(restore.handle, restore.edits);
    return saveFile(
      bytes,
      exportName(restore.fileName.replace(/ \(đã ẩn\)(?=\.[^.]+$)/, ""), "đã khôi phục"),
    );
  }
  function closeReturned(restore: SheetRestore | null) {
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
    plans,
    options,
    openFile,
    discardDraft,
    setPlan,
    maskAll,
    cancelMask,
    canDownload,
    download,
    openReturned,
    downloadRestored,
    closeReturned,
  };
}
export type SheetRun = ReturnType<typeof useSheetRun>;
