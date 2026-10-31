import {
  account,
  address,
  bankShort,
  banks,
  bhyt,
  company,
  customerCode,
  date,
  diagnoses,
  divisions,
  employeeCode,
  hospitals,
  inWords,
  labTests,
  money,
  orderItems,
  person,
  phone,
  plate,
  positions,
  schools,
  stateBody,
  studentId,
  subjects,
  taxCode,
  unaccented,
  utilities,
  violations,
} from "./data.mjs";
import { nationalHeader, recorder } from "./model.mjs";

/** The wider synthetic set (decision 0160): official decisions and notices, payslips,
 * medical records, utility bills, letters, minutes, transcripts and orders, each kind in
 * two or three layouts. The same recorder rules as kinds.mjs: people, their numbers,
 * addresses and private companies are hidden; state bodies, headings, wording and amounts
 * stay; banks, hospitals, schools, utilities and reference codes may go either way. */

/** The two-cell header of an official document: the body on the left, the national
 * motto on the right, then the number and the place and date of issue. */
const officialHeader = (r, body, number) => [
  {
    table: {
      columns: [
        {
          title: r.keep(`${body.committeeCapitals} ${body.department.toUpperCase()}`),
          width: 0.45,
        },
        {
          title: r.keep("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM Độc lập - Tự do - Hạnh phúc"),
          width: 0.55,
        },
      ],
      rows: [[`Số: ${r.ignore(number)}`, r.keep(body.issuePlace)]],
    },
  },
  { space: 8 },
];
const receivers = (r, role, signer) => [
  { space: 8 },
  {
    signatures: [
      { role: r.keep("Nơi nhận:"), note: r.keep("- Như Điều 4; - Lưu: VT, TTDVVL."), name: "" },
      { role: r.keep(role), note: "", name: r.hide(signer.name) },
    ],
  },
];

function decision(rng, layout) {
  const r = recorder();
  const body = stateBody(rng);
  const me = person(rng);
  const signer = person(rng);
  const blocks = [];
  if (layout === "benefit") {
    const months = rng.int(3, 12);
    const amount = rng.int(40, 240) * 100_000;
    const bank = rng.pick(banks);
    const flat = `Căn hộ chung cư số ${rng.pick(["A", "B", "C"])}${rng.int(1, 30)}.${String(rng.int(1, 20)).padStart(2, "0")} thuộc khu ${rng.pick(["phức hợp căn hộ Nhật Hoa", "đô thị Vinhomes Grand Park", "chung cư Hoàng Huy"])}, ${address(rng).split(", ").slice(1).join(", ")}`;
    blocks.push(
      ...officialHeader(r, body, `${rng.digits(6)}/QĐ-SNV-TCTN`),
      { title: r.keep("QUYẾT ĐỊNH"), size: 3 },
      { text: r.keep("Về việc hưởng trợ cấp thất nghiệp"), align: "center", bold: true },
      { text: r.keep(`GIÁM ĐỐC ${body.departmentCapitals}`), align: "center", bold: true },
      {
        text: `Căn cứ Luật Việc làm ngày 16 tháng 6 năm 2025; Căn cứ Nghị định số 374/2025/NĐ-CP ngày 31 tháng 12 năm 2025 của Chính phủ; Căn cứ Quyết định số 03/2025/QĐ-UBND của ${r.keep(body.committee)} về chức năng, nhiệm vụ của ${r.keep(body.departmentWithCity)}; Căn cứ hồ sơ đề nghị hưởng trợ cấp thất nghiệp của ông/bà ${r.hide(me.name)}; Theo đề nghị của Giám đốc ${r.keep(body.jobs)}.`,
      },
      { title: r.keep("QUYẾT ĐỊNH:"), size: 0 },
      { text: r.keep("Điều 1. Trợ cấp thất nghiệp đối với:"), bold: true },
      { text: `${me.title}/bà ${r.hide(me.name)} · Sinh ngày ${r.hide(me.birth)}.` },
      {
        fields: [
          [rng.pick(["Số định danh cá nhân", "Số CCCD"]), r.hide(me.cccd)],
          ["Ngày cấp", r.ignore(date(rng, 2023))],
        ],
        columns: 2,
      },
      { fields: [["Nơi thường trú", r.hide(me.address)]] },
      {
        fields: [
          [
            rng.pick(["Nơi ở hiện nay", "Chỗ ở hiện nay"]),
            r.hide(rng.chance(0.5) ? flat : address(rng)),
          ],
        ],
      },
      {
        text: r.keep(
          `Tổng số tháng đóng bảo hiểm thất nghiệp để giải quyết hưởng trợ cấp thất nghiệp: ${rng.int(12, 120)} tháng. Mức trợ cấp thất nghiệp hằng tháng: ${money(amount)} đồng (Số tiền bằng chữ: ${inWords(amount)}). Số tháng được hưởng trợ cấp thất nghiệp: ${months} tháng.`,
        ),
      },
      { text: r.keep("Nhận trợ cấp thất nghiệp qua tài khoản ngân hàng:") },
      {
        fields: [
          ["- Tên chủ tài khoản", r.hide(me.name)],
          ["Số tài khoản", r.hide(account(rng))],
        ],
        columns: 2,
      },
      { fields: [["- Tại ngân hàng", r.ignore(bank)]] },
      { fields: [["Nơi đăng ký khám, chữa bệnh ban đầu", r.ignore(rng.pick(hospitals))]] },
      {
        text: r.keep(
          `Điều 2. Trong thời gian hưởng trợ cấp thất nghiệp, ông/bà có trách nhiệm thông báo hằng tháng với ${body.jobs} về việc tìm kiếm việc làm theo quy định. Điều 3. Quyết định này có hiệu lực kể từ ngày ký. Điều 4. Giám đốc ${body.social}; Giám đốc ${body.jobs} và ông/bà có tên trên chịu trách nhiệm thi hành Quyết định này./.`,
        ),
      },
      ...receivers(r, "KT. GIÁM ĐỐC PHÓ GIÁM ĐỐC", signer),
    );
  } else if (layout === "penalty") {
    const fine = rng.pick([150_000, 400_000, 800_000, 1_500_000, 4_000_000]);
    blocks.push(
      ...nationalHeader(r),
      { text: r.keep(body.police.toUpperCase()), align: "left", bold: true },
      { text: `Số: ${r.ignore(`${rng.int(1, 999)}/QĐ-XPHC`)}`, align: "left" },
      { title: r.keep("QUYẾT ĐỊNH"), size: 3 },
      { text: r.keep("Xử phạt vi phạm hành chính"), align: "center", bold: true },
      { text: r.keep(`TRƯỞNG ${body.police.toUpperCase()}`), align: "center", bold: true },
      {
        text: r.keep(
          "Căn cứ Điều 57, Điều 68 Luật Xử lý vi phạm hành chính; Căn cứ Nghị định số 168/2024/NĐ-CP của Chính phủ; Căn cứ Biên bản vi phạm hành chính lập ngày " +
            date(rng) +
            ".",
        ),
      },
      { title: r.keep("QUYẾT ĐỊNH:"), size: 0 },
      { text: r.keep("Điều 1. Xử phạt vi phạm hành chính đối với:"), bold: true },
      {
        fields: [
          ["Họ và tên", r.hide(me.name)],
          ["Giới tính", (r.keep(`Giới tính: ${me.sex}`), me.sex)],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Ngày, tháng, năm sinh", r.hide(me.birth)],
          ["Quốc tịch", (r.keep("Quốc tịch: Việt Nam"), "Việt Nam")],
        ],
        columns: 2,
      },
      {
        fields: [
          [rng.pick(["Số định danh cá nhân", "Số CCCD"]), r.hide(me.cccd)],
          ["Ngày cấp", r.ignore(date(rng, 2022))],
        ],
        columns: 2,
      },
      { fields: [["Nơi cư trú hiện tại", r.hide(me.address)]] },
      { fields: [["Phương tiện", `Xe mô tô biển số ${r.ignore(plate(rng))}`]] },
      {
        text: `Đã thực hiện hành vi vi phạm hành chính: ${r.keep(rng.pick(violations))}, quy định tại Nghị định số 168/2024/NĐ-CP.`,
      },
      {
        text: r.keep(
          `Hình thức xử phạt chính: phạt tiền. Mức phạt: ${money(fine)} đồng (Bằng chữ: ${inWords(fine)}).`,
        ),
      },
      {
        text: r.keep(
          `Điều 2. Quyết định này có hiệu lực kể từ ngày ký. Điều 3. Ông/bà có tên tại Điều 1 phải nộp tiền phạt tại Kho bạc Nhà nước ${body.city} trong thời hạn 10 ngày kể từ ngày nhận được Quyết định.`,
        ),
      },
      { space: 6 },
      {
        signatures: [
          { role: r.keep("Nơi nhận:"), note: r.keep("- Người bị xử phạt; - Lưu: HS."), name: "" },
          {
            role: r.keep("TRƯỞNG CÔNG AN PHƯỜNG"),
            note: r.keep(rng.pick(["Thiếu tá", "Đại úy", "Trung tá"])),
            name: r.hide(signer.name),
          },
        ],
      },
    );
  } else {
    const due = rng.int(5, 90) * 100_000;
    const office = rng.chance(0.5) ? body.tax : body.social;
    blocks.push(
      {
        table: {
          columns: [
            { title: r.keep(office.toUpperCase()), width: 0.45 },
            {
              title: r.keep("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM Độc lập - Tự do - Hạnh phúc"),
              width: 0.55,
            },
          ],
          rows: [
            [
              `Số: ${r.ignore(`${rng.int(100, 9999)}/TB-${office === body.tax ? "CCT" : "BHXH"}`)}`,
              r.keep(body.issuePlace),
            ],
          ],
        },
      },
      { space: 8 },
      { title: r.keep("THÔNG BÁO"), size: 3 },
      {
        text: r.keep(
          office === body.tax
            ? "Về việc nộp tiền thuế, tiền chậm nộp"
            : "Về việc đóng bảo hiểm xã hội tự nguyện",
        ),
        align: "center",
        bold: true,
      },
      { text: `Kính gửi: ${me.title} ${r.hide(me.name)}` },
      {
        fields: [
          [
            office === body.tax ? "Mã số thuế" : "Mã số BHXH",
            r.hide(office === body.tax ? taxCode(rng) : rng.digits(10)),
          ],
          ["Điện thoại", r.hide(me.phone)],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ", r.hide(me.address)]] },
      {
        text: r.keep(
          `${office} thông báo số tiền ông/bà phải nộp là ${money(due)} đồng (Bằng chữ: ${inWords(due)}), hạn nộp ngày ${date(rng)}. Quá thời hạn trên, ông/bà sẽ bị tính tiền chậm nộp theo quy định.`,
        ),
      },
      { text: r.keep(`Mọi thắc mắc xin liên hệ ${office}, hoặc tổng đài hỗ trợ của ngành.`) },
      { text: r.keep("Trân trọng thông báo./.") },
      { space: 6 },
      {
        signatures: [
          { role: r.keep("Nơi nhận:"), note: r.keep("- Như trên; - Lưu: VT."), name: "" },
          {
            role: r.keep(
              office === body.tax ? "KT. CHI CỤC TRƯỞNG PHÓ CHI CỤC TRƯỞNG" : "GIÁM ĐỐC",
            ),
            note: "",
            name: r.hide(signer.name),
          },
        ],
      },
    );
  }
  return { blocks, font: "serif", size: 10.5, ...r.lists() };
}

function payslip(rng, layout) {
  const r = recorder();
  const employer = company(rng);
  const me = person(rng);
  const base = rng.int(8, 40) * 1_000_000;
  const allowance = rng.int(0, 5) * 500_000;
  const social = Math.round(base * 0.08),
    health = Math.round(base * 0.015),
    jobless = Math.round(base * 0.01);
  const taxable = Math.max(0, base + allowance - social - health - jobless - 11_000_000);
  const tax = Math.round(taxable * 0.1);
  const net = base + allowance - social - health - jobless - tax;
  const month = `${String(rng.int(1, 12)).padStart(2, "0")}/2026`;
  const blocks = [
    { text: r.hide(employer.name), bold: true },
    { text: r.hide(employer.address) },
    { title: r.keep(`PHIẾU LƯƠNG THÁNG ${month}`), size: 3 },
    { space: 4 },
    {
      fields: [
        ["Họ và tên", r.hide(me.name)],
        ["Mã nhân viên", r.hide(employeeCode(rng))],
      ],
      columns: 2,
    },
    {
      fields: [
        ["Phòng ban", r.keep(rng.pick(divisions))],
        ["Chức vụ", r.keep(rng.pick(positions))],
      ],
      columns: 2,
    },
    {
      fields: [
        ["Số tài khoản", `${r.hide(account(rng))} - ${r.ignore(rng.pick(bankShort))}`],
        ["Mã số thuế cá nhân", r.hide(taxCode(rng))],
      ],
      columns: 2,
    },
    { space: 4 },
  ];
  const lines = [
    ["Lương cơ bản", base],
    ["Phụ cấp ăn trưa, xăng xe", allowance],
    ["BHXH (8%)", -social],
    ["BHYT (1,5%)", -health],
    ["BHTN (1%)", -jobless],
    ["Thuế TNCN", -tax],
  ];
  if (layout === "table")
    blocks.push({
      table: {
        columns: [
          { title: "STT", width: 0.08, align: "center" },
          { title: "Khoản mục", width: 0.52 },
          { title: "Số tiền (VND)", width: 0.4, align: "right" },
        ],
        rows: lines.map(([label, value], index) => [
          String(index + 1),
          r.keep(label),
          value ? r.keep(money(value)) : "0",
        ]),
        total: { label: r.keep("Thực lĩnh"), value: r.keep(money(net)) },
      },
    });
  else
    blocks.push(
      ...lines.map(([label, value]) => ({
        fields: [[r.keep(label), value ? r.keep(money(value)) : "0"]],
      })),
      { fields: [["Thực lĩnh", r.keep(money(net))]] },
      { text: r.keep(`Bằng chữ: ${inWords(net)}`) },
    );
  blocks.push(
    { space: 8 },
    {
      signatures: [
        { role: r.keep("Người lập phiếu"), note: "", name: r.hide(person(rng).name) },
        { role: r.keep("Kế toán trưởng"), note: "", name: r.hide(person(rng).name) },
        { role: r.keep("Người nhận"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
      ],
    },
  );
  return { blocks, font: "sans", size: 10, ...r.lists() };
}

function medical(rng, layout) {
  const r = recorder();
  const hospital = r.ignore(rng.pick(hospitals));
  const me = person(rng);
  const doctor = person(rng);
  const blocks = [
    { text: hospital, bold: true },
    { text: r.keep(`Khoa ${rng.pick(["Nội tổng quát", "Xét nghiệm", "Tim mạch", "Nhi"])}`) },
    { title: r.keep(layout === "lab" ? "PHIẾU KẾT QUẢ XÉT NGHIỆM" : "PHIẾU KHÁM BỆNH"), size: 3 },
    { space: 4 },
    {
      fields: [
        ["Họ tên người bệnh", r.hide(rng.chance(0.5) ? me.name.toUpperCase() : me.name)],
        ...(rng.chance(0.5)
          ? [["Ngày sinh", r.hide(me.birth)]]
          : [["Năm sinh", r.ignore(me.birth.slice(-4))]]),
      ],
      columns: 2,
    },
    {
      fields: [
        ["Giới tính", (r.keep(`Giới tính: ${me.sex}`), me.sex)],
        ["Mã bệnh nhân", r.hide(`BN${rng.digits(8)}`)],
      ],
      columns: 2,
    },
    {
      fields: [
        ["Số thẻ BHYT", r.hide(bhyt(rng))],
        ["Điện thoại", r.hide(me.phone)],
      ],
      columns: 2,
    },
    { fields: [["Địa chỉ", r.hide(me.address)]] },
    { space: 4 },
  ];
  if (layout === "lab") {
    const rows = rng.shuffle(labTests).slice(0, rng.int(4, 7));
    blocks.push(
      {
        fields: [
          ["Ngày lấy mẫu", r.keep(date(rng))],
          ["Bác sĩ chỉ định", `BS. ${r.hide(doctor.name)}`],
        ],
        columns: 2,
      },
      {
        table: {
          columns: [
            { title: "Xét nghiệm", width: 0.4 },
            { title: "Kết quả", width: 0.2, align: "right" },
            { title: "Đơn vị", width: 0.15, align: "center" },
            { title: "Trị số tham chiếu", width: 0.25, align: "center" },
          ],
          rows: rows.map(([name, unit, range]) => [
            r.keep(name),
            String(rng.int(1, 300) / (unit === "T/L" ? 50 : 1)).replace(".", ","),
            unit,
            r.keep(range),
          ]),
        },
      },
      {
        text: r.keep(
          "Kết luận: Các chỉ số trong giới hạn bình thường. Đề nghị tái khám sau 6 tháng.",
        ),
      },
    );
  } else {
    blocks.push(
      { fields: [["Ngày khám", r.keep(date(rng))]] },
      {
        fields: [
          [
            "Lý do khám",
            r.keep(
              rng.pick([
                "Đau họng, sốt 2 ngày",
                "Chóng mặt khi thay đổi tư thế",
                "Khám sức khỏe định kỳ",
              ]),
            ),
          ],
        ],
      },
      { fields: [["Chẩn đoán", r.keep(rng.pick(diagnoses))]] },
      {
        text: r.keep(
          `Chỉ định: ${rng.pick(["Xét nghiệm máu tổng quát, siêu âm bụng.", "Đo điện tim, chụp X-quang ngực thẳng.", "Nội soi dạ dày."])} Hướng điều trị: điều trị ngoại trú, tái khám sau ${rng.int(1, 4)} tuần.`,
        ),
      },
    );
  }
  blocks.push(
    { space: 8 },
    {
      signatures: [
        { role: "", note: "", name: "" },
        {
          role: r.keep(layout === "lab" ? "Trưởng khoa Xét nghiệm" : "Bác sĩ điều trị"),
          note: "(Ký, ghi rõ họ tên)",
          name: `BS. ${r.hide(doctor.name)}`,
        },
      ],
    },
  );
  return { blocks, font: "sans", size: 10, ...r.lists() };
}

function utility(rng, layout) {
  const r = recorder();
  const me = person(rng);
  const blocks = [];
  if (layout === "electric") {
    const supplier = r.ignore(rng.pick(utilities.electric));
    const previous = rng.int(1000, 90000),
      used = rng.int(80, 600);
    const tiers = [
      [50, 1893],
      [50, 1956],
      [100, 2271],
      [100, 2860],
      [100, 3197],
      [Infinity, 3302],
    ];
    const rows = [];
    let left = used,
      total = 0;
    for (const [span, price] of tiers) {
      if (left <= 0) break;
      const kwh = Math.min(left, span);
      rows.push([`Bậc ${rows.length + 1}`, String(kwh), money(price), money(kwh * price)]);
      total += kwh * price;
      left -= kwh;
    }
    const vat = Math.round(total * 0.08);
    blocks.push(
      { text: supplier, bold: true },
      { title: r.keep("THÔNG BÁO TIỀN ĐIỆN"), size: 3 },
      { text: r.keep(`Kỳ hóa đơn: tháng ${rng.int(1, 12)}/2026`), align: "center" },
      {
        fields: [
          ["Khách hàng", r.hide(me.name.toUpperCase())],
          ["Mã khách hàng", r.hide(customerCode(rng))],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ sử dụng điện", r.hide(me.address)]] },
      {
        fields: [
          ["Điện thoại", r.hide(me.phone)],
          ["Mã công tơ", r.ignore(rng.digits(10))],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Chỉ số cũ", String(previous)],
          ["Chỉ số mới", String(previous + used)],
          ["Điện năng tiêu thụ", r.keep(`${used} kWh`)],
        ],
        columns: 3,
      },
      {
        table: {
          columns: [
            { title: "Bậc thang", width: 0.25 },
            { title: "Sản lượng (kWh)", width: 0.25, align: "right" },
            { title: "Đơn giá", width: 0.25, align: "right" },
            { title: "Thành tiền", width: 0.25, align: "right" },
          ],
          rows,
          total: { label: r.keep("Tổng tiền điện chưa thuế"), value: r.keep(money(total)) },
        },
      },
      {
        fields: [
          ["Thuế GTGT (8%)", r.keep(money(vat))],
          ["Tổng cộng", r.keep(money(total + vat))],
        ],
        columns: 2,
      },
      {
        text: r.keep(
          `Hạn thanh toán: ${date(rng)}. Thanh toán qua ứng dụng ngân hàng, ví điện tử hoặc tại điểm thu.`,
        ),
      },
      { text: `Tổng đài chăm sóc khách hàng: ${r.ignore("1900 545454")}` },
    );
  } else {
    const supplier = r.ignore(rng.pick(utilities.internet));
    const fee = rng.pick([165_000, 220_000, 280_000, 350_000]);
    blocks.push(
      { text: supplier, bold: true },
      { title: r.keep("THÔNG BÁO CƯỚC DỊCH VỤ"), size: 3 },
      { text: r.keep(`Tháng ${rng.int(1, 12)}/2026`), align: "center" },
      {
        fields: [
          ["Tên khách hàng", r.hide(me.name)],
          ["Mã thuê bao", r.hide(`${rng.pick(["SGH", "HNI", "DNG"])}${rng.digits(7)}`)],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ lắp đặt", r.hide(me.address)]] },
      {
        fields: [
          ["Số điện thoại liên hệ", r.hide(me.phone)],
          ["Email", r.hide(me.email)],
        ],
        columns: 2,
      },
      {
        table: {
          columns: [
            { title: "Dịch vụ", width: 0.5 },
            { title: "Gói cước", width: 0.25 },
            { title: "Thành tiền", width: 0.25, align: "right" },
          ],
          rows: [
            [
              r.keep("Internet cáp quang"),
              r.keep(rng.pick(["Home 1", "Fiber 150", "Giga Home"])),
              money(fee),
            ],
            [r.keep("Truyền hình"), r.keep("Gói cơ bản"), money(50_000)],
          ],
          total: { label: r.keep("Tổng cộng (đã gồm VAT)"), value: r.keep(money(fee + 50_000)) },
        },
      },
      {
        text: r.keep(`Vui lòng thanh toán trước ngày ${date(rng)} để dịch vụ không bị gián đoạn.`),
      },
      { text: `Hỗ trợ kỹ thuật: ${r.ignore("1800 1166")}` },
    );
  }
  return { blocks, font: "sans", size: 10, ...r.lists() };
}

function letter(rng, layout) {
  const r = recorder();
  const me = person(rng);
  const signer = person(rng);
  const blocks = [];
  if (layout === "offer") {
    const employer = company(rng);
    const hr = person(rng);
    const salary = rng.int(10, 50) * 1_000_000;
    blocks.push(
      { text: r.hide(employer.name), bold: true },
      { text: r.hide(employer.address) },
      { title: r.keep("THƯ MỜI NHẬN VIỆC"), size: 3 },
      {
        text: `${r.ignore(rng.pick(["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"]))}, ngày ${date(rng)}`,
        align: "right",
      },
      { text: `Kính gửi: ${me.title} ${r.hide(me.name)}` },
      {
        text: `Chúng tôi vui mừng thông báo ${me.title.toLowerCase()} đã trúng tuyển vị trí ${r.keep(rng.pick(positions))}, thuộc ${r.keep(rng.pick(divisions))}.`,
      },
      {
        text: r.keep(
          `Mức lương: ${money(salary)} đồng/tháng (gross). Thời gian thử việc: 2 tháng. Ngày bắt đầu làm việc dự kiến: ${date(rng)}. Thời gian làm việc: thứ Hai đến thứ Sáu, 8h30 - 17h30.`,
        ),
      },
      { text: `Địa điểm làm việc: ${r.hide(employer.address)}.` },
      {
        text: `Vui lòng xác nhận trước ngày ${date(rng)} với ${hr.title.toLowerCase()} ${r.hide(hr.name)} (Phòng Nhân sự), điện thoại ${r.hide(hr.phone)}, email ${r.hide(hr.email)}.`,
      },
      { text: r.keep("Rất mong được chào đón bạn gia nhập đội ngũ của chúng tôi.") },
      { space: 8 },
      {
        signatures: [
          { role: "", note: "", name: "" },
          { role: r.keep("GIÁM ĐỐC"), note: "(Ký, đóng dấu)", name: r.hide(signer.name) },
        ],
      },
    );
  } else {
    const bank = r.ignore(rng.pick(banks));
    const debt = rng.int(5, 400) * 100_000;
    blocks.push(
      { text: bank, bold: true },
      { title: r.keep("THÔNG BÁO NHẮC NỢ"), size: 3 },
      { text: `Kính gửi: ${me.title} ${r.hide(me.name)}` },
      {
        fields: [
          ["Số hợp đồng", r.ignore(`HĐ${rng.digits(8)}`)],
          ["Số tài khoản", r.hide(account(rng))],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ", r.hide(me.address)]] },
      {
        text: r.keep(
          `Ngân hàng trân trọng thông báo khoản vay của Quý khách có dư nợ đến hạn là ${money(debt)} đồng (Bằng chữ: ${inWords(debt)}), ngày đến hạn ${date(rng)}. Đề nghị Quý khách thanh toán đúng hạn để tránh phát sinh lãi quá hạn và ảnh hưởng đến lịch sử tín dụng.`,
        ),
      },
      {
        text: `Mọi thắc mắc xin liên hệ nhân viên quản lý khoản vay ${r.hide(signer.name)}, điện thoại ${r.hide(signer.phone)}, hoặc tổng đài ${r.ignore("1900 1234")}.`,
      },
      { text: r.keep("Trân trọng cảm ơn Quý khách đã sử dụng dịch vụ.") },
      { space: 8 },
      {
        signatures: [
          { role: "", note: "", name: "" },
          {
            role: r.keep("TRƯỞNG PHÒNG KHÁCH HÀNG CÁ NHÂN"),
            note: "",
            name: r.hide(person(rng).name),
          },
        ],
      },
    );
  }
  return { blocks, font: "serif", size: 11, ...r.lists() };
}

function minutes(rng, layout) {
  const r = recorder();
  const firm = company(rng);
  const blocks = [...nationalHeader(r)];
  if (layout === "meeting") {
    const people = Array.from({ length: rng.int(3, 6) }, () => person(rng));
    blocks.push(
      { title: r.keep("BIÊN BẢN HỌP"), size: 3 },
      {
        text: r.keep(
          rng.pick([
            "Về việc triển khai kế hoạch kinh doanh quý IV",
            "Về việc kiện toàn nhân sự phòng ban",
            "Về việc nghiệm thu dự án",
          ]),
        ),
        align: "center",
        bold: true,
      },
      {
        text: `Hôm nay, ngày ${date(rng)}, tại văn phòng ${r.hide(firm.name)}, địa chỉ ${r.hide(firm.address)}, đã diễn ra cuộc họp với thành phần như sau:`,
      },
      {
        table: {
          columns: [
            { title: "STT", width: 0.08, align: "center" },
            { title: "Họ và tên", width: 0.37 },
            { title: "Chức vụ", width: 0.3 },
            { title: "Đơn vị", width: 0.25 },
          ],
          rows: people.map((who, index) => [
            String(index + 1),
            r.hide(who.name),
            r.keep(index ? rng.pick(positions) : "Giám đốc"),
            r.keep(rng.pick(divisions)),
          ]),
        },
      },
      { text: r.keep("I. Nội dung cuộc họp"), bold: true },
      {
        text: r.keep(
          "1. Đánh giá kết quả kinh doanh quý III: doanh thu đạt 92% kế hoạch, chi phí vận hành giảm 4% so với cùng kỳ. 2. Thảo luận kế hoạch quý IV: mở rộng kênh bán hàng trực tuyến, tuyển thêm hai nhân sự kinh doanh. 3. Các ý kiến khác: cải thiện quy trình phê duyệt chi phí.",
        ),
      },
      { text: r.keep("II. Kết luận"), bold: true },
      {
        text: r.keep(
          "Các bộ phận triển khai theo phân công, báo cáo tiến độ vào thứ Sáu hằng tuần. Cuộc họp kết thúc lúc 11 giờ 30 cùng ngày.",
        ),
      },
      { space: 8 },
      {
        signatures: [
          { role: r.keep("THƯ KÝ"), note: "(Ký, ghi rõ họ tên)", name: r.hide(people.at(-1).name) },
          { role: r.keep("CHỦ TRÌ"), note: "(Ký, ghi rõ họ tên)", name: r.hide(people[0].name) },
        ],
      },
    );
  } else {
    const giver = person(rng);
    const taker = person(rng);
    const assets = rng
      .shuffle([
        ["Laptop Dell Latitude 5440", "Chiếc"],
        ["Màn hình LG 27 inch", "Chiếc"],
        ["Điện thoại Samsung Galaxy A55", "Chiếc"],
        ["Ghế xoay văn phòng", "Chiếc"],
        ["Thẻ ra vào tòa nhà", "Thẻ"],
      ])
      .slice(0, rng.int(2, 4));
    blocks.push(
      { title: r.keep("BIÊN BẢN BÀN GIAO TÀI SẢN"), size: 3 },
      { text: `Hôm nay, ngày ${date(rng)}, tại ${r.hide(firm.name)}, chúng tôi gồm:` },
      { text: r.keep("BÊN GIAO:"), bold: true },
      {
        fields: [
          ["Họ và tên", r.hide(giver.name)],
          ["Chức vụ", r.keep(rng.pick(positions))],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Số CCCD", r.hide(giver.cccd)],
          ["Điện thoại", r.hide(giver.phone)],
        ],
        columns: 2,
      },
      { text: r.keep("BÊN NHẬN:"), bold: true },
      {
        fields: [
          ["Họ và tên", r.hide(taker.name)],
          ["Chức vụ", r.keep(rng.pick(positions))],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Số CCCD", r.hide(taker.cccd)],
          ["Điện thoại", r.hide(taker.phone)],
        ],
        columns: 2,
      },
      { text: r.keep("Hai bên thống nhất bàn giao các tài sản sau:") },
      {
        table: {
          columns: [
            { title: "STT", width: 0.08, align: "center" },
            { title: "Tên tài sản", width: 0.42 },
            { title: "Đơn vị", width: 0.12, align: "center" },
            { title: "Số lượng", width: 0.13, align: "right" },
            { title: "Số serial", width: 0.25 },
          ],
          rows: assets.map(([name, unit], index) => [
            String(index + 1),
            r.keep(name),
            unit,
            "1",
            r.ignore(`SN${rng.digits(9)}`),
          ]),
        },
      },
      {
        text: r.keep(
          "Tình trạng tài sản: hoạt động bình thường. Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản.",
        ),
      },
      { space: 8 },
      {
        signatures: [
          { role: r.keep("BÊN GIAO"), note: "(Ký, ghi rõ họ tên)", name: r.hide(giver.name) },
          { role: r.keep("BÊN NHẬN"), note: "(Ký, ghi rõ họ tên)", name: r.hide(taker.name) },
        ],
      },
    );
  }
  return { blocks, font: rng.chance(0.5) ? "serif" : "sans", size: 10.5, ...r.lists() };
}

function transcript(rng, layout) {
  const r = recorder();
  const school = r.ignore(rng.pick(schools));
  const me = person(rng);
  const signer = person(rng);
  const className = r.keep(
    `${rng.pick(["KTPM", "CNTT", "QTKD", "KT"])}${rng.int(20, 24)}${rng.pick(["A", "B", "C"])}`,
  );
  const blocks = [
    { text: school, bold: true },
    { text: r.keep(`Phòng ${rng.pick(["Đào tạo", "Công tác sinh viên"])}`) },
  ];
  if (layout === "grades") {
    const rows = rng.shuffle(subjects).slice(0, rng.int(5, 8));
    blocks.push(
      { title: r.keep("BẢNG ĐIỂM HỌC TẬP"), size: 3 },
      { text: r.keep(`Học kỳ ${rng.int(1, 2)} năm học 2025 - 2026`), align: "center" },
      {
        fields: [
          ["Họ và tên", r.hide(me.name)],
          ["Mã sinh viên", r.hide(studentId(rng))],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Ngày sinh", r.hide(me.birth)],
          ["Lớp", className],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Ngành", r.keep(rng.pick(["Kỹ thuật phần mềm", "Quản trị kinh doanh", "Kế toán"]))],
        ],
      },
      {
        table: {
          columns: [
            { title: "STT", width: 0.08, align: "center" },
            { title: "Học phần", width: 0.47 },
            { title: "Số tín chỉ", width: 0.15, align: "center" },
            { title: "Điểm hệ 10", width: 0.15, align: "center" },
            { title: "Điểm chữ", width: 0.15, align: "center" },
          ],
          rows: rows.map((subject, index) => {
            const score = rng.int(50, 98) / 10;
            return [
              String(index + 1),
              r.keep(subject),
              String(rng.int(2, 4)),
              String(score).replace(".", ","),
              score >= 8.5 ? "A" : score >= 7 ? "B" : score >= 5.5 ? "C" : "D",
            ];
          }),
        },
      },
      {
        fields: [["Điểm trung bình học kỳ", String(rng.int(60, 95) / 10).replace(".", ",")]],
      },
    );
  } else {
    blocks.push(
      { title: r.keep("GIẤY XÁC NHẬN SINH VIÊN"), size: 3 },
      { text: `${r.ignore(school.replace(/^TRƯỜNG /, "Trường "))} ${r.keep("xác nhận:")}` },
      {
        fields: [
          ["Họ và tên", r.hide(me.name)],
          ["Mã số sinh viên", r.hide(studentId(rng))],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Ngày sinh", r.hide(me.birth)],
          ["Số CCCD", r.hide(me.cccd)],
        ],
        columns: 2,
      },
      { fields: [["Hộ khẩu thường trú", r.hide(me.address)]] },
      {
        fields: [
          ["Lớp", className],
          ["Khóa", r.keep(`${rng.int(2021, 2024)} - ${rng.int(2025, 2028)}`)],
        ],
        columns: 2,
      },
      {
        text: r.keep(
          "Hiện là sinh viên của Trường. Giấy xác nhận này dùng để bổ sung hồ sơ vay vốn tín dụng sinh viên và có giá trị trong 03 tháng kể từ ngày ký.",
        ),
      },
    );
  }
  blocks.push(
    { space: 4 },
    {
      text: r.keep(
        `${rng.pick(["Hà Nội", "Thành phố Hồ Chí Minh", "Cần Thơ"])}, ngày ${rng.int(1, 28)} tháng ${rng.int(1, 12)} năm 2026`,
      ),
      align: "right",
    },
    {
      signatures: [
        { role: "", note: "", name: "" },
        {
          role: r.keep("TL. HIỆU TRƯỞNG TRƯỞNG PHÒNG ĐÀO TẠO"),
          note: "",
          name: r.hide(signer.name),
        },
      ],
    },
  );
  return { blocks, font: "serif", size: 10.5, ...r.lists() };
}

function order(rng, layout) {
  const r = recorder();
  const me = person(rng);
  const blocks = [];
  if (layout === "delivery") {
    const shop = r.ignore(
      rng.pick([
        "Shop Thời Trang Mina",
        "Điện máy XANH",
        "Nhà sách Phương Nam",
        "Gia dụng Lộc Phát",
      ]),
    );
    const items = rng.shuffle(orderItems).slice(0, rng.int(1, 4));
    const rows = items.map(([name, [low, high]], index) => {
      const quantity = rng.int(1, 3);
      const price = Math.round(rng.int(low, high) / 1000) * 1000;
      return [
        String(index + 1),
        r.keep(name),
        String(quantity),
        money(price),
        money(quantity * price),
      ];
    });
    const total = rows.reduce((sum, row) => sum + Number(row[4].replace(/\./g, "")), 0);
    blocks.push(
      { title: r.keep("PHIẾU GIAO HÀNG"), size: 3 },
      {
        fields: [
          ["Mã đơn hàng", r.ignore(`DH${rng.digits(9)}`)],
          ["Mã vận đơn", r.ignore(`${rng.pick(["GHN", "SPX", "VTP"])}${rng.digits(10)}`)],
        ],
        columns: 2,
      },
      { text: r.keep("Người gửi"), bold: true },
      {
        fields: [
          ["Tên shop", shop],
          ["Điện thoại", r.hide(phone(rng))],
        ],
        columns: 2,
      },
      { text: r.keep("Người nhận"), bold: true },
      {
        fields: [
          ["Họ tên", r.hide(me.name)],
          ["Số điện thoại", r.hide(me.phone)],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ nhận", r.hide(me.address)]] },
      {
        table: {
          columns: [
            { title: "STT", width: 0.08, align: "center" },
            { title: "Sản phẩm", width: 0.47 },
            { title: "SL", width: 0.1, align: "center" },
            { title: "Đơn giá", width: 0.17, align: "right" },
            { title: "Thành tiền", width: 0.18, align: "right" },
          ],
          rows,
          total: { label: r.keep("Tiền thu hộ (COD)"), value: r.keep(money(total + 30_000)) },
        },
      },
      {
        text: r.keep(
          `Phí vận chuyển: ${money(30_000)} đồng. Ghi chú: ${rng.pick(["Giao giờ hành chính", "Gọi trước khi giao", "Cho xem hàng, không cho thử"])}.`,
        ),
      },
    );
  } else {
    const firm = company(rng);
    const amount = rng.int(5, 500) * 100_000;
    blocks.push(
      { text: r.hide(firm.name), bold: true },
      { text: r.hide(firm.address) },
      { title: r.keep("PHIẾU THU"), size: 3 },
      { text: `Ngày ${date(rng)}`, align: "center" },
      { text: `Số: ${r.ignore(`PT${rng.digits(5)}`)}`, align: "center" },
      { fields: [["Họ tên người nộp tiền", r.hide(me.name)]] },
      { fields: [["Địa chỉ", r.hide(me.address)]] },
      {
        fields: [
          [
            "Lý do nộp",
            r.keep(
              rng.pick([
                "Thanh toán tiền hàng theo hóa đơn",
                "Đặt cọc thuê văn phòng",
                "Hoàn tạm ứng công tác",
              ]),
            ),
          ],
        ],
      },
      { fields: [["Số tiền", r.keep(`${money(amount)} đồng`)]] },
      { fields: [["Viết bằng chữ", r.keep(inWords(amount))]] },
      { fields: [["Kèm theo", r.keep("01 chứng từ gốc")]] },
      { space: 8 },
      {
        signatures: [
          { role: r.keep("Giám đốc"), note: "(Ký, đóng dấu)", name: r.hide(person(rng).name) },
          { role: r.keep("Kế toán trưởng"), note: "", name: r.hide(person(rng).name) },
          { role: r.keep("Thủ quỹ"), note: "", name: r.hide(person(rng).name) },
          { role: r.keep("Người nộp tiền"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
        ],
      },
    );
  }
  return { blocks, font: "sans", size: 10, ...r.lists() };
}

/** A service contract's appendix whose parties are set out as a form with the labels in
 * a column of their own and the values in the next after a colon ("Ngày sinh   : …"),
 * its lines closer than a paragraph's, as office contracts are typed (decision 0183). In
 * "colon" the colon starts the values' column; in "label" it ends each label. */
function appendix(rng, layout) {
  const r = recorder();
  const client = company(rng);
  const director = person(rng);
  const me = person(rng);
  const fee = rng.int(10, 90) * 1_000_000;
  return {
    blocks: [
      ...nationalHeader(r),
      { title: r.keep("PHỤ LỤC HỢP ĐỒNG DỊCH VỤ"), size: 3 },
      { text: `Số: ${r.ignore(`${rng.int(1, 99)}/2026/PLHĐ`)}`, align: "center" },
      {
        text: `Hôm nay, ngày ${date(rng)}, tại ${r.ignore("Thành phố Hồ Chí Minh")}, chúng tôi gồm:`,
      },
      {
        aligned: layout,
        fields: [
          ["BÊN A", r.hide(client.name.toUpperCase())],
          ["Mã số thuế", r.hide(client.tax)],
          ["Địa chỉ trụ sở", r.hide(client.address)],
          ["Điện thoại", r.hide(client.phone)],
          ["Đại diện bởi", `${director.title} ${r.hide(director.name.toUpperCase())}`],
          ["Chức vụ", r.keep(rng.pick(["Giám đốc", "Tổng Giám đốc", "Giám đốc Tài chính"]))],
        ],
      },
      { space: 4 },
      {
        aligned: layout,
        fields: [
          ["BÊN B", r.hide(me.name.toUpperCase())],
          ["Ngày sinh", r.hide(me.birth)],
          ["Số CCCD", r.hide(me.cccd)],
          ["Ngày cấp", r.ignore(date(rng, rng.int(2021, 2024)))],
          ["Nơi cấp", r.ignore("Cục Cảnh sát quản lý hành chính về trật tự xã hội")],
          ["Địa chỉ thường trú", r.hide(me.address)],
          ["Mã số thuế cá nhân", r.hide(taxCode(rng))],
          ["Điện thoại", r.hide(me.phone)],
          ["Email", r.hide(me.email)],
          ["Tên tài khoản", r.hide(unaccented(me.name).toUpperCase())],
          ["Số tài khoản", r.hide(account(rng))],
          ["Ngân hàng", r.ignore(rng.pick(bankShort))],
        ],
      },
      { space: 4 },
      { text: r.keep("Điều 1. Nội dung phụ lục"), bold: true },
      {
        text: `Hai bên thống nhất bổ sung hạng mục thiết kế với tổng giá trị ${r.keep(money(fee))} đồng (Bằng chữ: ${r.keep(inWords(fee))}), thanh toán bằng chuyển khoản vào tài khoản của Bên B nêu trên.`,
      },
      { text: r.keep("Điều 2. Hiệu lực"), bold: true },
      { text: "Phụ lục là một phần không tách rời của hợp đồng và có hiệu lực kể từ ngày ký." },
      { space: 8 },
      {
        signatures: [
          { role: r.keep("ĐẠI DIỆN BÊN A"), note: "(Ký, đóng dấu)", name: r.hide(director.name) },
          { role: r.keep("ĐẠI DIỆN BÊN B"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
        ],
      },
    ],
    font: rng.pick(["sans", "serif"]),
    size: 11,
    ...r.lists(),
  };
}

/** ICAO 9303's check digit: weights 7, 3, 1 over digits, letters (A = 10) and fillers. */
function checkDigit(text) {
  const value = (char) =>
    /\d/.test(char) ? Number(char) : char === "<" ? 0 : char.charCodeAt(0) - 55;
  return String(
    [...text].reduce((sum, char, index) => sum + value(char) * [7, 3, 1][index % 3], 0) % 10,
  );
}
/** A citizen identity card's three machine-readable lines (TD1, 30 characters each). */
function machineLines(card) {
  const pad = (text) => text.padEnd(30, "<").slice(0, 30);
  const document = card.cccd.slice(3);
  const first = `IDVNM${document}${checkDigit(document)}${card.cccd}<`;
  const born = card.birth.split("/").reverse().join("").slice(2);
  const ends = card.expiry.split("/").reverse().join("").slice(2);
  const second = `${born}${checkDigit(born)}${card.sex === "Nam" ? "M" : "F"}${ends}${checkDigit(ends)}VNM`;
  const [family, ...given] = unaccented(card.name).toUpperCase().split(" ");
  return [
    pad(`${first}<`).slice(0, 29) + checkDigit(first),
    pad(second).slice(0, 29) + checkDigit(second),
    pad(`${family}<<${given.join("<")}`),
  ];
}

/** A contract with a copy of a party's citizen identity card on its last page, front and
 * back, as contracts are filed (decision 0185). Everything on the card is the holder's:
 * the number, name, dates, home town, residence and the machine-readable lines; the card's
 * printed wording stays. The issuing officer's name is either way. */
function idcard(rng) {
  const r = recorder();
  const me = person(rng);
  const client = company(rng);
  const born = Number(me.birth.slice(-4));
  const card = {
    ...me,
    expiry: `${me.birth.slice(0, 6)}${born + (born >= 1986 ? 40 : 60)}`,
    issued: date(rng, rng.int(2021, 2024)),
    origin: address(rng).split(", ").slice(1).join(", "),
  };
  const lines = machineLines(card);
  return {
    blocks: [
      ...nationalHeader(r),
      { title: r.keep("HỢP ĐỒNG CỘNG TÁC VIÊN"), size: 3 },
      {
        text: `Bên A: ${r.hide(client.name)}, mã số thuế ${r.hide(client.tax)}. Bên B: ${me.title} ${r.hide(me.name)}, căn cước công dân số ${r.hide(me.cccd)}, cấp ngày ${r.ignore(card.issued)}, bản sao căn cước đính kèm hợp đồng này.`,
      },
      {
        text: "Hai bên thống nhất ký hợp đồng cộng tác với các điều khoản đã thỏa thuận. Hợp đồng có hiệu lực kể từ ngày ký.",
      },
      {
        signatures: [
          {
            role: r.keep("ĐẠI DIỆN BÊN A"),
            note: "(Ký, đóng dấu)",
            name: r.hide(person(rng).name),
          },
          { role: r.keep("BÊN B"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
        ],
      },
      { pageBreak: true },
      {
        card: {
          front: [
            ["Số / No.:", r.hide(me.cccd)],
            ["Họ và tên / Full name:", null],
            [null, r.hide(me.name.toUpperCase())],
            ["Ngày sinh / Date of birth:", r.hide(me.birth)],
            ["Giới tính / Sex:", `${me.sex}     Quốc tịch / Nationality: Việt Nam`],
            ["Quê quán / Place of origin:", null],
            [null, r.hide(card.origin)],
            ["Nơi thường trú / Place of residence:", null],
            [null, r.hide(me.address)],
            ["Có giá trị đến / Date of expiry:", r.hide(card.expiry)],
          ],
          back: [
            [
              "Đặc điểm nhân dạng / Personal identification:",
              r.hide(
                `Nốt ruồi c: ${rng.int(1, 4)},${rng.int(0, 9)}cm ${rng.pick(["trên", "dưới"])} đuôi mắt ${rng.pick(["trái", "phải"])}`,
              ),
            ],
            ["Ngày, tháng, năm / Date, month, year:", r.ignore(card.issued)],
            [r.keep("CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI"), null],
            [null, r.ignore(person(rng).name)],
          ],
          machine: lines.map((line) => r.hide(line)),
        },
      },
    ],
    font: "sans",
    size: 11,
    ...r.lists(),
  };
}

export const moreKinds = {
  decision: { layouts: ["benefit", "penalty", "notice"], build: decision },
  payslip: { layouts: ["table", "compact"], build: payslip },
  medical: { layouts: ["exam", "lab"], build: medical },
  utility: { layouts: ["electric", "internet"], build: utility },
  letter: { layouts: ["offer", "reminder"], build: letter },
  minutes: { layouts: ["meeting", "handover"], build: minutes },
  transcript: { layouts: ["grades", "confirmation"], build: transcript },
  order: { layouts: ["delivery", "receipt"], build: order },
  // Last, so that every document before it keeps its seed.
  appendix: { layouts: ["colon", "label"], build: appendix },
  idcard: { layouts: ["attached"], build: idcard },
};
