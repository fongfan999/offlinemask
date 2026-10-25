import { detectionOptions, type DetectionOption } from "./detection/options.ts";
import { findings, prepareCopy, type Decisions, type Finding } from "./review.ts";
import { analyzeText, maskedText, type TextAnalysis } from "./text.ts";
import type { Detection } from "./detection/types.ts";
import type { ColumnPlan } from "./sheet/columns.ts";

export type Format = "text" | "excel" | "word";
/** A synthetic text sample (fixture references only). Spreadsheet samples were
 * replaced by real files in decision 0076. */
export interface SampleSession {
  id: string;
  number: number;
  format: "text";
  fixture: "sample-v1";
  createdAt: string;
  decisions: Decisions;
}
export interface TextSession {
  id: string;
  number: number;
  format: "text";
  fixture: "private-text-v1";
  createdAt: string;
  original: string;
  options: DetectionOption[];
  analysis: TextAnalysis;
  manualMaskCount?: number;
  reviewUndo?: { analysis: TextAnalysis; decisions: Decisions };
  decisions: Decisions;
}
/** A masked spreadsheet (decision 0076). The workbook itself is never stored: only
 * what the screen shows (the masked first rows) and the alias table needed to
 * restore the AI's returned file. */
export interface SheetSession {
  id: string;
  number: number;
  format: "excel";
  fixture: "private-sheet-v1";
  createdAt: string;
  fileName: string;
  /** Always "columns" now; "cells" came from the removed scan-every-cell option. */
  mode: "columns" | "cells";
  sheets: { name: string; rows: number; plans: ColumnPlan[] }[];
  /** Masked lines above the header, header and first rows per sheet. */
  preview: { preamble?: string[][]; header: string[]; rows: string[][] }[];
  findings: Finding[];
  masked: number;
}
/** A masked Word document (decision 0078). Like spreadsheets, only the masked first
 * paragraphs and the alias table are kept, never the document. */
export interface DocSession {
  id: string;
  number: number;
  format: "word";
  fixture: "private-doc-v1";
  createdAt: string;
  fileName: string;
  paragraphs: number;
  /** `page` for a PDF's paragraphs (decision 0149). */
  preview: { text: string; marks: { start: number; end: number }[]; page?: number }[];
  findings: Finding[];
  masked: number;
}
export type PrivateSession = TextSession | SheetSession | DocSession;
export type Session = SampleSession | PrivateSession;
export function isPrivate(session: Session): session is PrivateSession {
  return session.fixture !== "sample-v1";
}
export const sheetPreviewRows = 20;
/** History deletes itself after one of these periods, counted from when each entry
 * was created (decision 0143). There is no "keep forever": nobody remembers what they
 * masked months ago, and an old alias table is only a liability. */
export const keepDayChoices = [1, 7, 30, 90] as const;
export type KeepDays = (typeof keepDayChoices)[number];
export const defaultKeepDays: KeepDays = 30;
export const keepDaysKey = "offlinemask.history-keep-days";
export function parseKeepDays(raw: string | null | undefined): KeepDays {
  return keepDayChoices.find((days) => String(days) === raw) ?? defaultKeepDays;
}
const dayMs = 24 * 60 * 60 * 1000;
/** Whether a private entry is older than the keep period at `now`; samples never expire. */
export function isExpired(session: Session, days: number, now = Date.now()): boolean {
  return isPrivate(session) && now - Date.parse(session.createdAt) >= days * dayMs;
}
export const historyKey = "offlinemask.sample-sessions.v1";
export function createSession(format: "text", existing: readonly Session[]): SampleSession {
  return {
    id: crypto.randomUUID(),
    number: existing.reduce((max, s) => Math.max(max, s.number), 0) + 1,
    format,
    fixture: "sample-v1",
    createdAt: new Date().toISOString(),
    decisions: Object.fromEntries(findings.map((f) => [f.id, "mask"])),
  };
}
/** Alias scope: four hex characters of the session id, enough to tell sessions in
 * one app instance apart (creation retries clashes) while keeping `[STK_1_dcac]` readable.
 */
export const aliasScopeLength = 4;
export function aliasScope(sessionId: string): string {
  return sessionId.slice(0, aliasScopeLength);
}

export function createTextSession(
  text: string,
  existing: readonly Session[],
  detections: readonly Detection[],
  options: readonly DetectionOption[] = detectionOptions.map((option) => option.id),
): TextSession {
  // Keep tokens readable while explicitly avoiding namespace reuse in this app instance.
  // A future persistent vault must retain and enforce the namespace registry too.
  let id: string;
  do {
    id = crypto.randomUUID();
  } while (existing.some((session) => aliasScope(session.id) === aliasScope(id)));
  const analysis = analyzeText(text, aliasScope(id), detections);
  return {
    id,
    number: existing.reduce((max, s) => Math.max(max, s.number), 0) + 1,
    format: "text",
    fixture: "private-text-v1",
    createdAt: new Date().toISOString(),
    original: text,
    options: [...options],
    analysis,
    decisions: Object.fromEntries(analysis.findings.map((finding) => [finding.id, "mask"])),
  };
}
/** A fresh session id whose alias scope no other session in this instance uses. */
export function newSessionId(existing: readonly Session[]): string {
  let id: string;
  do id = crypto.randomUUID();
  while (existing.some((session) => aliasScope(session.id) === aliasScope(id)));
  return id;
}
export function sessionTitle(session: Session): string {
  if (session.fixture === "private-text-v1") return `Văn bản #${session.number}`;
  if (session.fixture === "private-sheet-v1") return `Bảng tính #${session.number}`;
  if (session.fixture === "private-doc-v1") return `Tài liệu #${session.number}`;
  return `Yêu cầu hỗ trợ #${session.number}`;
}
// Store only versioned fixture references and choices. Never extend this to private
// input: persistent originals require the encrypted vault lifecycle in the PRD.
export function encodeSessions(sessions: readonly Session[]): string {
  return JSON.stringify({
    version: 1,
    sessions: sessions
      .filter((s): s is SampleSession => s.fixture === "sample-v1")
      .map((s) => ({
        id: s.id,
        number: s.number,
        format: s.format,
        fixture: s.fixture,
        createdAt: s.createdAt,
        decisions: Object.fromEntries(findings.map((f) => [f.id, s.decisions[f.id]])),
      })),
  });
}
/** The spreadsheet sample was replaced by real files (decision 0076); stored
 * spreadsheet samples are dropped on load, text samples stay. */
export function decodeSessions(raw: string | null): SampleSession[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error("Unsupported history");
  const ids = new Set<string>();
  return data.sessions
    .filter((s: { format?: string }) => s?.format !== "excel")
    .map((s: SampleSession) => {
      if (
        !s ||
        typeof s.id !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(s.id) ||
        ids.has(s.id) ||
        !Number.isSafeInteger(s.number) ||
        s.number < 1 ||
        s.format !== "text" ||
        s.fixture !== "sample-v1" ||
        typeof s.createdAt !== "string" ||
        !Number.isFinite(Date.parse(s.createdAt)) ||
        !s.decisions ||
        findings.some((f) => !["mask", "keep"].includes(s.decisions[f.id] ?? ""))
      )
        throw new Error("Invalid history");
      ids.add(s.id);
      return {
        id: s.id,
        number: s.number,
        format: s.format,
        fixture: s.fixture,
        createdAt: s.createdAt,
        decisions: Object.fromEntries(findings.map((f) => [f.id, s.decisions[f.id]!])),
      };
    });
}
/** Private sessions for the encrypted vault (decision 0062). Everything the
 * review screen needs comes back; the in-progress undo buffer does not. */
export const vaultVersion = 1;
export function encodePrivateSessions(sessions: readonly Session[]): string {
  return JSON.stringify({
    version: vaultVersion,
    sessions: [
      ...sessions.filter((s): s is SheetSession => s.fixture === "private-sheet-v1"),
      ...sessions.filter((s): s is DocSession => s.fixture === "private-doc-v1"),
      ...sessions
        .filter((s): s is TextSession => s.fixture === "private-text-v1")
        .map((s) => ({
          id: s.id,
          number: s.number,
          format: s.format,
          fixture: s.fixture,
          createdAt: s.createdAt,
          original: s.original,
          options: s.options,
          analysis: s.analysis,
          manualMaskCount: s.manualMaskCount ?? 0,
          decisions: s.decisions,
        })),
    ],
  });
}
const aliasPattern = /^\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]$/;
const optionIds = new Set<string>(detectionOptions.map((option) => option.id));
function isString(value: unknown): value is string {
  return typeof value === "string";
}
/** Reject anything that is not a complete, self-consistent private session; one
 * bad record invalidates the whole vault rather than loading a partial list. */
function isFinding(f: Finding): boolean {
  return (
    !!f &&
    isString(f.id) &&
    isString(f.label) &&
    isString(f.value) &&
    isString(f.alias) &&
    aliasPattern.test(f.alias) &&
    (f.reason === undefined || isString(f.reason)) &&
    (f.source === undefined || isString(f.source))
  );
}
function isPlan(plan: ColumnPlan): boolean {
  return (
    !!plan &&
    (plan.mode === "keep" ||
      plan.mode === "scan" ||
      (plan.mode === "hide" && /^[A-Z_]+$/.test(plan.type) && isString(plan.label)))
  );
}
const isGrid = (rows: unknown) =>
  Array.isArray(rows) && rows.every((row) => Array.isArray(row) && row.every(isString));
function decodeDocSession(s: DocSession): DocSession {
  if (
    !isString(s.fileName) ||
    !Number.isSafeInteger(s.paragraphs) ||
    s.paragraphs < 0 ||
    !Array.isArray(s.preview) ||
    !s.preview.every(
      (paragraph) =>
        paragraph &&
        isString(paragraph.text) &&
        (paragraph.page === undefined ||
          (Number.isSafeInteger(paragraph.page) && paragraph.page >= 1)) &&
        Array.isArray(paragraph.marks) &&
        paragraph.marks.every(
          (mark) =>
            mark &&
            Number.isSafeInteger(mark.start) &&
            Number.isSafeInteger(mark.end) &&
            mark.start >= 0 &&
            mark.end >= mark.start &&
            mark.end <= paragraph.text.length,
        ),
    ) ||
    !Array.isArray(s.findings) ||
    !s.findings.every(isFinding) ||
    !Number.isSafeInteger(s.masked)
  )
    throw new Error("Invalid vault");
  return {
    id: s.id,
    number: s.number,
    format: "word",
    fixture: "private-doc-v1",
    createdAt: s.createdAt,
    fileName: s.fileName,
    paragraphs: s.paragraphs,
    preview: s.preview.map((paragraph) => ({
      text: paragraph.text,
      marks: paragraph.marks.map((mark) => ({ start: mark.start, end: mark.end })),
      ...(paragraph.page === undefined ? {} : { page: paragraph.page }),
    })),
    findings: s.findings.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
      alias: f.alias,
      reason: f.reason,
      source: f.source,
    })),
    masked: s.masked,
  };
}
function decodeSheetSession(s: SheetSession): SheetSession {
  if (
    !isString(s.fileName) ||
    !["columns", "cells"].includes(s.mode) ||
    !Array.isArray(s.sheets) ||
    !s.sheets.every(
      (sheet) =>
        sheet &&
        isString(sheet.name) &&
        Number.isSafeInteger(sheet.rows) &&
        sheet.rows >= 0 &&
        Array.isArray(sheet.plans) &&
        sheet.plans.every(isPlan),
    ) ||
    !Array.isArray(s.preview) ||
    s.preview.length !== s.sheets.length ||
    !s.preview.every(
      (table) =>
        table &&
        Array.isArray(table.header) &&
        table.header.every(isString) &&
        isGrid(table.rows) &&
        (table.preamble === undefined || isGrid(table.preamble)),
    ) ||
    !Array.isArray(s.findings) ||
    !s.findings.every(isFinding) ||
    !Number.isSafeInteger(s.masked)
  )
    throw new Error("Invalid vault");
  return {
    id: s.id,
    number: s.number,
    format: "excel",
    fixture: "private-sheet-v1",
    createdAt: s.createdAt,
    fileName: s.fileName,
    mode: s.mode,
    sheets: s.sheets.map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows,
      plans: sheet.plans.map((plan) => ({ ...plan })),
    })),
    preview: s.preview.map((table) => ({
      ...(table.preamble ? { preamble: table.preamble.map((row) => [...row]) } : {}),
      header: [...table.header],
      rows: table.rows.map((row) => [...row]),
    })),
    findings: s.findings.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
      alias: f.alias,
      reason: f.reason,
      source: f.source,
    })),
    masked: s.masked,
  };
}
export function decodePrivateSessions(raw: string): PrivateSession[] {
  const data = JSON.parse(raw);
  if (data?.version !== vaultVersion || !Array.isArray(data.sessions))
    throw new Error("Unsupported vault");
  const ids = new Set<string>();
  return data.sessions.map((s: PrivateSession): PrivateSession => {
    if (
      s?.fixture === "private-sheet-v1" &&
      isString(s.id) &&
      /^[a-f0-9-]{36}$/i.test(s.id) &&
      !ids.has(s.id) &&
      Number.isSafeInteger(s.number) &&
      s.number >= 1 &&
      s.format === "excel" &&
      isString(s.createdAt) &&
      Number.isFinite(Date.parse(s.createdAt))
    ) {
      ids.add(s.id);
      return decodeSheetSession(s);
    }
    if (
      s?.fixture === "private-doc-v1" &&
      isString(s.id) &&
      /^[a-f0-9-]{36}$/i.test(s.id) &&
      !ids.has(s.id) &&
      Number.isSafeInteger(s.number) &&
      s.number >= 1 &&
      s.format === "word" &&
      isString(s.createdAt) &&
      Number.isFinite(Date.parse(s.createdAt))
    ) {
      ids.add(s.id);
      return decodeDocSession(s);
    }
    if (s?.fixture !== "private-text-v1") throw new Error("Invalid vault");
    const findings = s?.analysis?.findings;
    const spans = s?.analysis?.spans;
    if (
      !s ||
      !isString(s.id) ||
      !/^[a-f0-9-]{36}$/i.test(s.id) ||
      ids.has(s.id) ||
      !Number.isSafeInteger(s.number) ||
      s.number < 1 ||
      s.format !== "text" ||
      s.fixture !== "private-text-v1" ||
      !isString(s.createdAt) ||
      !Number.isFinite(Date.parse(s.createdAt)) ||
      !isString(s.original) ||
      !Array.isArray(s.options) ||
      !s.options.every((option) => optionIds.has(option)) ||
      !Array.isArray(findings) ||
      !Array.isArray(spans) ||
      !findings.every(
        (f) =>
          f &&
          isString(f.id) &&
          isString(f.label) &&
          isString(f.value) &&
          isString(f.alias) &&
          aliasPattern.test(f.alias) &&
          (f.reason === undefined || isString(f.reason)) &&
          (f.source === undefined || isString(f.source)),
      ) ||
      !spans.every(
        (span) =>
          span &&
          Number.isSafeInteger(span.start) &&
          Number.isSafeInteger(span.end) &&
          span.start >= 0 &&
          span.end > span.start &&
          span.end <= s.original.length &&
          findings.some((f) => f.id === span.findingId),
      ) ||
      !s.decisions ||
      typeof s.decisions !== "object" ||
      findings.some((f) => !["mask", "keep"].includes(s.decisions[f.id] ?? "")) ||
      (s.manualMaskCount !== undefined && !Number.isSafeInteger(s.manualMaskCount))
    )
      throw new Error("Invalid vault");
    ids.add(s.id);
    return {
      id: s.id,
      number: s.number,
      format: "text",
      fixture: "private-text-v1",
      createdAt: s.createdAt,
      original: s.original,
      options: [...s.options],
      analysis: {
        findings: findings.map((f) => ({
          id: f.id,
          label: f.label,
          value: f.value,
          alias: f.alias,
          reason: f.reason,
          source: f.source,
        })),
        spans: spans.map((span) => ({
          start: span.start,
          end: span.end,
          findingId: span.findingId,
        })),
      },
      manualMaskCount: s.manualMaskCount ?? 0,
      decisions: Object.fromEntries(findings.map((f) => [f.id, s.decisions[f.id]!])),
    };
  });
}
export function sessionOutput(session: SampleSession | TextSession): string {
  if (session.fixture === "private-text-v1")
    return maskedText(session.original, session.analysis, session.decisions);
  return prepareCopy(session.decisions);
}
