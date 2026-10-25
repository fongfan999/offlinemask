# Synthetic document set, first measurement (26 October 2026)

Set: `pnpm -C desktop documents:generate` with seed 1 (decision 0153): 27 documents, nine layouts in four kinds, each as PDF and Word plus a second PDF. Measured with `pnpm -C desktop eval:documents` (decision 0152) and the installed pack `vietnamese-pii-v1`, in the Tài liệu page's path. 25 s.

| Kind | Format | Documents | Not read | Leaked | Over-masked | Unlisted |
| --- | --- | --- | --- | --- | --- | --- |
| Invoice | PDF | 6 | 0 | 0 | 0 | 0 |
| Invoice | Word | 3 | 0 | 0 | 9 | 2 |
| Statement | PDF | 4 | 0 | 18 | 16 | 4 |
| Statement | Word | 2 | 0 | 8 | 12 | 1 |
| Contract | PDF | 4 | 0 | 2 | 18 | 0 |
| Contract | Word | 2 | 0 | 1 | 8 | 0 |
| Form | PDF | 4 | 0 | 0 | 16 | 0 |
| Form | Word | 2 | 0 | 0 | 6 | 0 |
| **All** | | **27** | **0** | **29** | **85** | **7** |

The reader read every value. The failures are detection, in families:

**Leaks (29)**

1. **Account numbers after a bank's abbreviation (24):** "chuyen tien den TK 84939225698468". No rule knows "TK" without a colon; the models miss bare digits.
2. **A label variant (2):** "Số tài khoản nhận lương: 871287224827"; the account label accepts only a few words before the colon.
3. **Names in statements (3):** "Chủ tài khoản: NGÔ BẢO THẢO" (not a name label), and unaccented capitals in transaction text ("HOANG MINH KHOA chuyen tien…"), which the models were not trained on.

**Over-masking (85)**

4. **Headings in capitals (about 48):** "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "SAO KÊ TÀI KHOẢN", "HỢP ĐỒNG THUÊ NHÀ", "ĐẠI DIỆN BÊN A", "NGƯỜI LAO ĐỘNG", "I. THÔNG TIN BẢN THÂN". The known miss of the pack gate ("YÊU CẦU TRA SOÁT GIAO DỊCH") at scale.
5. **Unaccented transaction wording (about 22):** "CT DEN", "TRA LUONG THANG 9", "Thanh toan QR", "Rut tien ATM", read as names or organizations.
6. **Word tables lose their row (9):** goods names masked in Word invoices but not in the same invoices as PDF. The Word reader gives each cell its own paragraph, so rule 6 of 0151 (a goods row) never sees the row.
7. **Job titles and relations (4):** "Nhân viên", "Trưởng nhóm", "Bố" in the CV's tables; "Lai nhap von".

Values are not recorded beyond these examples, which are invented.
