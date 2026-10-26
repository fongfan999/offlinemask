# 0160 — The synthetic set widens to twelve kinds of document, and what two thousand of them found

Date: 26 October 2026. Status: implemented and measured. Owner, after the decision of 0159 masked correctly: "can you generate more realistic use cases, like hundreds, thousands, so we're confident enough to release".

## What was built

The generator of 0153 gains eight kinds in seventeen layouts (`desktop/tests/documents/kinds-more.mjs`, data in `data.mjs`), each writing its own hide, keep and ignore lists as it places values, so a run of any size needs no review:

| Kind | Layouts | What it holds |
| --- | --- | --- |
| decision | benefit, penalty, notice | an unemployment-benefit decision as in 0159, a traffic-penalty decision from a ward's police, a tax or social-insurance notice: state bodies with their city, the two-cell header, the place and date of issue, the person's identifier, residences, account, hospital, the "Nơi nhận" block |
| payslip | table, compact | a company's letterhead, employee code, department and position, account, personal tax code, the salary lines and signatures |
| medical | exam, lab | a hospital and ward, patient code, health-insurance card, birth date or year, diagnosis, test rows, the doctor |
| utility | electric, internet | a supplier, customer or subscriber code, the installation address, readings and tiers, a hotline |
| letter | offer, reminder | a job offer on a company letterhead with the HR contact; a bank's reminder with contract and account numbers |
| minutes | meeting, handover | attendees with positions and departments; two parties with identifiers handing over assets with serials |
| transcript | grades, confirmation | a school, student id, class, subjects and scores; a confirmation with identifier and residence |
| order | delivery, receipt | a shop and a recipient with tracking codes; a cash receipt with four signatures |

With the four kinds of 0153 that is 26 layouts, 78 documents a seed (two PDF variants and a Word file each). Seeds 1–26 give 2 028 documents. The lists follow the policy of 0152: people, their numbers and addresses, and private companies are hidden; state bodies, headings, wording and amounts stay; banks, hospitals, schools, utilities and reference codes may go either way. The generator keeps the hard case where a letterhead's lines, a field and the paragraph after it sit one line apart, which the PDF reader joins into one paragraph as a real PDF without paragraph spacing reads.

## What the first seed found, and the rules

Seed 1 before any change: 43 leaked, 41 over-masked in 78 documents. Each fix below is a structure, measured on the seed after every step until it read 0 and 0, then on the seven seeds of 0153, the owner's sets and the whole wider set.

Leaks:

1. **The codes an organization gives a person** (`banking.ts`, new type `MA_SO` "Mã số", category "banking"): employee, student, patient, health-insurance card, social-insurance book, subscriber and member numbers after their labels ("Mã nhân viên", "Mã số sinh viên", "Mã bệnh nhân", "Số thẻ BHYT", "Mã số BHXH", "Mã thuê bao"). None had a rule.
2. **A personal or business tax code** keeps its label ("Mã số thuế cá nhân", `structured-values.ts`); **residence labels** of bills, orders and penalty decisions ("Địa chỉ lắp đặt", "Địa chỉ sử dụng điện", "Địa chỉ nhận hàng", "Nơi cư trú hiện tại", `labelled-fields.ts`); **name labels** of records ("Họ tên người bệnh", "Họ tên nhân viên", "Họ tên sinh viên", "Họ tên người nộp tiền"); **the birth-date label** of a decision ("Ngày, tháng, năm sinh", `context-fields.ts`).
3. **A numbered street before a comma is seeded by the ward after it** (`address-boundaries.ts`): "370 Huỳnh Văn Bánh, Phường Hải Châu, …" on a joined letterhead; the model finds the ward and city, and the street's component had no seed of its own. And a word inside an organization's or a person's name cannot start an address ("Tân Phong 370 …": "Phong" is not a room).
4. **The legal-prefix walker stops** at an address ("Số 47 …", a bare number once the name has two capitals), an article ("Điều 2"), a page, "Tôi", and a department or ward line the reader joined to the name ("Phòng Đào tạo", "Khoa Nhi"), while "Đa khoa", "Bách khoa", "Phòng khám", "Hải Phòng" and "Tân Phong" stay part of names: "khoa" ends a name unless the previous word is "đa", "chuyên" or "bách"; "phòng" only with its tone mark and not after "hải". Lowercase "khoa", "học" and "ương" join the connectors ("Đa khoa", "Đại học", "Trung ương"), so a hospital or school in Title Case completes.

Over-masking:

5. **A department, ward or team is wording** (`model-policy.ts`, `departmentCell`, `withoutUnit`): a cell or span that starts with "Phòng", "Khoa", "Ban", "Bộ phận", "Tổ", "Đội" and a short name, the word or two after that kind ("Khoa [Nhi]"), and a model's organization or "name" that runs from an institution into its department line, cut before the unit ("Trường Đại học Kinh tế Quốc dân | Phòng Đào tạo", "Rẫy Khoa Nhi"). A clinic ("Phòng khám"), a fire-safety company and a bank's transaction office keep their words; "Nguyễn Khoa Điềm" is a name.
6. **Column headings of records and bills** join the wording columns of 0156: "Học phần", "Môn học", "Xét nghiệm", "Chỉ số", "Khoản mục", "Dịch vụ", "Tên tài sản", "Phòng ban", "Bộ phận", "Gói cước". "Đơn vị" was tried and reverted: a CV lists companies under "Đơn vị công tác".
7. **Titles, field names, roles and ranks** join the boilerplate phrases: "Phiếu lương", "Bảng lương", "Phiếu thu", "Phiếu giao hàng", "Phiếu khám bệnh", "Kết quả xét nghiệm", "Biên bản", "Bảng điểm", "Giấy xác nhận", "Thư mời", "Thông báo", "Họ và tên", "Số serial", "Thực lĩnh", "Hiệu trưởng", "Chủ trì", "Thư ký", "Thủ quỹ", "Tháng 02/2026", "Phòng Đào tạo", "Thiếu tá"; a signature role in capitals ("CHỦ TRÌ") beside a signature note is not a name unless its syllables are ones names are made of.
8. **A role in capitals in a line of prose** ("TL. HIỆU TRƯỞNG TRƯỞNG PHÒNG ĐÀO TẠO" after the date line): a name with tone marks in capitals starts with a family name, as a span or as its whole cell when a model cut it; unaccented capitals keep the shape test of 0154.
9. **"Giới tính: Nam"** is a sex; **a country alone** is not an organization either ("Quốc tịch: Việt Nam"), while "Anh", "Mỹ", "Đức", "Nga" stay possible given names; **the place of issue** is recognised after " · " too, as the PDF reader writes a form line.
10. **A labelled address the reader joined to the next sentence** ends after its province or city when a capitalized word follows without a comma ("… TP. Hồ Chí Minh | Tổng số tháng …"). The provinces are a closed public list (`provinces` in `address-boundaries.ts`), like the countries of 0155.

11. **A model piece left after a split is judged again** (`policy.ts`): a span cut at a field's or an organization's boundary ("Rẫy Khoa Nhi" after the hospital gives "Khoa Nhi"; "Chợ Rẫy Điều" gives a one-word "Điều" at 0.42) never went through the plausibility rules as itself; the pieces with a model score now do, at the end of the policy.
12. **The value of a field whose label says it holds wording** ("Chức vụ: Kỹ sư phần mềm", "Lý do nộp: Hoàn tạm ứng", "Ngành:", "Chẩn đoán:", and "vị trí Chuyên viên nhân sự" in a letter) holds no person, place or organization, like a cell under such a heading (0156). A first version also took "Dịch vụ" and "Khoa" without a colon as labels and threw away the address after "Công ty … Dịch vụ An Phát 308 đường …"; only "vị trí" works without a colon, and only before a capital.
13. **A province is never a person** ("LÂM ĐỒNG": "Lâm" is a family name, so it passed the heading test), **the kind of an organization alone** ("của Trường", "Công ty") is neither a name nor an organization, **a two-word country** ("Quốc tịch: Việt Nam") is not a name, and **a model's organization loses a trailing "Số" or house number** before a capitalized street or a road word ("… Thành Công [95] Lê Lợi", "… An Phát [308] đường …"), so the street can start the address.
14. **Names and amounts.** A fourth word after a form of address must be a name syllable ("Ông Nguyễn Hữu Khang Chúng tôi …", lines the reader joined); two amounts in one cell ("1.200.000 245.800.000", a merged last column) are still an amount cell of a transaction row and not a phone number; "Lần", "Chuyến", "Giờ" are units of services; a company's lowercase trade syllables ("Vận tải", "Dịch vụ", "Xây dựng") and the syllable that completes a compound ("Trung ương", "Đa khoa", "Đại học") belong to the name, while a syllable that also folds to a preposition ("tại", "từ", "vẫn", "đóng") counts only in its trade spelling.

Mistakes in the generator's own lists, fixed there: a doctor's "BS." prefix, a bare year of birth, a school inside a sentence to keep, a sex to keep ("Nam" matched inside names), bare numbers to keep (readings, scores: they matched inside other values).

## Result

| Set | Documents | Not read | Leaked | Over-masked | Unlisted |
| --- | --- | --- | --- | --- | --- |
| Wider set, seed 1, before any change | 78 | 0 | 43 | 41 | 3 |
| Wider set, seeds 1–26 | 2 028 | 0 | 0 | 0 | 6 ("phòng" five times, "LẦN" once: a lowercase word and a unit masked on their own) |
| 0153 set, seeds 1–7 | 189 | 0 | 0 | 0 | 0 (was 3) |
| Owner's invoices | 10 | 0 | 0 | 0 | 0 |
| Owner's decision (0159) | 1 | 0 | 0 | 0 | 0 |

`pnpm test` 419, `pnpm test:models` 23/23 with the installed pack (a `records-and-bills` fixture joins the gate: a payslip, a medical record and a bill in one text), lint and typecheck pass. `tests/model-plausibility.test.mjs` covers every rule with invented lines.

## Limits

Invented documents measure invented documents. The kinds, layouts and wording are what the generator's authors know Vietnamese documents to look like; the owner's own files (0152) remain the check that they resemble reality, and a kind nobody has generated is a kind nobody has measured. The unlisted values of a run (masked, in neither list) are reviewed by hand each time the set changes.
