import {
  account,
  address,
  bankShort,
  banks,
  company,
  date,
  goods,
  household,
  inWords,
  money,
  person,
  phone,
  unaccented,
} from "./data.mjs";

/** The synthetic document kinds (decision 0153). Each builds a layout-neutral model for
 * `render-pdf.mjs` and `render-docx.mjs` and records every invented value it places:
 * `hide` must be masked, `keep` must stay readable, `ignore` may go either way (a bank's
 * name, a CCCD's issue date). Model blocks:
 *   { title, size? }                       centred, bold
 *   { text, align?, bold? }                a paragraph that wraps
 *   { fields: [[label, value]...], columns? }  "Label: value" lines, one or two a line
 *   { table: { columns: [{ title, width, align? }], rows, blank?, total? } }
 *   { signatures: [{ role, note?, name }] }
 *   { space } / { pageBreak: true }
 * A document has { font: "sans" | "serif", size, blocks }. */
function recorder() {
  const lists = { hide: new Set(), keep: new Set(), ignore: new Set() };
  const add = (list) => (value) => (lists[list].add(String(value)), value);
  return {
    hide: add("hide"),
    keep: add("keep"),
    ignore: add("ignore"),
    lists: () => {
      // A value both hidden and kept is a generator mistake; hiding wins.
      for (const value of lists.hide) lists.keep.delete(value);
      return Object.fromEntries(Object.entries(lists).map(([key, set]) => [key, [...set]]));
    },
  };
}
const nationalHeader = (r) => [
  { title: r.keep("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"), size: 1 },
  { text: r.keep("Độc lập - Tự do - Hạnh phúc"), align: "center", bold: true },
  { space: 8 },
];
const issuer = "Cục Cảnh sát quản lý hành chính về trật tự xã hội";

function invoice(rng, layout) {
  const r = recorder();
  const seller =
    layout === "household"
      ? (() => {
          const shop = household(rng);
          return {
            name: shop.name,
            tax: shop.owner.cccd,
            address: shop.owner.address,
            phone: shop.owner.phone,
          };
        })()
      : company(rng);
  const buyerIsPerson = layout === "service" || rng.chance(0.3);
  const buyer = buyerIsPerson ? person(rng) : company(rng);
  const lines = rng.shuffle(goods).slice(0, rng.int(3, 7));
  const vat = layout === "household" ? 0 : rng.pick([5, 8, 10]);
  const rows = lines.map(([name, unit, [low, high]], index) => {
    const quantity = unit === "Kg" ? rng.int(2, 95) / 100 : rng.int(1, 12);
    const price = Math.round(rng.int(low, high) / 100) * 100;
    const amount = Math.round(quantity * price);
    r.keep(name);
    return { index, name, unit, quantity, price, amount };
  });
  const net = rows.reduce((sum, row) => sum + row.amount, 0);
  const tax = Math.round((net * vat) / 100);
  const total = net + tax;
  const quantity = (value) => (value % 1 ? value.toFixed(3).replace(".", ",") : String(value));
  const blocks = [];

  if (layout === "household") {
    blocks.push(
      { title: r.hide(seller.name), size: 2 },
      { fields: [["Mã số thuế (CCCD)", r.hide(seller.tax)]] },
      { fields: [["Địa chỉ", r.hide(seller.address)]] },
      { fields: [["Điện thoại", r.hide(seller.phone)]] },
      {
        fields: [
          [
            "Số tài khoản",
            `${r.hide(account(rng))} - ${r.ignore(`Ngân hàng ${rng.pick(bankShort)}`)}`,
          ],
        ],
      },
      { space: 6 },
      { title: r.keep("HÓA ĐƠN BÁN HÀNG"), size: 3 },
    );
  } else {
    blocks.push(
      {
        title: r.keep(rng.pick(["HÓA ĐƠN GIÁ TRỊ GIA TĂNG", "HÓA ĐƠN ĐIỆN TỬ GIÁ TRỊ GIA TĂNG"])),
        size: 3,
      },
      { text: `Ngày ${rng.int(1, 28)} tháng ${rng.int(1, 12)} năm 2026`, align: "center" },
      {
        fields: [
          ["Ký hiệu", r.ignore(`1C26${rng.pick(["MBE", "TAA", "TKK"])}`)],
          ["Số", r.ignore(rng.digits(8))],
        ],
        columns: 2,
      },
      { space: 4 },
      { fields: [["Đơn vị bán hàng", r.hide(seller.name)]] },
      { fields: [["Mã số thuế", r.hide(seller.tax)]] },
      { fields: [["Địa chỉ", r.hide(seller.address)]] },
    );
  }
  blocks.push({ space: 6 });
  if (buyerIsPerson)
    blocks.push(
      { fields: [["Họ tên người mua hàng", r.hide(buyer.name)]] },
      {
        fields: [
          ["Số CCCD", r.hide(buyer.cccd)],
          ["Điện thoại", r.hide(buyer.phone)],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ", r.hide(buyer.address)]] },
    );
  else
    blocks.push(
      { fields: [["Họ tên người mua hàng", ""]] },
      { fields: [["Tên đơn vị", r.hide(buyer.name)]] },
      { fields: [["Địa chỉ", r.hide(buyer.address)]] },
      {
        fields: [
          ["Hình thức thanh toán", "TM/CK"],
          [layout === "household" ? "MST/CCCD chủ hộ" : "Mã số thuế", r.hide(buyer.tax)],
        ],
        columns: 2,
      },
    );
  blocks.push({ space: 6 });

  if (layout === "winmart") {
    blocks.push({
      table: {
        columns: [
          { title: r.keep("STT"), width: 0.05, align: "center" },
          { title: "Tên hàng hóa, dịch vụ", width: 0.27 },
          { title: "Đơn vị tính", width: 0.07, align: "center" },
          { title: "Số lượng", width: 0.07, align: "right" },
          { title: "Đơn giá", width: 0.09, align: "right" },
          { title: "Thành tiền trước thuế GTGT", width: 0.11, align: "right" },
          { title: "Thuế suất GTGT (%)", width: 0.08, align: "center" },
          { title: "Tiền thuế GTGT", width: 0.11, align: "right" },
          { title: "Thành tiền sau thuế GTGT", width: 0.15, align: "right" },
        ],
        rows: rows.map((row) => {
          const rowTax = Math.round((row.amount * vat) / 100);
          return [
            String(row.index + 1),
            row.name,
            row.unit.toUpperCase(),
            quantity(row.quantity),
            money(row.price),
            money(row.amount),
            `${vat}%`,
            money(rowTax),
            money(row.amount + rowTax),
          ];
        }),
        blank: 2,
        total: { label: r.keep("Tổng cộng"), value: r.keep(money(total)) },
      },
    });
  } else {
    blocks.push({
      table: {
        columns: [
          { title: r.keep("STT"), width: 0.07, align: "center" },
          { title: "Tên hàng hóa, dịch vụ", width: 0.41 },
          { title: "Đơn vị tính", width: 0.11, align: "center" },
          { title: "Số lượng", width: 0.1, align: "right" },
          { title: "Đơn giá", width: 0.14, align: "right" },
          { title: "Thành tiền", width: 0.17, align: "right" },
        ],
        rows: rows.map((row) => [
          String(row.index + 1),
          row.name,
          row.unit,
          quantity(row.quantity),
          money(row.price),
          money(row.amount),
        ]),
        total: { label: r.keep("Cộng tiền hàng hóa, dịch vụ:"), value: r.keep(money(net)) },
      },
    });
    if (vat)
      blocks.push(
        {
          fields: [
            ["Thuế suất GTGT", `${vat}%`],
            ["Tiền thuế GTGT", money(tax)],
          ],
          columns: 2,
        },
        { fields: [["Tổng tiền thanh toán", r.keep(money(total))]] },
      );
  }
  blocks.push(
    { fields: [["Số tiền viết bằng chữ", r.keep(inWords(total))]] },
    { space: 8 },
    {
      signatures: [
        {
          role: "Người mua hàng",
          note: "(Ký, ghi rõ họ tên)",
          name: buyerIsPerson ? r.hide(buyer.name) : "",
        },
        {
          role: "Người bán hàng",
          note: "(Chữ ký điện tử, chữ ký số)",
          name: layout === "household" ? seller.name : "",
        },
      ],
    },
    { space: 10 },
    {
      text: `Tra cứu tại Website: https://hoadon.example.vn - Mã tra cứu: ${r.ignore(rng.digits(4) + "ABC" + rng.digits(3))}`,
      align: "center",
    },
  );
  const provider = company(rng);
  blocks.push({
    text: `Đơn vị cung cấp giải pháp hóa đơn điện tử: ${r.hide(provider.name)} - MST: ${r.hide(provider.tax)}`,
    align: "center",
  });
  return { blocks, font: layout === "service" ? "serif" : "sans", size: 9, ...r.lists() };
}

function statement(rng, layout) {
  const r = recorder();
  const holder = person(rng);
  const bank = r.ignore(rng.pick(banks));
  const number = r.hide(account(rng));
  const upper = (name) => unaccented(name).toUpperCase();
  const counterparts = Array.from({ length: 6 }, () => person(rng));
  const employer = company(rng);
  let balance = rng.int(5, 80) * 1_000_000;
  const opening = balance;
  const rows = [];
  const count = rng.int(28, 42);
  for (let index = 0; index < count; index++) {
    const day = `${String(Math.min(28, 1 + Math.floor((index * 28) / count))).padStart(2, "0")}/10/2026`;
    const ref = r.ignore(`FT26${rng.digits(9)}`);
    const other = rng.pick(counterparts);
    const kind = rng.int(0, 7);
    let description;
    let amount;
    if (kind === 0) {
      description = `${r.keep("CT DEN")}:${ref} ${r.hide(upper(other.name))} ${r.keep("chuyen tien")} ${r.keep(rng.pick(["thue nha T10", "tra no", "an trua", "gop quy"]))}`;
      amount = rng.int(2, 60) * 50_000;
    } else if (kind === 1) {
      description = `${r.hide(upper(holder.name))} ${r.keep("chuyen tien den TK")} ${r.hide(account(rng))} ${r.hide(upper(other.name))}`;
      amount = -rng.int(2, 80) * 50_000;
    } else if (kind === 2) {
      description = `${r.keep("TRA LUONG THANG 9")} ${r.hide(unaccented(employer.name).toUpperCase())}`;
      amount = rng.int(15, 45) * 1_000_000;
    } else if (kind === 3) {
      description = r.keep(
        rng.pick(["Phi duy tri dich vu SMS Banking", "Lai nhap von", "Phi quan ly tai khoan"]),
      );
      amount = description.startsWith("Lai") ? rng.int(1, 9) * 1_000 : -11_000;
    } else if (kind === 4) {
      description = `${r.keep("Thanh toan QR")} ${r.ignore(rng.pick(["WINMART", "CIRCLE K", "GRAB", "HIGHLANDS COFFEE", "BACH HOA XANH"]))} ${rng.digits(6)}`;
      amount = -rng.int(3, 90) * 10_000;
    } else if (kind === 5) {
      description = `${r.keep("Nap tien dien thoai")} ${r.hide(phone(rng).replace(/\D/g, ""))}`;
      amount = -rng.pick([50_000, 100_000, 200_000]);
    } else if (kind === 6) {
      description = `${r.hide(upper(other.name))} CK ${r.keep(rng.pick(["tien hoc", "hoan tien", "mua hang"]))} ${ref}`;
      amount = rng.int(1, 40) * 100_000;
    } else {
      description = `${r.keep("Rut tien ATM")} tai ${r.ignore(rng.pick(bankShort))} ${rng.digits(4)}`;
      amount = -rng.int(1, 5) * 1_000_000;
    }
    balance += amount;
    rows.push({ day, ref, description, amount, balance });
  }
  if (rows[0]) r.keep(money(Math.abs(rows[0].amount)));
  const blocks = [
    { text: bank, bold: true },
    { title: r.keep("SAO KÊ TÀI KHOẢN"), size: 3 },
    { text: r.keep("Từ ngày 01/10/2026 đến ngày 31/10/2026"), align: "center" },
    { space: 6 },
    {
      fields: [
        ["Chủ tài khoản", r.hide(rng.chance(0.5) ? holder.name.toUpperCase() : holder.name)],
        ["Số tài khoản", number],
      ],
      columns: 2,
    },
    {
      fields: [
        ["Số CCCD", r.hide(holder.cccd)],
        ["Loại tiền", "VND"],
      ],
      columns: 2,
    },
    { fields: [["Địa chỉ", r.hide(holder.address)]] },
    { fields: [["Số dư đầu kỳ", r.keep(money(opening))]] },
    { space: 6 },
  ];
  if (layout === "classic")
    blocks.push({
      table: {
        columns: [
          { title: "Ngày giao dịch", width: 0.12, align: "center" },
          { title: "Số tham chiếu", width: 0.16 },
          { title: "Mô tả giao dịch", width: 0.36 },
          { title: "Ghi nợ", width: 0.12, align: "right" },
          { title: "Ghi có", width: 0.12, align: "right" },
          { title: "Số dư", width: 0.12, align: "right" },
        ],
        rows: rows.map((row) => [
          row.day,
          row.ref,
          row.description,
          row.amount < 0 ? money(-row.amount) : "",
          row.amount > 0 ? money(row.amount) : "",
          money(row.balance),
        ]),
        repeatHeader: true,
      },
    });
  else
    blocks.push({
      table: {
        columns: [
          { title: "Ngày", width: 0.13, align: "center" },
          { title: "Nội dung", width: 0.53 },
          { title: "Số tiền (VND)", width: 0.17, align: "right" },
          { title: "Số dư (VND)", width: 0.17, align: "right" },
        ],
        rows: rows.map((row) => [
          row.day,
          row.description,
          `${row.amount > 0 ? "+" : "-"}${money(Math.abs(row.amount))}`,
          money(row.balance),
        ]),
        repeatHeader: true,
      },
    });
  blocks.push({ space: 6 }, { fields: [["Số dư cuối kỳ", r.keep(money(balance))]] });
  return { blocks, font: "sans", size: 8.5, ...r.lists() };
}

function party(r, rng, role, someone, extra = []) {
  const issued = r.ignore(date(rng, rng.int(2021, 2024)));
  return [
    { text: r.keep(role), bold: true },
    {
      fields: [
        ["Họ và tên", r.hide(someone.name)],
        ["Sinh ngày", r.hide(someone.birth)],
      ],
      columns: 2,
    },
    {
      fields: [
        ["Số CCCD", r.hide(someone.cccd)],
        ["Ngày cấp", issued],
      ],
      columns: 2,
    },
    { fields: [["Nơi cấp", r.ignore(issuer)]] },
    { fields: [["Địa chỉ thường trú", r.hide(someone.address)]] },
    {
      fields: [
        ["Điện thoại", r.hide(someone.phone)],
        ["Email", r.hide(someone.email)],
      ],
      columns: 2,
    },
    ...extra,
    { space: 4 },
  ];
}

function contract(rng, layout) {
  const r = recorder();
  const blocks = [...nationalHeader(r)];
  if (layout === "rental") {
    const owner = person(rng);
    const tenant = person(rng);
    const home = address(rng);
    const rent = rng.int(5, 25) * 1_000_000;
    const ownerAccount = account(rng);
    blocks.push(
      { title: r.keep("HỢP ĐỒNG THUÊ NHÀ"), size: 3 },
      { text: `Số: ${r.ignore(`${rng.int(1, 99)}/2026/HĐTN`)}`, align: "center" },
      { text: `Hôm nay, ngày ${date(rng)}, tại ${r.hide(home)}, chúng tôi gồm:` },
      ...party(r, rng, "BÊN CHO THUÊ (Bên A):", owner, [
        { fields: [["Số tài khoản", `${r.hide(ownerAccount)} tại ${r.ignore(rng.pick(banks))}`]] },
      ]),
      ...party(r, rng, "BÊN THUÊ (Bên B):", tenant),
      { text: r.keep("Điều 1. Đối tượng của hợp đồng"), bold: true },
      {
        text: `Bên A đồng ý cho Bên B thuê toàn bộ căn nhà tại địa chỉ ${r.hide(home)} để ở. ${owner.title} ${r.hide(owner.name)} cam kết căn nhà thuộc quyền sở hữu hợp pháp của mình.`,
      },
      { text: r.keep("Điều 2. Giá thuê và phương thức thanh toán"), bold: true },
      {
        text: `Giá thuê là ${r.keep(money(rent))} đồng/tháng (Bằng chữ: ${r.keep(inWords(rent))}). Bên B thanh toán vào ngày 05 hằng tháng bằng chuyển khoản vào tài khoản số ${r.hide(ownerAccount)} mang tên ${r.hide(owner.name.toUpperCase())}.`,
      },
      { text: r.keep("Điều 3. Quyền và nghĩa vụ của các bên"), bold: true },
      {
        text: "Bên A bàn giao nhà đúng thời hạn và bảo đảm cho Bên B sử dụng ổn định trong thời gian thuê. Bên B sử dụng nhà đúng mục đích, giữ gìn nhà và thanh toán đủ tiền thuê. Mọi thay đổi phải được hai bên thỏa thuận bằng văn bản.",
      },
      {
        text: `Khi cần liên hệ, Bên B gọi cho ${owner.title.toLowerCase()} ${r.hide(owner.name.split(" ").at(-1))} theo số ${r.hide(owner.phone)}.`,
      },
      { text: r.keep("Điều 4. Điều khoản chung"), bold: true },
      { text: "Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản." },
      { space: 8 },
      {
        signatures: [
          { role: r.keep("ĐẠI DIỆN BÊN A"), note: "(Ký, ghi rõ họ tên)", name: r.hide(owner.name) },
          {
            role: r.keep("ĐẠI DIỆN BÊN B"),
            note: "(Ký, ghi rõ họ tên)",
            name: r.hide(tenant.name),
          },
        ],
      },
    );
  } else {
    const employer = company(rng);
    const director = person(rng);
    const worker = person(rng);
    const salary = rng.int(8, 40) * 1_000_000;
    blocks.push(
      { title: r.keep("HỢP ĐỒNG LAO ĐỘNG"), size: 3 },
      { text: `Số: ${r.ignore(`${rng.int(1, 300)}/2026/HĐLĐ`)}`, align: "center" },
      { text: r.keep("BÊN SỬ DỤNG LAO ĐỘNG (Bên A):"), bold: true },
      { fields: [["Tên đơn vị", r.hide(employer.name)]] },
      {
        fields: [
          ["Mã số thuế", r.hide(employer.tax)],
          ["Điện thoại", r.hide(employer.phone)],
        ],
        columns: 2,
      },
      { fields: [["Địa chỉ", r.hide(employer.address)]] },
      {
        fields: [
          ["Đại diện", r.hide(director.name)],
          ["Chức vụ", r.keep("Giám đốc")],
        ],
        columns: 2,
      },
      { space: 4 },
      ...party(r, rng, "NGƯỜI LAO ĐỘNG (Bên B):", worker, [
        {
          fields: [
            [
              "Số tài khoản nhận lương",
              `${r.hide(account(rng))} - ${r.ignore(rng.pick(bankShort))}`,
            ],
          ],
        },
      ]),
      { text: r.keep("Điều 1. Thời hạn và công việc"), bold: true },
      {
        text: `Loại hợp đồng: xác định thời hạn 24 tháng, từ ngày ${r.ignore(date(rng))}. Chức danh: ${r.keep(rng.pick(["Nhân viên kinh doanh", "Kế toán viên", "Kỹ sư phần mềm"]))}. Địa điểm làm việc: ${r.hide(employer.address)}.`,
      },
      { text: r.keep("Điều 2. Tiền lương"), bold: true },
      {
        text: `Mức lương chính: ${r.keep(money(salary))} đồng/tháng, trả vào ngày 10 hằng tháng. ${worker.title} ${r.hide(worker.name)} được đóng bảo hiểm xã hội theo quy định.`,
      },
      { text: r.keep("Điều 3. Điều khoản thi hành"), bold: true },
      { text: "Hợp đồng được lập thành 02 bản, mỗi bên giữ 01 bản và có hiệu lực từ ngày ký." },
      { space: 8 },
      {
        signatures: [
          {
            role: r.keep("NGƯỜI LAO ĐỘNG"),
            note: "(Ký, ghi rõ họ tên)",
            name: r.hide(worker.name),
          },
          {
            role: r.keep("NGƯỜI SỬ DỤNG LAO ĐỘNG"),
            note: "(Ký, đóng dấu)",
            name: r.hide(director.name.toUpperCase()),
          },
        ],
      },
    );
  }
  return { blocks, font: rng.chance(0.6) ? "serif" : "sans", size: 10.5, ...r.lists() };
}

function form(rng, layout) {
  const r = recorder();
  const me = person(rng);
  const blocks = [...nationalHeader(r)];
  if (layout === "cv") {
    const father = person(rng);
    const mother = person(rng);
    const past = company(rng);
    blocks.push(
      { title: r.keep("SƠ YẾU LÝ LỊCH"), size: 3 },
      { text: r.keep("I. THÔNG TIN BẢN THÂN"), bold: true },
      {
        fields: [
          ["Họ và tên", r.hide(me.name.toUpperCase())],
          ["Giới tính", me.sex],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Ngày sinh", r.hide(me.birth)],
          ["Dân tộc", "Kinh"],
        ],
        columns: 2,
      },
      {
        fields: [
          ["Số CCCD", r.hide(me.cccd)],
          ["Ngày cấp", r.ignore(date(rng, 2022))],
        ],
        columns: 2,
      },
      { fields: [["Hộ khẩu thường trú", r.hide(me.address)]] },
      { fields: [["Chỗ ở hiện nay", r.hide(address(rng))]] },
      {
        fields: [
          ["Điện thoại", r.hide(me.phone)],
          ["Email", r.hide(me.email)],
        ],
        columns: 2,
      },
      { space: 4 },
      { text: r.keep("II. QUAN HỆ GIA ĐÌNH"), bold: true },
      {
        table: {
          columns: [
            { title: "Quan hệ", width: 0.15 },
            { title: "Họ và tên", width: 0.35 },
            { title: "Năm sinh", width: 0.15, align: "center" },
            { title: "Nghề nghiệp", width: 0.35 },
          ],
          rows: [
            [r.keep("Bố"), r.hide(father.name), father.birth.slice(-4), r.keep("Giáo viên")],
            [r.keep("Mẹ"), r.hide(mother.name), mother.birth.slice(-4), r.keep("Kinh doanh")],
          ],
        },
      },
      { space: 4 },
      { text: r.keep("III. QUÁ TRÌNH CÔNG TÁC"), bold: true },
      {
        table: {
          columns: [
            { title: "Thời gian", width: 0.2, align: "center" },
            { title: "Đơn vị công tác", width: 0.5 },
            { title: "Chức vụ", width: 0.3 },
          ],
          rows: [
            ["2019 - 2022", r.ignore(past.name), r.keep("Nhân viên")],
            ["2022 - nay", r.ignore(company(rng).name), r.keep("Trưởng nhóm")],
          ],
        },
      },
      { space: 8 },
      { text: `${r.ignore("Thành phố Hồ Chí Minh")}, ngày ${date(rng)}`, align: "right" },
      {
        signatures: [
          { role: "", note: "", name: "" },
          { role: r.keep("Người khai"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
        ],
      },
    );
  } else {
    const employer = company(rng);
    blocks.push(
      { title: r.keep("ĐƠN XIN VIỆC"), size: 3 },
      { text: `Kính gửi: Ban Giám đốc ${r.hide(employer.name)}`, bold: true },
      {
        text: `Tôi tên là ${r.hide(me.name)}, sinh ngày ${r.hide(me.birth)}, số CCCD ${r.hide(me.cccd)}. Hiện tôi đang sống tại ${r.hide(me.address)}.`,
      },
      {
        text: `Qua thông tin tuyển dụng, tôi được biết Quý công ty đang cần tuyển vị trí ${r.keep(rng.pick(["Nhân viên kinh doanh", "Kế toán tổng hợp", "Chuyên viên nhân sự"]))}. Tôi có ${rng.int(2, 8)} năm kinh nghiệm và mong muốn được đóng góp vào sự phát triển của Quý công ty.`,
      },
      {
        text: `Mọi thông tin xin liên hệ số điện thoại ${r.hide(me.phone)} hoặc email ${r.hide(me.email)}. Người giới thiệu: ${r.hide(person(rng).name)}, điện thoại ${r.hide(phone(rng))}.`,
      },
      { text: "Tôi xin chân thành cảm ơn." },
      { space: 8 },
      {
        signatures: [
          { role: "", note: "", name: "" },
          { role: r.keep("Người làm đơn"), note: "(Ký, ghi rõ họ tên)", name: r.hide(me.name) },
        ],
      },
    );
  }
  return { blocks, font: rng.chance(0.5) ? "serif" : "sans", size: 11, ...r.lists() };
}

export const kinds = {
  invoice: { layouts: ["winmart", "household", "service"], build: invoice },
  statement: { layouts: ["classic", "compact"], build: statement },
  contract: { layouts: ["rental", "labour"], build: contract },
  form: { layouts: ["cv", "application"], build: form },
};
