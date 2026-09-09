export type Decision = "pending" | "mask" | "keep";
export interface Finding {
  id: string;
  label: string;
  value: string;
  alias: string;
  reason: string;
  source: string;
}
export type Decisions = Record<string, Decision>;
export interface TextPart {
  text: string;
  findingId?: string;
}

// Curated synthetic fixtures for reviewing the interaction design, not a detector.
export const sampleText = `Kính gửi bộ phận hỗ trợ,\n\nTôi là Nguyễn Minh Anh, chủ tài khoản 001234567890. Ngày 08/09/2026, tôi thực hiện giao dịch chuyển 2.500.000 đồng nhưng người nhận chưa nhận được tiền.\n\nVui lòng kiểm tra giao dịch có mã GD202609080126. Tôi đã liên hệ tổng đài nhưng chưa nhận được phản hồi.\n\nCó thể liên hệ với tôi qua số 0901234567 hoặc email minh.anh@example.com.\n\nTrân trọng,\nNguyễn Minh Anh`;

export const findings: readonly Finding[] = [
  {
    id: "name",
    label: "Họ và tên",
    value: "Nguyễn Minh Anh",
    alias: "[TEN_DEMO_01]",
    reason:
      "Tên xuất hiện sau “Tôi là” và trong phần chữ ký. Hai vị trí dùng chung một bí danh.",
    source: "Ngữ cảnh và chữ ký · mẫu minh họa",
  },
  {
    id: "account",
    label: "Số tài khoản",
    value: "001234567890",
    alias: "[STK_DEMO_01]",
    reason:
      "Dãy số xuất hiện sau “chủ tài khoản”. Giữ nguyên các số 0 đầu khi đối chiếu bản gốc.",
    source: "Nhãn “chủ tài khoản” · mẫu minh họa",
  },
  {
    id: "reference",
    label: "Mã giao dịch",
    value: "GD202609080126",
    alias: "[GD_DEMO_01]",
    reason:
      "Mã giao dịch có thể dùng để truy ngược hồ sơ. Cân nhắc che nếu bản tóm tắt không cần mã này.",
    source: "Cần đánh giá theo mục đích sử dụng",
  },
  {
    id: "phone",
    label: "Số điện thoại",
    value: "0901234567",
    alias: "[SDT_DEMO_01]",
    reason:
      "Thông tin liên hệ xuất hiện sau “qua số”. Che số điện thoại khi không cần liên hệ trực tiếp.",
    source: "Thông tin liên hệ · mẫu minh họa",
  },
  {
    id: "email",
    label: "Email",
    value: "minh.anh@example.com",
    alias: "[EMAIL_DEMO_01]",
    reason:
      "Địa chỉ email trong phần thông tin liên hệ. Bí danh thay thế toàn bộ địa chỉ.",
    source: "Địa chỉ email · mẫu minh họa",
  },
];

export function initialDecisions(): Decisions {
  return Object.fromEntries(findings.map(({ id }) => [id, "pending"]));
}

export function splitText(
  text: string,
  entries: readonly Finding[],
): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let next: { index: number; finding: Finding } | undefined;
    for (const finding of entries) {
      if (!finding.value) continue;
      const index = text.indexOf(finding.value, cursor);
      if (index >= 0 && (!next || index < next.index))
        next = { index, finding };
    }
    if (!next) {
      parts.push({ text: text.slice(cursor) });
      break;
    }
    if (next.index > cursor)
      parts.push({ text: text.slice(cursor, next.index) });
    parts.push({ text: next.finding.value, findingId: next.finding.id });
    cursor = next.index + next.finding.value.length;
  }
  return parts;
}

export function pendingCount(decisions: Decisions): number {
  return findings.filter(
    ({ id }) => !decisions[id] || decisions[id] === "pending",
  ).length;
}

export function previewText(decisions: Decisions): string {
  return splitText(sampleText, findings)
    .map((part) => {
      const finding = findings.find((item) => item.id === part.findingId);
      return finding && decisions[finding.id] !== "keep"
        ? finding.alias
        : part.text;
    })
    .join("");
}

// Preparing a copy must never silently treat an unreviewed suggestion as accepted.
export function prepareCopy(decisions: Decisions): string {
  if (pendingCount(decisions))
    throw new Error("Review every finding before preparing a copy.");
  return previewText(decisions);
}
