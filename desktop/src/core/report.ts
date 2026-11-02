// Bug reports and suggestions (decisions 0147, 0197). The app never sends anything: it opens the report page on
// OfflineMask.com with what the user wrote in the address's fragment, which the browser keeps
// to itself, and the user presses Gửi there.

export const reportPage = "https://offlinemask.com/bao-loi";

/** The choices the report dialog offers; landing/worker.js accepts exactly these kinds, and
 * landing/bao-loi.html offers the same labels and examples. */
export const reportKinds = [
  {
    kind: "missed",
    label: "Còn sót thông tin chưa ẩn",
    example: "Ví dụ: số điện thoại có dấu chấm ở giữa không được ẩn.",
  },
  {
    kind: "wrong",
    label: "Ẩn nhầm chữ bình thường",
    example: "Ví dụ: chữ “Tổng cộng” trong bảng bị thay bằng mã.",
  },
  {
    kind: "crash",
    label: "Ứng dụng báo lỗi, treo hoặc tự tắt",
    example: "Ví dụ: mở tệp Excel khoảng 20 MB thì ứng dụng treo.",
  },
  {
    kind: "idea",
    label: "Góp ý hoặc đề xuất tính năng mới",
    example: "Ví dụ: cho phép ẩn cả biển số xe.",
  },
  {
    kind: "other",
    label: "Chuyện khác",
    example: "Kể điều bạn muốn nhắn người làm OfflineMask.",
  },
] as const;
export type ReportKind = (typeof reportKinds)[number]["kind"];

/** The longest message the page accepts. */
export const reportMessageLimit = 2000;

export interface Report {
  kind: ReportKind;
  message: string;
  /** What the app adds by itself, shown to the user before the page opens. */
  version: string;
  os: string;
  screen: string;
}

/** The report page's address with the report filled in. */
export function reportUrl(report: Report): string {
  const fields = new URLSearchParams({
    kind: report.kind,
    message: report.message.trim().slice(0, reportMessageLimit),
    version: report.version,
    os: report.os,
    screen: report.screen,
  });
  return `${reportPage}#${fields}`;
}

/** The operating system's family from the web view's user agent; never its build or device. */
export function systemName(userAgent: string): string {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "";
}
