import { findings, prepareCopy, type Decisions } from "./review.ts";

export type Format = "text" | "excel";
export interface SampleSession {
  id: string;
  number: number;
  format: Format;
  fixture: "sample-v1";
  createdAt: string;
  decisions: Decisions;
}
export const historyKey = "offlinemask.sample-sessions.v1";
export function createSession(
  format: Format,
  existing: readonly SampleSession[],
): SampleSession {
  return {
    id: crypto.randomUUID(),
    number: existing.reduce((max, s) => Math.max(max, s.number), 0) + 1,
    format,
    fixture: "sample-v1",
    createdAt: new Date().toISOString(),
    decisions: Object.fromEntries(findings.map((f) => [f.id, "mask"])),
  };
}
export function sessionTitle(session: SampleSession): string {
  return `${session.format === "text" ? "Yêu cầu hỗ trợ" : "Giao dịch mẫu"} #${session.number}`;
}
// Store only versioned fixture references and choices. Never extend this to private
// input: persistent originals require the encrypted vault lifecycle in the PRD.
export function encodeSessions(sessions: readonly SampleSession[]): string {
  return JSON.stringify({
    version: 1,
    sessions: sessions.map((s) => ({
      id: s.id,
      number: s.number,
      format: s.format,
      fixture: s.fixture,
      createdAt: s.createdAt,
      decisions: Object.fromEntries(
        findings.map((f) => [f.id, s.decisions[f.id]]),
      ),
    })),
  });
}
export function decodeSessions(raw: string | null): SampleSession[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.sessions))
    throw new Error("Unsupported history");
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
      decisions: Object.fromEntries(
        findings.map((f) => [f.id, s.decisions[f.id]!]),
      ),
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
      return finding && decisions[finding.id] === "mask"
        ? finding.alias
        : value;
    }),
  );
}
export function sessionOutput(session: SampleSession): string {
  return session.format === "text"
    ? prepareCopy(session.decisions)
    : [sheetHeaders, ...maskedRows(session.decisions)]
        .map((row) => row.join("\t"))
        .join("\n");
}
