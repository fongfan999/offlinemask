/** Fixed synthetic narrative, not a detector or an AI integration. */
export const demoValues = {
  name: { real: "Nguyễn Minh An", alias: "[TEN_1_3030]", kind: "Họ tên" },
  id: { real: "079203001234", alias: "[CCCD_1_3030]", kind: "CCCD" },
  account: { real: "012345678901", alias: "[STK_1_3030]", kind: "Số tài khoản" },
  email: { real: "an@example.com", alias: "[EMAIL_1_3030]", kind: "Email" },
  phone: { real: "0903 123 456", alias: "[SDT_1_3030]", kind: "Số điện thoại" },
};

// Paragraphs of plain strings, { value } references and { strong } emphasis.
const request = [
  ["Tóm tắt giao dịch sau và soạn email xác nhận cho khách:"],
  [
    "Khách hàng ",
    { value: "name" },
    " (CCCD ",
    { value: "id" },
    ") chuyển ",
    { strong: "12.500.000 đồng" },
    " từ tài khoản ",
    { value: "account" },
    ".",
  ],
  ["Liên hệ: ", { value: "email" }, " · ", { value: "phone" }],
];
const reply = [
  [
    { strong: "Tóm tắt. " },
    { value: "name" },
    " chuyển 12.500.000 đồng từ tài khoản ",
    { value: "account" },
    ".",
  ],
  [
    { strong: "Email. " },
    "Gửi ",
    { value: "email" },
    ": “Chào anh/chị ",
    { value: "name" },
    ", chúng tôi xác nhận đã nhận khoản chuyển 12.500.000 đồng của anh/chị…”",
  ],
];

export const demoStages = [
  {
    id: "original",
    where: "Trên máy bạn",
    file: "yeu-cau.txt",
    document: request,
    masked: false,
    note: "5 thông tin định danh. AI không cần biết chúng để làm việc.",
  },
  {
    id: "masked",
    where: "Bản gửi AI",
    file: "yeu-cau · đã ẩn",
    document: request,
    masked: true,
    note: "AI vẫn hiểu: một khách hàng chuyển 12,5 triệu đồng. Nhưng không biết là ai.",
  },
  {
    id: "restored",
    where: "Trở lại máy bạn",
    file: "phan-hoi · đã khôi phục",
    document: reply,
    masked: false,
    note: "AI trả lời bằng mã. OfflineMask đổi mã về thông tin thật, ngay trên máy.",
  },
];
