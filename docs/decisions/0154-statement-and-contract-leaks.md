# 0154 — Statement and contract leaks: account shorthand, labels, names by position

Date: 26 October 2026. Status: implemented. Owner: "Fix the leak families first (TK account numbers, label variants, names in statements), measuring every change on the synthetic set and my private set."

## Method

The first measurement of the synthetic set (decision 0153, seed 1) found 29 leaks in three families, none in the owner's ten invoices (0152). Each change below was measured on both. Because fitting rules to 27 documents is easy, fresh sets were generated with other seeds (2–7, new people, numbers and transactions) and measured too; seeds 4–7 were looked at only after the first round of rules, and they found five more gaps, fixed the same way. Every rule is a structure (a label, a position in a transfer line, a form of address, a signature), not a list of the values that leaked.

## Changes

1. **Account numbers after "TK"** (`banking.ts`): statements write "chuyen tien den TK 84939225698468". "TK" joins the account labels, with six digits at least, so a ledger account ("Nợ TK 331") stays.
2. **Longer account labels**: up to three words before the colon ("Số tài khoản nhận lương:", "Tài khoản thụ hưởng:").
3. **Account holders are names** (`labelled-fields.ts`): "Chủ tài khoản", "Tên chủ tài khoản", "Tên tài khoản"; and "Địa điểm làm việc", "Địa điểm kinh doanh" are address labels.
4. **A field ends at a tab or " · "**, the separators Word and the PDF reader put between two fields on one line; "Chủ tài khoản: NGÔ BẢO THẢO · Số tài khoản: …" was refused as a name because the value ran into the next field.
5. **Names in transfer text** (`detectTransferNames`): unaccented capitals the models were not trained on. A name starts with a family name, every word is a Vietnamese syllable, and it stands where a transfer puts a person: the sender at the start or after "CT DEN:<ref>", before "chuyen tien", "chuyen khoan" or "CK"; the recipient after "TK <number>", ending the cell. "TRA LUONG THANG 9" and "Thanh toan QR" are not names.
6. **Names by their cues** (`person-cues.ts`): after a form of address ("Ông", "Bà", "Anh", "Chị") or "mang tên" / "đứng tên", the longest run of capitalised syllables that starts with a family name ("Bà Võ Minh Yến cam kết" gives "Võ Minh Yến"); a given name alone only after a lowercase form of address in a sentence ("gọi cho bà Trang"). Under a signature note ("(Ký, ghi rõ họ tên)", "(Ký, đóng dấu)"), each name on one of the next two lines, side by side or not. A heading after the note ("HỢP ĐỒNG NÀY CÓ HIỆU LỰC") is not a name.
7. **A company in capitals needs no label or model evidence** (`context-fields.ts`): "TRA LUONG THANG 9 CONG TY TNHH THUONG MAI TONG HOP THANH CONG". It still needs its legal prefix and two capitalised words, and a name never continues across a tab into the next cell (it had taken "6.000.000").
8. **Reader**: a short line within 1.4 font sizes of a table row continues it even as the table's last line or before a page break (a statement's wrapped description had left its account number without its "TK"); lines join into one table row below 1.4 font sizes instead of 1.25 (wrapped lines sit 1.15–1.25 apart, rows 1.5 or more); and a "Label: value" line must start with a capital, so a wrapped line of prose ("điểm làm việc: 15 Võ Văn Tần…") does not start a new paragraph and cut its label in half.

The evaluation script accepts a short hide value with its context (`{ "value": "Trang", "in": "bà Trang" }`), so a given name is not expected hidden in "Trang 1/1".

## Result

| Set | Documents | Leaked before | Leaked after | Over-masked before → after |
| --- | --- | --- | --- | --- |
| Synthetic, seed 1 | 27 | 29 | 0 | 85 → 83 |
| Synthetic, seeds 2–7 | 162 | 2–5 each, as found | 0 | 81–96 each, not higher than before |
| Owner's invoices | 10 | 0 | 0 | 0 → 0 |

Not read stayed 0 everywhere. `tests/statement-leaks.test.mjs` covers each rule and what must stay readable; `tests/fixtures/recognition-pack.json` gains a bank statement (`pnpm test:models`: 20/21, the same known miss). Over-masking (headings in capitals, unaccented transaction wording, Word tables without their row, job titles) is the next family; "SAO KÊ TÀI KHOẢN" is still masked.

## Known limits

A sender written as "LE PHI DICH VU chuyen tien" would read as a name (a fee, "lệ phí", in a sender's position); real fee lines do not take that form. A name in transfer text that does not start with one of the listed family names, or that the bank abbreviates, is left to the models.
