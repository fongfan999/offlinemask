// Explicitly authored scenarios, not sampled user text or model predictions.
// Partitions are assigned before rendering. Variants retain their family/template.
const training = [
  ['beneficiary-amendment', 'prose', 'Xin đổi người thụ hưởng sang [[person|Trịnh Ngọc Diệp]]; tài khoản nhận mới là [[account|006821470593]]. Giữ nguyên số tiền 780.000 đồng.', 'Only the replacement beneficiary and labelled account are private; amount stays.'],
  ['courier-routing', 'multiline', 'Phong bì hoàn trả chuyển tới:\n[[address|tầng 4, căn 4B, số 28 hẻm Cỏ Mềm, phường Bình Hòa, Huế]]\nNgười ký nhận: [[person|Võ Thiên Khuê]].', 'Full delivery location includes floor and unit; newline before recipient ends address.'],
  ['supplier-reconciliation', 'prose', 'Bảng đối chiếu do [[organization|Công ty TNHH Gốm Nắng Mới]] lập, mã số thuế [[tax|0472816395]]. Chênh lệch kỳ này là 0 đồng.', 'Organization policy applies to the named supplier; tax identifier is complete.'],
  ['age-correction', 'prose', 'Ngày sinh của [[person|Đặng Bảo Nhiên]] phải sửa thành [[birthdate|17/02/1991]], không phải ngày tiếp nhận 03/08/2026.', 'Birth date is private; operational intake date stays.'],
  ['statement-recipient', 'fields', 'Gửi sao kê qua email: [[email|sao-ke.may@example.org]]\nSố điện thoại báo giao: [[phone|0916 482 735]]\nSố bản: 2', 'Contacts exclude labels; copy count stays.'],
  ['identity-reissue', 'prose', 'Bản cấp lại ghi số căn cước [[identity|073291840562]] của [[person|Phạm Trúc Đan]]. Chỉ cập nhật số giấy tờ, không đổi hạn mức.', 'Complete identity digits including leading zero.'],
  ['travel-refund', 'prose', 'Tra cứu hoàn tiền bằng hộ chiếu [[passport|K5827314]] và mã giao dịch [[transaction|RF-26-MAY-8412]]. Chuyến đi đã hủy.', 'Two different identifier semantics; do not absorb conjunction.'],
  ['customer-merge', 'prose', 'Gộp hồ sơ mang mã khách hàng [[customer|CIF-TR-624871]] vào hồ sơ chính của [[person|Bùi Lam Thảo]]; vẫn giữ hai chứng từ.', 'CIF value and person, not count or prose.'],
  ['card-replacement', 'fields', 'Thẻ cần thay: [[card|4726 1830 5924 8607]]\nCVV ghi trong yêu cầu: [[cvv|682]]\nPhí thay thẻ: 60.000 đồng', 'Labelled full card and CVV are sensitive even without checksum validation; fee stays.'],
  ['pin-compromise', 'prose', 'Khách đã gửi nhầm mã PIN [[pin|583917]] trong phần ghi chú. Cần thay ngay; đừng đưa mã đó vào tiêu đề phản hồi.', 'PIN is contextual; following instructions are ordinary.'],
  ['login-handover', 'fields', 'Tên đăng nhập thử: [[username|quay.moc_17]]\nMật khẩu tạm: [[password|May!17@cua-so]]\nHiệu lực: 15 phút', 'Complete opaque password, not embedded substrings.'],
  ['integration-key', 'prose', 'Khóa API được chép vào phiếu là [[apikey|om_test_khoa_thu_7Hn4Qp9R]]. Sau khi đổi khóa, chạy lại bước 3.', 'Synthetic opaque key excludes punctuation; step number stays.'],
  ['login-origin', 'prose', 'Phiên đăng nhập của [[username|thu.quy_amber]] đến từ địa chỉ IP [[ip|192.0.2.71]] lúc 08:45; thời gian đó cần giữ để đối chiếu.', 'Documentation IP represents a private source in this scenario; time stays.'],
  ['ipv6-endpoint', 'fields', 'IP máy gửi: [[ip|2001:db8:34::b7]]\nMã khách hàng liên quan: [[customer|CUS-TR-57390]]\nCổng dịch vụ: 8443', 'IPv6 colons belong to value; service port is ordinary.'],
  ['credential-with-email', 'prose', 'Chuỗi mật khẩu nguyên vẹn là [[password|thu-demo@example.net!8]]. Đây không phải địa chỉ nhận thư của khách.', 'Outer credential owns entire email-like string; no nested email label.'],
  ['joint-authorization', 'prose', 'Hai người được ủy quyền, [[person|Hồ Cẩm Khê]] và [[person|Mai Quỳnh Sương]], cùng ký cho [[organization|Hợp tác xã Mây Ven Đồi]].', 'Separate people; legal organization prefix retained.'],
  ['payer-clarification', 'fields', 'Bên trả: [[organization|Công ty Cổ phần Giấy Hạt Mưa]]\nTài khoản trích: [[account|883401926507]]\nNội dung: thanh toán 12 kiện hàng', 'Organization and account; merchandise count remains.'],
  ['address-correction-pair', 'prose', 'Địa chỉ cũ [[address|số 9 ngõ Hoa Gạo, phường An Hải, Đà Nẵng]] được thay bằng [[address|căn 12A, số 61 đường Đồi Sương, phường Tân Lập, Buôn Ma Thuột]].', 'Both old and new private addresses must be labelled separately.'],
  ['callback-window', 'prose', 'Gọi cho [[person|Lương Hải Miên]] qua [[phone|+84 938 271 645]] từ 14:00 đến 16:00. Mã giao dịch đang chờ là [[transaction|WAIT-TR-9264]].', 'International contact and transaction; callback interval stays.'],
  ['tax-email-request', 'prose', 'Đính chính mã số thuế [[tax|0638742910-002]] rồi gửi xác nhận tới [[email|chung-tu.song@example.com]]. Giữ hậu tố đơn vị phụ thuộc.', 'Tax branch suffix is part of identifier; email excludes sentence dot.'],
  ['negative-fee-matrix', 'table-text', 'Mức phí | Số lượng\n12.500 đồng | 8\n27.000 đồng | 3\nTổng cộng: 181.000 đồng', 'Prices and counts are ordinary; no person-specific identifiers.'],
  ['negative-blank-form', 'fields', 'Người thụ hưởng: chưa bổ sung\nTài khoản nhận: để trống\nĐịa chỉ nhận thư: sẽ xác nhận sau', 'Missing-value descriptions are not private values.'],
  ['negative-pin-guidance', 'prose', 'Mã PIN gồm sáu chữ số. Không chọn chuỗi lặp và không gửi mã trong phần mô tả yêu cầu.', 'Policy about credentials with no actual credential value.'],
  ['negative-batch-count', 'prose', 'Lô đối soát có 438 dòng hợp lệ, 27 dòng cần bổ sung và 6 dòng bị trùng. Không đính kèm danh sách khách.', 'Operational counts are not customer identifiers.'],
  ['negative-status-code', 'log-text', 'Bước kết nối thất bại với HTTP 429; thử lại sau 30 giây. Phiên bản bộ kết nối 2.8.4.', 'HTTP code/version must not become CVV, PIN or IP.'],
  ['negative-future-transfer', 'prose', 'Dự kiến chuyển 9.600.000 đồng ngày 21/11/2026 nếu hồ sơ được duyệt; người nhận chưa được chỉ định.', 'Amount and planned date are ordinary; recipient absent.'],
  ['negative-branch-directions', 'prose', 'Khu vực ký hồ sơ nằm bên trái sảnh, quầy tư vấn nằm cạnh máy lấy số. Không có địa chỉ giao hàng trong hướng dẫn này.', 'Generic spatial instructions, not a private postal location.'],
  ['negative-field-legend', 'prose', 'Cột mã giao dịch dùng để nối hai bảng; cột tên khách hàng dùng để kiểm tra trùng. Không thay đổi tên các cột.', 'Field names mentioned as schema, not values.'],
  ['negative-interest-rates', 'fields', 'Kỳ hạn: 9 tháng\nLãi suất: 4,65% mỗi năm\nSố ngày quy ước: 365', 'Financial terms and ordinary numerals.'],
  ['negative-literal-placeholder', 'prose', 'Trong mẫu hướng dẫn, ghi <EMAIL> ở vị trí hộp thư và <SO_DIEN_THOAI> ở vị trí liên hệ; không điền thông tin thật.', 'Explicit placeholders are ordinary documentation.'],
];

const development = [
  ['estate-disbursement', 'prose', 'Khoản chi thừa kế đứng tên [[person|Tạ Huyền Sa]], hồ sơ dùng căn cước [[identity|062184903751]]. Biên bản có 5 trang.', 'Person and identity; page count stays.'],
  ['locker-notice', 'multiline', 'Thông báo nhận chìa khóa được gửi cho [[person|Ngô Thanh Uẩn]] tại\n[[address|phòng 306, tòa Lúa Vàng, số 74 đường Suối Nhỏ, phường Đông Hòa, Dĩ An]].\nKhông gửi chìa khóa qua bưu điện.', 'Address ends before delivery instruction.'],
  ['guarantor-release', 'prose', 'Bên bảo lãnh [[organization|Công ty TNHH Vườn Trăng Nhỏ]] đề nghị giải tỏa; mã số thuế trên thư là [[tax|0583167249]].', 'Whole named guarantor and tax identifier.'],
  ['minor-eligibility', 'prose', 'Hồ sơ trẻ em ghi ngày sinh [[birthdate|ngày 9 tháng 6 năm 2012]]; ngày mở hồ sơ là 22/01/2026. Người đứng tên là [[person|Dương Ngân Kiều]].', 'Separate birth from operational date.'],
  ['complaint-followup', 'prose', 'Phản hồi khiếu nại về [[email|phan-hoi.tram@example.net]], hoặc gọi [[phone|0887 461 293]] sau giờ nghỉ trưa.', 'Complete complaint contacts; ordinary timing phrase remains.'],
  ['document-translation', 'fields', 'Giấy tờ cần dịch: hộ chiếu [[passport|M7394628]]\nChủ giấy tờ: [[person|Cao Tú Uyển]]\nSố bản dịch: 3', 'Passport not transaction ID; copy count remains.'],
  ['chargeback-trace', 'prose', 'Đề nghị truy vết giao dịch [[transaction|CB-DV-7318-Q]] vào tài khoản [[account|510683927406]]. Giá trị tranh chấp là 245.000 đồng.', 'Two identifiers preserve distinct types.'],
  ['dormant-profile', 'fields', 'Hồ sơ ngừng hoạt động: mã khách hàng [[customer|CIF-DV-892603]]\nNgười đại diện: [[person|Lý Diễm San]]\nThời gian lưu: 10 năm', 'Customer code and person; retention duration stays.'],
  ['card-dispute-attachment', 'prose', 'Tệp đính kèm lộ số thẻ [[card|5238-6741-9026-3158]] kèm mã CVV [[cvv|749]]. Cần ẩn cả hai trước khi chuyển tiếp.', 'Hyphens inside card value; checksum is not a privacy criterion.'],
  ['atm-pin-note', 'fields', 'Nội dung ghi chú tại máy: PIN hiện tại [[pin|297463]]\nSố lần thử còn lại: 2', 'PIN value sensitive; retry count stays.'],
  ['portal-access', 'prose', 'Đăng nhập cổng đối soát bằng tài khoản [[username|doi_soat.quynh]] với mật khẩu [[password|Suong#42:Tram!]]. Dấu hai chấm thuộc mật khẩu.', 'Username and full punctuation-bearing password.'],
  ['webhook-secret', 'fields', 'API key cho webhook: [[apikey|om_demo_Dv8wM5x2B7qR]]\nSố lần gọi thử: 11\nTrạng thái: chờ duyệt', 'Key private; counter and status ordinary.'],
  ['audit-source', 'log-text', 'Yêu cầu xuất báo cáo đến từ IP [[ip|198.51.100.164]], tài khoản đăng nhập [[username|kiem.toan_suoi]]. Mã phản hồi 202.', 'Source IP and username; HTTP result stays.'],
  ['secure-tunnel', 'prose', 'Đầu bên kia của phiên hỗ trợ có địa chỉ [[ip|2001:db8:85::c9]]. Phiếu gắn với khách hàng [[customer|KH-DV-45831]], thời lượng 25 phút.', 'IPv6 and customer code; duration stays.'],
  ['password-with-number', 'prose', 'Mật khẩu cần xóa khỏi bản chụp là [[password|0987123456@Thu!]]. Dãy số bên trong không phải số liên hệ được cung cấp.', 'Whole opaque credential wins over embedded phone-shaped substring.'],
  ['trustee-minutes', 'prose', 'Biên bản cử [[person|Đinh Vân Thư]] và [[person|Tống Hà Nguyệt]] đại diện cho [[organization|Quỹ Khuyến học Hạt Sương]] trong lần nhận chứng từ này.', 'Two named trustees and organization; no inferred address.'],
  ['escrow-release', 'fields', 'Đơn vị nhận giải ngân: [[organization|Công ty Cổ phần Mộc Lá Biếc]]\nTài khoản ký quỹ: [[account|629075148306]]\nTỷ lệ giải ngân: 70%', 'Account leading/trailing digits complete; percentage ordinary.'],
  ['property-inspection', 'prose', 'Địa điểm tài sản cần thẩm định là [[address|lô 8, đường Bờ Lau, phường Hòa Quý, Đà Nẵng]]. Hẹn khảo sát ngày 14/10/2026.', 'Private property location; appointment date stays.'],
  ['overseas-confirmation', 'prose', 'Xác nhận qua số [[phone|+84 967 314 852]] rằng hộ chiếu [[passport|N4826197]] thuộc hồ sơ đang xét. Không đọc số giấy tờ trong tin nhắn thoại.', 'International phone and passport; instructions ordinary.'],
  ['business-representative', 'prose', 'Đại diện đơn vị dùng mã số thuế [[tax|0795631842-006]] và hộp thư [[email|dai-dien.lau@example.org]] để nhận kết quả thẩm định.', 'Entire tax branch suffix and email are private.'],
  ['negative-service-hours', 'fields', 'Giờ tiếp nhận: 08:15–16:45\nThời gian nghỉ: 12:00–13:00\nThứ bảy chỉ nhận lịch hẹn', 'Opening hours and days are ordinary.'],
  ['negative-redacted-copy', 'prose', 'Bản sao chỉ còn các nhãn [HỌ TÊN ĐÃ ẨN] và [TÀI KHOẢN ĐÃ ẨN]. Không có giá trị gốc để đối chiếu.', 'Already redacted placeholders must not be learned as private names.'],
  ['negative-credential-errors', 'prose', 'Mật khẩu: không được cung cấp. PIN: không áp dụng. CVV: đã xóa khỏi yêu cầu. Tiếp tục bằng phương thức xác thực khác.', 'No actual credentials after the labels.'],
  ['negative-postal-requirement', 'prose', 'Bổ sung số nhà, tên đường và đơn vị hành chính vào địa chỉ trước khi gửi hồ sơ. Không chấp nhận mô tả chỉ dẫn chung.', 'Address component names in instructions, no address value.'],
  ['negative-software-release', 'prose', 'Bản phát hành 3.7.2 sửa lỗi xuất báo cáo; gói cài đặt có dung lượng 218 MB. Không cần đổi cấu hình kết nối.', 'Version number is not an IP; size is ordinary.'],
  ['negative-discount-schedule', 'table-text', 'Số lượng bản sao | Tỷ lệ giảm\n1–4 | 0%\n5–9 | 5%\n10 trở lên | 8%', 'Bands and percentages do not identify a person.'],
  ['negative-product-heading', 'prose', 'AN TÂM TÍCH LŨY là tiêu đề chương trình giới thiệu tiết kiệm; phần này chỉ mô tả quyền lợi, không nêu người tham gia.', 'Capitalized product title not a person or organization.'],
  ['negative-numbered-procedure', 'multiline', 'Bước 1: kiểm tra chữ ký.\nBước 2: đếm trang.\nBước 3: đóng dấu bản sao.\nKhông ghi thông tin khách vào sổ hướng dẫn.', 'Procedure labels and numbers are ordinary.'],
  ['negative-file-schema', 'fields', 'Tên cột bắt buộc: mã khách hàng, ngày sinh, số căn cước\nĐịnh dạng ngày: DD/MM/YYYY\nGiá trị rỗng: NULL', 'Schema labels and formatting placeholders, no actual private fields.'],
  ['negative-unlabelled-cell', 'table-text', 'Ô B7: 6702819345\nÔ C7: 314\nBảng không có tiêu đề cột hay mô tả nội dung.', 'Bare numeric cells unsupported for identity guessing, even when lengths look sensitive.'],
];

const make = (split, [scenario, representation, annotated, rationale]) => ({
  id: `corpus-v1-${split}-${scenario}`, familyId: `corpus-v1-${scenario}`,
  templateId: `corpus-v1-${scenario}`, scenarioId: scenario, split, representation, annotated, rationale,
  provenance: { kind: 'authored-synthetic', author: 'codex-corpus-author-2026-09-18', createdAt: '2026-09-18', sourceId: 'offlinemask-corpus-expansion-v1', realRecordsUsed: false },
  review: { status: 'unreviewed' },
});
export const records = [...training.map(row => make('train', row)), ...development.map(row => make('development', row))];
for (const scenario of ['courier-routing', 'locker-notice']) {
  const original = records.find(row => row.scenarioId === scenario);
  records.push({ ...original, id: `${original.id}-nfd`, representation: 'nfd-emoji', annotated: `📎 ${original.annotated.normalize('NFD')}`, rationale: `${original.rationale} Same family; decomposed accents and prefix emoji test source mapping, not scenario diversity.` });
}
