/** A synthetic sample file for "Thử với tệp mẫu". Every name, number and address is
 * invented; nothing here comes from real people. */
const families = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi"];
const middles = ["Minh", "Thu", "Quốc", "Ngọc", "Đức", "Thanh", "Gia", "Hải"];
const givens = ["Anh", "Hà", "Bảo", "Linh", "Long", "Trang", "Khang", "Yến", "Nam", "Vy"];
const streets = ["Lê Lợi", "Trần Hưng Đạo", "Nguyễn Huệ", "Hai Bà Trưng", "Lý Thường Kiệt"];
const notes = [
  "Khách hẹn gọi lại số 0912 345 678 sau 17 giờ.",
  "",
  "Đã đối soát, chờ hoàn tiền.",
  "Nếu không gọi được, gửi email cho ke.toan@example.com.",
  "",
];

export function sampleSheetCsv(rows = 30): string {
  const lines = [
    [
      "Họ và tên",
      "Số điện thoại",
      "Email",
      "Số tài khoản",
      "Địa chỉ",
      "Số tiền (VND)",
      "Ngày",
      "Ghi chú",
    ],
  ];
  for (let i = 0; i < rows; i++) {
    const family = families[i % families.length]!;
    const middle = middles[(i * 3) % middles.length]!;
    const given = givens[(i * 7) % givens.length]!;
    const plain = `${given}.${family}${i}`
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/gi, "d")
      .toLowerCase();
    lines.push([
      `${family} ${middle} ${given}`,
      `090${String(1_000_000 + i * 7_919).slice(-7)}`,
      `${plain}@example.com`,
      `00123${String(4_567_000 + i * 131).padStart(7, "0")}`,
      `${10 + i} ${streets[i % streets.length]}, Quận ${1 + (i % 12)}, TP.HCM`,
      String(250_000 * (1 + (i % 9))),
      `${String(1 + (i % 28)).padStart(2, "0")}/09/2026`,
      notes[i % notes.length]!,
    ]);
  }
  return lines
    .map((line) =>
      line.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","),
    )
    .join("\r\n");
}
export const sampleSheetName = "Giao dịch mẫu.csv";
