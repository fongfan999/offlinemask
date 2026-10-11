import { detectionOptions, type DetectionOption } from "./detection/options.ts";
import { findings, prepareCopy, type Decisions } from "./review.ts";
import { analyzeText, maskedText, type TextAnalysis } from "./text.ts";
import type { Detection } from "./detection/types.ts";

export type Format = "text" | "excel";
export interface SampleSession {
  id: string;
  number: number;
  format: Format;
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
export type Session = SampleSession | TextSession;
export const historyKey = "offlinemask.sample-sessions.v1";
export function createSession(format: Format, existing: readonly Session[]): SampleSession {
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
export function sessionTitle(session: Session): string {
  if (session.fixture === "private-text-v1") return `Văn bản #${session.number}`;
  return `${session.format === "text" ? "Yêu cầu hỗ trợ" : "Giao dịch mẫu"} #${session.number}`;
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
export function decodeSessions(raw: string | null): SampleSession[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error("Unsupported history");
  const ids = new Set<string>();
  return data.sessions.map((s: SampleSession) => {
    if (
      !s ||
      typeof s.id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(s.id) ||
      ids.has(s.id) ||
      !Number.isSafeInteger(s.number) ||
      s.number < 1 ||
      !["text", "excel"].includes(s.format) ||
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
export const sheetHeaders = [
  "Họ và tên",
  "Số tài khoản",
  "Mã giao dịch",
  "Số điện thoại",
  "Email",
  "Số tiền (VND)",
];
export const sheetRows = [
  [
    "Nguyễn Minh Anh",
    "001234567890",
    "GD202609080126",
    "0901234567",
    "minh.anh@example.com",
    "2500000",
  ],
  [
    "Nguyễn Minh Anh",
    "001234567890",
    "GD202609080126",
    "0901234567",
    "minh.anh@example.com",
    "1500000",
  ],
];
export function maskedRows(decisions: Decisions): string[][] {
  prepareCopy(decisions); // Shared explicit-choice gate.
  return sheetRows.map((row) =>
    row.map((value) => {
      const finding = findings.find((f) => f.value === value);
      return finding && decisions[finding.id] === "mask" ? finding.alias : value;
    }),
  );
}
export function sessionOutput(session: Session): string {
  if (session.fixture === "private-text-v1")
    return maskedText(session.original, session.analysis, session.decisions);
  return session.format === "text"
    ? prepareCopy(session.decisions)
    : [sheetHeaders, ...maskedRows(session.decisions)].map((row) => row.join("\t")).join("\n");
}
