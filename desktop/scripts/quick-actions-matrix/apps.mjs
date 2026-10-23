// The applications the matrix drives, and the fields it tries in each. `kind` picks how a
// window with the sample is opened and closed again (run.mjs); `expect` is what a click on
// the circle should do there: "replaced" in place, or "preview" (the card, nothing pasted).

/** @typedef {{ id: string, label: string, expect: "replaced" | "preview", domId?: string, role?: string, select?: "keys" | "triple-click" }} Field */
/** @typedef {{ name: string, bundles: string[], kind: "document" | "notes" | "safari" | "chrome" | "chat", fields: Field[] }} App */

/** The test page's four fields (test-page.html). */
const pageFields = [
  { id: "textarea", label: "textarea", expect: "replaced", domId: "field-textarea" },
  { id: "input", label: "input", expect: "replaced", domId: "field-input" },
  {
    id: "contenteditable",
    label: "contenteditable",
    expect: "replaced",
    domId: "field-contenteditable",
  },
  {
    id: "readonly",
    label: "read-only text",
    expect: "preview",
    domId: "field-readonly",
    select: "triple-click",
  },
];
const documentBody = [
  { id: "document", label: "document", expect: "replaced", role: "AXTextArea" },
];
/** A chat composer the owner has focused in a test conversation. */
const composer = [{ id: "composer", label: "message box", expect: "replaced" }];

/** @type {App[]} */
export const apps = [
  { name: "TextEdit", bundles: ["com.apple.TextEdit"], kind: "document", fields: documentBody },
  {
    name: "Notes",
    bundles: ["com.apple.Notes"],
    kind: "notes",
    fields: [{ id: "note", label: "note", expect: "replaced", role: "AXTextArea" }],
  },
  { name: "Safari", bundles: ["com.apple.Safari"], kind: "safari", fields: pageFields },
  { name: "Chrome", bundles: ["com.google.Chrome"], kind: "chrome", fields: pageFields },
  { name: "Word", bundles: ["com.microsoft.Word"], kind: "document", fields: documentBody },
  { name: "Pages", bundles: ["com.apple.iWork.Pages"], kind: "document", fields: documentBody },
  { name: "Zalo", bundles: ["com.vng.zalo"], kind: "chat", fields: composer },
  {
    name: "Messenger",
    bundles: ["com.facebook.archon", "com.facebook.archon.developerID"],
    kind: "chat",
    fields: composer,
  },
  {
    name: "Telegram",
    bundles: ["ru.keepcoder.Telegram", "com.tdesktop.Telegram"],
    kind: "chat",
    fields: composer,
  },
  {
    name: "Lark",
    bundles: ["com.larksuite.larkApp", "com.bytedance.lark"],
    kind: "chat",
    fields: composer,
  },
];

/** Synthetic sample: a name, a phone number, an email and an address, none of them real. */
export const sample =
  "Chị Trần Thị Mai, số điện thoại 0901 234 567, email mai.tran@example.com, hẹn gặp ở 12 Lê Lợi, Quận 1.";
/** Values that must be gone from a field the click replaced. */
export const rawValues = ["0901 234 567", "mai.tran@example.com", "Trần Thị Mai"];
