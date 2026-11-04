// Báo lỗi hoặc góp ý → a Google Sheet the owner and a few helpers share (decision 0198).
// Paste this file into the Sheet's Extensions > Apps Script, set the script property SECRET,
// run setup() once, then deploy it as a web app (execute as me, anyone can call it). The site's
// Worker posts each report here with that secret; the script adds a row with status "Mới".
//
// "Phản hồi" holds one row per report. "Bảng" shows them as columns by status, like a kanban
// board: changing a row's Trạng thái moves its card.

const DATA = "Phản hồi";
const BOARD = "Bảng";
const COLUMNS = [
  "Thời gian",
  "Loại",
  "Nội dung",
  "Phiên bản",
  "Hệ điều hành",
  "Màn hình",
  "Trạng thái",
  "Người xử lý",
  "Ghi chú",
  "Mã",
];
const STATUS = 7; // column G
const ID = 10; // column J, the Worker's key: a report is never added twice
const STATUSES = ["Mới", "Đang xem", "Đang sửa", "Xong", "Bỏ qua"];
const STATUS_COLOURS = {
  Mới: "#e3e9fd",
  "Đang xem": "#fdf3d7",
  "Đang sửa": "#fde4d7",
  Xong: "#dff0dc",
  "Bỏ qua": "#ececec",
};
const KINDS = {
  missed: "Còn sót",
  wrong: "Ẩn nhầm",
  crash: "Lỗi, treo",
  idea: "Góp ý",
  other: "Khác",
};

function doPost(event) {
  let report;
  try {
    report = JSON.parse(event.postData.contents);
  } catch {
    return reply("bad request");
  }
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || report.secret !== secret) return reply("forbidden");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = dataSheet();
    const last = sheet.getLastRow();
    const ids =
      last > 1
        ? sheet
            .getRange(2, ID, last - 1)
            .getValues()
            .flat()
        : [];
    if (!ids.includes(report.id)) {
      sheet.appendRow([
        new Date(report.at),
        KINDS[report.kind] ?? report.kind,
        asText(report.message),
        asText(report.version),
        asText(report.os),
        asText(report.screen),
        "Mới",
        "",
        "",
        asText(report.id),
      ]);
      notify(report);
    }
  } finally {
    lock.releaseLock();
  }
  return reply("ok");
}

/**
 * Emails the addresses in the script property NOTIFY (comma-separated) that a report arrived.
 * Only the kind and a link to the Sheet go in the email; the message stays in the Sheet.
 */
function notify(report) {
  const to = PropertiesService.getScriptProperties().getProperty("NOTIFY");
  if (!to) return;
  const kind = KINDS[report.kind] ?? "Khác";
  const url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  try {
    MailApp.sendEmail({
      to,
      subject: `OfflineMask: phản hồi mới (${kind})`,
      body: `Có một phản hồi mới loại "${kind}". Xem trong bảng tính:\n${url}`,
    });
  } catch {
    // Over the daily mail quota or not authorised yet: the row is already there.
  }
}

/** Run from the editor after setting NOTIFY: grants the mail permission and sends a test. */
function testNotify() {
  notify({ kind: "other" });
}

/** Run once from the editor: headers, the status dropdown and colours, and the board. */
function setup() {
  const sheet = dataSheet();
  // Reports that came in before setup start at row 1: make room for the headers above them.
  if (sheet.getLastRow() > 0 && sheet.getRange(1, 1).getValue() !== COLUMNS[0]) {
    sheet.insertRowBefore(1);
  }
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  [150, 90, 420, 80, 100, 100, 110, 120, 220, 210].forEach((width, i) =>
    sheet.setColumnWidth(i + 1, width),
  );
  const rows = sheet.getRange(2, 1, sheet.getMaxRows() - 1, COLUMNS.length);
  rows.setVerticalAlignment("top");
  sheet.getRange(2, 3, sheet.getMaxRows() - 1).setWrap(true);
  sheet.getRange(2, 1, sheet.getMaxRows() - 1).setNumberFormat("dd/mm/yyyy hh:mm");
  const statuses = sheet.getRange(2, STATUS, sheet.getMaxRows() - 1);
  statuses.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build(),
  );
  sheet.setConditionalFormatRules(
    STATUSES.map((status) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(status)
        .setBackground(STATUS_COLOURS[status])
        .setRanges([statuses])
        .build(),
    ),
  );

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const board = spreadsheet.getSheetByName(BOARD) ?? spreadsheet.insertSheet(BOARD);
  board.clear();
  const columns = STATUSES.slice(0, 4);
  board.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight("bold");
  columns.forEach((status, i) => {
    board.getRange(1, i + 1).setBackground(STATUS_COLOURS[status]);
    // Newest first: "Góp ý · 02/11 · cho phép ẩn cả biển số xe". setFormula takes the US
    // syntax (commas) whatever the Sheet's locale.
    const match = `'${DATA}'!G2:G="${status}"`;
    const card = `'${DATA}'!B2:B&" · "&TEXT('${DATA}'!A2:A,"dd/mm")&" · "&'${DATA}'!C2:C`;
    board
      .getRange(2, i + 1)
      .setFormula(
        `=IFERROR(SORT(FILTER(${card},${match}),FILTER('${DATA}'!A2:A,${match}),FALSE),"")`,
      );
    board.setColumnWidth(i + 1, 280);
  });
  board.setFrozenRows(1);
  board.getRange(2, 1, board.getMaxRows() - 1, columns.length).setWrap(true);
  board.getRange(2, 1, board.getMaxRows() - 1, columns.length).setVerticalAlignment("top");
}

function dataSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(DATA) ?? spreadsheet.insertSheet(DATA, 0);
}

/** Visitors write the message: never let it start a formula. */
function asText(value) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function reply(text) {
  return ContentService.createTextOutput(text);
}
