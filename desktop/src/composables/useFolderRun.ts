import { computed, ref, shallowRef, type Ref } from "vue";
import { machineResources, pickFolderTarget, type PickedFolder } from "../adapters/folder.ts";
import {
  createSheetFiles,
  exportName,
  maskedSuffix,
  SheetAdapterError,
  type SheetFiles,
} from "../adapters/sheet-files.ts";
import { detectionOptions, localOptions, type DetectionOption } from "../core/detection/options.ts";
import type { Detection } from "../core/detection/types.ts";
import type { DocEdits, DocError } from "../core/doc/docx.ts";
import { editedAliases, keepReplacements, maskParagraphs } from "../core/doc/mask.ts";
import { countAliases, reviewGroups } from "../core/file-review.ts";
import {
  fileWorkers,
  folderKind,
  layoutKey,
  mapPool,
  scannedChars,
  skipReason,
  sortEntries,
  type FolderKind,
} from "../core/folder.ts";
import { jobSeconds, recordPace } from "./jobTime.ts";
import { memoryRefusal, pdfCharLimit, pdfRefusal } from "./memoryBudget.ts";
import { aliasScope, newSessionId, type Session } from "../core/sessions.ts";
import { suggestColumn, type ColumnPlan } from "../core/sheet/columns.ts";
import {
  AliasBook,
  editedTexts,
  keepCells,
  maskTables,
  scanCells,
  type CellEdits,
} from "../core/sheet/mask.ts";
import type { Finding } from "../core/review.ts";
import { scanTexts } from "./scanTexts.ts";
import { docErrorMessages, maskedName } from "./useDocRun.ts";
import type { TextDetector } from "./useMaskingRun.ts";
import { savedName, type SheetProgress } from "./useSheetRun.ts";

export type FolderPhase =
  "empty" | "surveying" | "ready" | "masking" | "review" | "saving" | "saved";
export type FolderFileStatus =
  "waiting" | "reading" | "ready" | "masking" | "masked" | "saved" | "failed";
export interface FolderFile {
  path: string;
  file: File;
  kind: FolderKind;
  status: FolderFileStatus;
  error: string;
  /** A document's characters; spreadsheets count per sheet and column. */
  chars: number;
  sheets: { layout: string; preambleChars: number; columnChars: number[] }[];
  masked: number;
}
/** Sheets with the same headers, and the column choices they share. */
export interface FolderLayout {
  key: string;
  header: string[];
  /** First rows of the first sheet with this layout, to choose by. RAM only. */
  sample: string[][];
  example: string;
  plans: ColumnPlan[];
  sheets: number;
  /** Position of the example's file in the folder: files are read out of order, and the
   * earliest file gives the example and the suggestions. */
  order: number;
}
interface Result {
  kind: FolderKind;
  edits: DocEdits | CellEdits;
}
export interface FolderRunDependencies {
  detector: TextDetector;
  pack: { ready: Ref<boolean>; readyRoot: Ref<string | null> };
  sessions: Ref<readonly Session[]>;
}

export const folderFailure = "Chưa xử lý được tệp này. Tệp gốc không bị thay đổi.";
const sampleRows = 20;
const suggestRows = 50;
/** Detections are shared across files only for short texts: headings, cells, names. */
const cachedLength = 300;
const cacheLimit = 200_000;
const aliasLike = /\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/gi;

/** Where a file's masked copy goes inside the output folder, named as its page names it. */
export function outputPath(file: FolderFile): string {
  const parts = file.path.split("/");
  const name = parts.pop()!;
  const masked =
    file.kind === "word" ? maskedName(name) : exportName(savedName(name), maskedSuffix);
  return [...parts, masked].join("/");
}

/** The folder flow (decision 0171): survey every file, choose columns per spreadsheet
 * layout, mask every file with one alias table, review the folder's values once, and
 * write a mirrored folder of masked copies. Files are opened, used and closed again at
 * each step, by a pool of file workers sized to the machine; the model reads one batch
 * at a time. Nothing is stored: results live in memory until another folder opens. */
export function useFolderRun({ detector, pack, sessions }: FolderRunDependencies) {
  const phase = ref<FolderPhase>("empty");
  const name = ref("");
  const files = ref<FolderFile[]>([]);
  const skipped = ref<{ path: string; reason: string }[]>([]);
  const layouts = ref<FolderLayout[]>([]);
  const workers = ref(1);
  const progress = ref<SheetProgress | null>(null);
  const saveTarget = ref("");
  const totals = shallowRef(new Map<string, number>());
  const fileCounts = shallowRef(new Map<string, number>());
  const kept = shallowRef(new Set<string>());
  let pool: SheetFiles[] = [];
  let present = new Set<string>();
  let book: AliasBook | null = null;
  let results = new Map<string, Result>();
  let cancelled = false;
  let generation = 0;

  const options = computed<DetectionOption[]>(() =>
    pack.ready.value ? detectionOptions.map((option) => option.id) : [...localOptions],
  );
  const layoutOf = (key: string) => layouts.value.find((layout) => layout.key === key);
  /** What the model will read in one file under the current column choices. */
  function weight(file: FolderFile) {
    if (file.status === "failed") return 0;
    if (file.kind === "word") return file.chars;
    return file.sheets.reduce(
      (sum, sheet) => sum + scannedChars(sheet, layoutOf(sheet.layout)?.plans ?? []),
      0,
    );
  }
  const readChars = computed(() => files.value.reduce((sum, file) => sum + weight(file), 0));
  const seconds = (chars: number) => jobSeconds(chars, pack.ready.value);
  const estimate = computed(() => seconds(readChars.value));
  const readable = computed(() => files.value.filter((file) => file.status !== "failed"));
  const failed = computed(() => files.value.filter((file) => file.status === "failed"));
  const busy = computed(() => ["surveying", "masking", "saving"].includes(phase.value));

  function reset() {
    generation++;
    cancelled = true;
    for (const worker of pool) worker.dispose();
    pool = [];
    phase.value = "empty";
    name.value = "";
    files.value = [];
    skipped.value = [];
    layouts.value = [];
    progress.value = null;
    saveTarget.value = "";
    totals.value = new Map();
    fileCounts.value = new Map();
    kept.value = new Set();
    present = new Set();
    book = null;
    results = new Map();
  }

  function errorMessage(error: unknown, kind: FolderKind) {
    if (!(error instanceof SheetAdapterError)) return folderFailure;
    return kind === "word"
      ? docErrorMessages[error.code as DocError] || docErrorMessages.unreadable
      : error.message;
  }
  function notePresent(texts: Iterable<string>) {
    for (const text of texts)
      if (text.includes("[")) for (const [alias] of text.matchAll(aliasLike)) present.add(alias);
  }
  function addLayout(header: string[], rows: string[][], example: string, order: number) {
    const key = layoutKey(header);
    const known = layoutOf(key);
    if (known) known.sheets++;
    if (known && known.order <= order) return key;
    const layout = {
      key,
      header,
      sample: rows.slice(0, sampleRows),
      example,
      plans: header.map((cell, column) =>
        suggestColumn(
          cell,
          rows.slice(0, suggestRows).map((row) => row[column] ?? ""),
        ),
      ),
      sheets: known?.sheets ?? 1,
      order,
    };
    if (known) Object.assign(known, layout);
    else layouts.value.push(layout);
    return key;
  }

  /** Take a folder: list what it holds and read each file once to size the work. */
  async function load(picked: PickedFolder): Promise<boolean> {
    if (busy.value && phase.value !== "surveying") return false;
    reset();
    const run = generation;
    cancelled = false;
    name.value = picked.name;
    const sorted = sortEntries(picked.entries);
    const taken = [];
    for (const entry of sorted) {
      const reason = skipReason(entry);
      if (reason) skipped.value.push({ path: entry.path, reason });
      else taken.push(entry);
    }
    files.value = taken.map((entry) => ({
      path: entry.path,
      file: entry.file,
      kind: folderKind(entry.file.name)!,
      status: "waiting",
      error: "",
      chars: 0,
      sheets: [],
      masked: 0,
    }));
    phase.value = "surveying";
    workers.value = fileWorkers(await machineResources());
    if (run !== generation) return false;
    pool = Array.from({ length: workers.value }, () => createSheetFiles());
    await mapPool(files.value, workers.value, async (_, slot, index) => {
      if (run !== generation) return;
      const item = files.value[index]!;
      const worker = pool[slot]!;
      item.status = "reading";
      // Files open side by side, one per worker: each has its share of the budget.
      const share = 1 / workers.value;
      const refused = await memoryRefusal(item.file, share);
      if (refused) {
        item.status = "failed";
        item.error = refused;
        return;
      }
      try {
        if (item.kind === "word") {
          const opened = await worker.openDoc(item.file, { maxChars: await pdfCharLimit(share) });
          worker.close(opened.handle);
          item.chars = opened.paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
          notePresent(opened.paragraphs.map((paragraph) => paragraph.text));
        } else {
          const opened = await worker.open(item.file);
          worker.close(opened.handle);
          item.sheets = opened.tables.map((table) => {
            const columnChars = table.header.map(() => 0);
            for (const row of table.rows)
              row.forEach((text, column) => {
                if (text.trim()) columnChars[column] = (columnChars[column] ?? 0) + text.length;
              });
            notePresent([...table.preamble, ...table.rows].flat());
            return {
              layout: addLayout(table.header, table.rows, `${item.path} · ${table.name}`, index),
              preambleChars: table.preamble.flat().reduce((sum, text) => sum + text.length, 0),
              columnChars,
            };
          });
        }
        item.status = "ready";
      } catch (error) {
        item.status = "failed";
        item.error =
          (error as { code?: string })?.code === "memory"
            ? await pdfRefusal(share)
            : errorMessage(error, item.kind);
      }
    });
    if (run !== generation) return false;
    layouts.value.sort((a, b) => a.order - b.order);
    phase.value = "ready";
    return true;
  }
  function setPlan(key: string, column: number, plan: ColumnPlan) {
    const layout = layoutOf(key);
    if (layout && phase.value === "ready") layout.plans[column] = plan;
  }

  /** The shared detector, one call at a time, refusing to start once cancelled. */
  let tail: Promise<unknown> = Promise.resolve();
  const serial: TextDetector = {
    ...detector,
    detect(text, report, root, chosen) {
      const start = () =>
        cancelled
          ? Promise.reject(new DOMException("Cancelled", "AbortError"))
          : detector.detect(text, report, root, chosen);
      const next = tail.then(start, start);
      tail = next.catch(() => undefined);
      return next;
    },
  };
  const cache = new Map<string, Detection[]>();
  async function detect<Key>(
    items: readonly { key: Key; text: string }[],
    report: (fraction: number) => void,
  ): Promise<Map<Key, Detection[]>> {
    const wanted = [...new Set(items.map((item) => item.text).filter((text) => !cache.has(text)))];
    const found = await scanTexts(
      serial,
      wanted.map((text) => ({ key: text, text })),
      options.value,
      pack.readyRoot.value ?? undefined,
      (step) => report(step.total ? step.done / step.total : 0),
      new Map(),
      () => cancelled,
    );
    for (const [text, detections] of found)
      if (text.length <= cachedLength && cache.size < cacheLimit) cache.set(text, detections);
    return new Map(
      items.map((item) => [item.key, found.get(item.text) ?? cache.get(item.text) ?? []]),
    );
  }

  /** Mask every readable file with one alias table, a few files open at a time. */
  async function maskAll() {
    if (phase.value !== "ready" || !readable.value.length) return;
    const run = generation;
    cancelled = false;
    phase.value = "masking";
    cache.clear();
    results = new Map();
    const scope = aliasScope(newSessionId(sessions.value));
    const shared = (book = new AliasBook(scope, (alias) => present.has(alias)));
    const todo = readable.value;
    const weights = new Map(todo.map((file) => [file.path, Math.max(1, weight(file))]));
    const total = [...weights.values()].reduce((sum, value) => sum + value, 0);
    const fractions = new Map<string, number>();
    const startedAt = Date.now();
    const report = (path: string, fraction: number) => {
      fractions.set(path, Math.max(fractions.get(path) ?? 0, fraction));
      let done = 0;
      for (const [key, value] of fractions) done += value * (weights.get(key) ?? 0);
      progress.value = { stage: "reading", done: Math.round(done), total, startedAt };
    };
    progress.value = { stage: "loading", done: 0, total, startedAt };
    await mapPool(todo, workers.value, async (item, slot) => {
      if (cancelled || run !== generation) return;
      const worker = pool[slot]!;
      item.status = "masking";
      let handle = "";
      try {
        if (item.kind === "word") {
          const opened = await worker.openDoc(item.file);
          handle = opened.handle;
          const detections = await detect(
            opened.paragraphs.map((paragraph) => ({ key: paragraph.id, text: paragraph.text })),
            (fraction) => report(item.path, fraction),
          );
          const result = maskParagraphs(
            opened.paragraphs,
            detections,
            scope,
            opened.mailto,
            shared,
          );
          results.set(item.path, { kind: "word", edits: result.edits });
          item.masked = result.masked;
        } else {
          const opened = await worker.open(item.file);
          handle = opened.handle;
          const columns = opened.tables.map((table) =>
            (
              layoutOf(layoutKey(table.header))?.plans ??
              table.header.map(() => ({ mode: "keep" as const }))
            ).map((plan) => ({ ...plan })),
          );
          const detections = await detect(scanCells(opened.tables, columns), (fraction) =>
            report(item.path, fraction),
          );
          const result = maskTables(opened.tables, { columns, detections }, scope, shared);
          results.set(item.path, { kind: "excel", edits: result.edits });
          item.masked = result.masked;
        }
        report(item.path, 1);
        item.status = "masked";
      } catch (error) {
        if (cancelled) item.status = "ready";
        else {
          item.status = "failed";
          item.error = errorMessage(error, item.kind);
        }
      } finally {
        if (handle) worker.close(handle);
      }
    });
    progress.value = null;
    if (run !== generation) return;
    if (cancelled) {
      book = null;
      results = new Map();
      for (const file of files.value) if (file.status === "masked") file.status = "ready";
      phase.value = "ready";
      return;
    }
    recordPace(total, (Date.now() - startedAt) / 1000, pack.ready.value);
    tally();
    phase.value = "review";
  }
  /** How often each alias occurs across the folder, and in how many files. */
  function tally() {
    const all = new Map<string, number>();
    const inFiles = new Map<string, number>();
    const findings = book?.findings ?? [];
    for (const result of results.values()) {
      const texts =
        result.kind === "word"
          ? editedAliases(result.edits as DocEdits)
          : editedTexts(result.edits as CellEdits);
      for (const [alias, count] of countAliases(texts, findings)) {
        all.set(alias, (all.get(alias) ?? 0) + count);
        inFiles.set(alias, (inFiles.get(alias) ?? 0) + 1);
      }
    }
    totals.value = all;
    fileCounts.value = inFiles;
  }
  /** Back to the column choices before anything is saved: the masked copies and their
   * codes are dropped, and hiding again makes new ones. */
  function edit() {
    if (phase.value !== "review") return;
    book = null;
    results = new Map();
    totals.value = new Map();
    fileCounts.value = new Map();
    kept.value = new Set();
    for (const file of files.value)
      if (file.status === "masked") {
        file.status = "ready";
        file.masked = 0;
      }
    phase.value = "ready";
  }
  function cancel() {
    if (phase.value === "surveying") {
      reset();
      return;
    }
    if (phase.value !== "masking") return;
    cancelled = true;
    detector.cancel(true);
  }

  /** The folder's aliases once masked, so home's restore tab can read replies about it. */
  // `book` is not reactive: read `totals` first so both computeds follow every run.
  const findings = computed<readonly Finding[]>(() =>
    totals.value.size && book ? book.findings : [],
  );
  const review = computed(() =>
    totals.value.size && book ? reviewGroups(book.findings, totals.value, kept.value) : [],
  );
  const masked = computed(() =>
    files.value.filter((file) => file.status === "masked" || file.status === "saved"),
  );
  function setKept(aliases: readonly string[], keep: boolean) {
    const next = new Set(kept.value);
    for (const alias of aliases) {
      if (keep) next.add(alias);
      else next.delete(alias);
    }
    kept.value = next;
  }

  /** Write every masked file into a new folder where the user chooses. */
  async function save(): Promise<boolean> {
    if (phase.value !== "review" && phase.value !== "saved") return false;
    const target = await pickFolderTarget(name.value);
    if (!target) return false;
    const run = generation;
    phase.value = "saving";
    const findings = book?.findings ?? [];
    const keep = kept.value;
    const todo = masked.value;
    const startedAt = Date.now();
    let done = 0;
    progress.value = { stage: "masking", done, total: todo.length, startedAt };
    await mapPool(todo, workers.value, async (item, slot) => {
      if (run !== generation) return;
      const result = results.get(item.path);
      if (!result) return;
      const worker = pool[slot]!;
      let handle = "";
      try {
        let bytes: Uint8Array;
        if (result.kind === "word") {
          handle = (await worker.openDoc(item.file)).handle;
          bytes = await worker.writeDoc(handle, keepReplacements(result.edits as DocEdits, keep));
        } else {
          handle = (await worker.open(item.file)).handle;
          bytes = await worker.write(handle, keepCells(result.edits as CellEdits, findings, keep));
        }
        await target.write(outputPath(item), bytes);
        item.status = "saved";
      } catch {
        item.status = "failed";
        item.error = "Chưa lưu được bản đã ẩn của tệp này.";
      } finally {
        if (handle) worker.close(handle);
        progress.value = { stage: "masking", done: ++done, total: todo.length, startedAt };
      }
    });
    progress.value = null;
    if (run !== generation) return false;
    saveTarget.value = target.name;
    phase.value = "saved";
    return true;
  }

  return {
    phase,
    name,
    files,
    skipped,
    layouts,
    workers,
    readable,
    failed,
    masked,
    busy,
    estimate,
    progress,
    review,
    findings,
    fileCounts,
    saveTarget,
    load,
    setPlan,
    maskAll,
    cancel,
    edit,
    setKept,
    save,
    reset,
  };
}
export type FolderRun = ReturnType<typeof useFolderRun>;
