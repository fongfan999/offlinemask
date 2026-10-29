# 0174 — Forms with their labels in a column

Date: 29 October 2026. Status: built and measured. Follows [0172](0172-own-line-recogniser-for-windows.md), whose check on the owner's own scans found the gap ("The owner's own scans"), and the reader by place of [0149](0149-text-pdf-documents.md) and [0171](0171-scanned-pdfs-and-images-read-on-the-machine.md).

## Problem

Office contracts often set their parties out as a form with the labels in a column and the values at a tab stop, after a colon:

```
BÊN B          : LÝ THU THẢO
Ngày sinh      : 18/12/1975
Số CCCD        : 026075699073
```

The reader by place saw each such line as two cells, so a party's block was a table of two columns; and since a typed contract's lines are closer together (about 1.2 font sizes) than the 1.4 at which a table's lines are one row with its cells wrapped, the whole block was one row: every label in one cell, every value in the other, no value next to its label. The detector then had nothing to go on but the model. On the owner's scans this left two ID numbers, two birth dates, an account number and a party's name visible. A text PDF laid out the same way does the same; the synthetic set had no such form, so the measurement never showed it.

## Decision

- **Such a line reads as "Label: value"** (`labelled` in `pdf.ts`, applied as `itemsToLines` makes lines), as the same form typed without the column does: a line of its own, which the masker reads with its label.
  - A cell that starts with a colon after a cell that is only a label (a capital, at most 40 characters, no colon) joins it. Text recognition often reads the colon onto the value (":3/3 đường …"), which counts too, as does a colon alone in a cell between the two.
  - A label's cell that ends with the colon ("Ngày sinh:   18/12/1975") joins the next cell only in a column: when the line above or below is another "Label:" line with its second cell at the same place (within a font size). On its own, that shape is a total in a table's last column ("Cộng tiền hàng hóa, dịch vụ:   5.640.698", which would leave its table) or the "Nơi nhận:" list beside a signature, and both stay as they were. An empty field before the next ("Họ và tên:   Giới tính: Nam") stays apart.
- **A contract's party is a person when its value looks like one** (`person-cues.ts`). After "Bên" and one or two words and a colon ("BÊN B:", "Bên cho thuê:"), a value of two to five words that starts with a family name, in mixed case or made only of name syllables when it is in capitals, is a name. The pack's model missed "LÝ THU THẢO" there in text PDFs and Word files alike. A company stays the organisation rules' to find, and a form of address ("BÊN B: Ông LÊ PHI LONG") stays with the form-of-address rule.
- **"Sinh năm" labels a birth date** (`field-labels.json`), as "Sinh ngày" does; only a whole date is taken, so a year alone ("Sinh năm: 1988") stays.
- **The synthetic set gains a kind laid out that way**: `appendix` (a service contract's appendix), layouts `colon` (the colon starts the values' column) and `label` (the colon ends each label), lines 1.2 font sizes apart, as PDF and Word (`aligned` fields in `render-pdf.mjs` and `render-docx.mjs`). It is last in `kinds-more.mjs`, so every other document keeps its seed and bytes; a seed now gives 84 text documents instead of 78.

## Measured

Through the app's code (`pnpm eval:documents`, the pack on this PC, `--reading` for scans):

| | Before | After |
| --- | --- | --- |
| Appendix forms, seeds 1–7, text (42) | 0 not read, **2 leaked**, 0 over-masked, 25 unlisted | 0 / 0 / 0 / 0 |
| Appendix forms, seeds 1–7, scanned (56) | 17 not read, **56 leaked**, 0 over-masked, 50 unlisted | 17 / 0 / 0 / 19 |
| Seeds 1–7, text (546) | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Seeds 1–7, scanned (703) | 42 / 0 / 6 / 71 | 42 / 0 / 6 / 71 |

The 25 unlisted before were the city in "tại Thành phố Hồ Chí Minh", which the generator had not yet marked as either way. The 17 not read on the scanned forms are misreadings (one digit, a dropped space), all masked as read. Every paragraph of the 546 text documents reads exactly as before the change.

The owner's two contracts, read as in 0172: each party's block now reads one field a line, and the ID numbers, birth dates, account number and the party's full name that were left visible are masked. What these documents still miss, in kinds: the last word of a representative's name after "Đại diện bởi: Ông …" (the model's reach), a form line whose label the reader misplaced on a crooked copier page, and the kinds 0172 lists apart from forms (signature rows, misread copier print, the photographed ID card).

## Not decided here

`readingShipped` stays off (0172). The next work on pictures is unchanged: signature rows, a recogniser trained also on copier print, and ID cards.
