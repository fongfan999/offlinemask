# 0151 — Invoices: wording, countries and brands are not private

Date: 25 October 2026. Status: implemented. Owner, after masking a real VAT e-invoice as a PDF (decision 0149): "HÓA ĐƠN", "GIÁ TRỊ GIA TĂNG" and "Trang" were masked as names and "Úc" as an address. No text from the invoice is recorded in the repository; the fixtures are invented.

## What was found

The installed pack was run offline on every paragraph of the invoice as the PDF reader now produces it, and each finding was attributed to its source:

- "HÓA ĐƠN" and "Trang" (in "Trang tra cứu") were no longer found. They had been found when the old reader glued them to neighbouring text; reading by position (0149) fixed them.
- **Still found by the models:** "GIÁ TRỊ GIA TĂNG" as a name (Underthesea, 0.95), "VISSAN" (a brand at the start of a product name) as a name (0.88), and "Úc" (in "Thịt bò Úc xay") as an address (1.00).
- **Also found:** the seller's name came out as two organizations. The legal-prefix rule completed "Công ty Cổ phần Dịch vụ Thương mại Tổng" and stopped at the lowercase "hợp"; a model found "hợp Wincommerce". Two aliases for one company.

No score threshold separates these from real names (0.88–1.00). As in decision 0080, the fix is shared policy, pack-independent, not a model change.

## What changes (`model-policy.ts`, `policy.ts`)

1. **Invoice wording is boilerplate.** The phrase list of 0080 rule 4 gains the wording of invoices and receipts: "hóa đơn", "điện tử", "giá trị gia tăng", "GTGT", "thuế suất", "tiền thuế", "thuế", "thành tiền", "đơn giá", "đơn vị tính", "số lượng", "tổng cộng", "tổng hợp", "tổng tiền", "ký hiệu", "mã số thuế", "người mua hàng", "người bán hàng", "mã tra cứu", "trang tra cứu", "tra cứu", and "Trang N" / "Trang N/M". Runs join, so "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" is one phrase. Whole phrases only: "Thu Trang", or a company that reaches past a phrase ("Thương mại Tổng hợp Sao Mai"), is kept.
2. **A country alone is not an address.** A place span that is only a country or region ("Úc", "Mỹ", "Nhật Bản", "Việt Nam", "châu Âu", a closed list) is dropped: it says where a product comes from, not where someone lives. An address that ends in one ("…, Hà Nội, Việt Nam") is kept whole.
3. **A brand in capitals is not a person.** A name span that is a single word of three or more capital letters, which no Vietnamese syllable spells (onset, one to three vowels, final, tone marks removed), is dropped: "VISSAN", "PACOW", "WINECO", "FPT". Vietnamese names in capitals ("NGUYỄN", "QUỲNH", "TRANG") are syllables and are kept, as are foreign names in Title Case ("John"). The cost: a foreign given name written alone in capitals ("JOHN") is no longer masked by the models; after a name label ("Họ tên: JOHN SMITH") the labelled-field rule still masks it.
5. **Brands are trimmed from names, and a brand in a product cell is not an organization** (the owner's second masked copy still hid "VISSAN Xúc" as a name and "WINECO" as an organization). The app reads a document in batches of paragraphs, where the models saw more context than the paragraph-by-paragraph check above: Underthesea gave "VISSAN Xúc" (0.38) and "WINECO" as an organization (0.98). A name span loses the brands in capitals at its edges and is then checked like any other ("Xúc" alone at 0.38 is under the one-word minimum). An organization that is a brand in capitals is dropped only in a cell (between tabs or lines) that also has a product measure or pack ("300g", "1,5 l", "gói", "khay", "chai"…); elsewhere ("làm việc tại JEMMIA") an organization in capitals is still masked.
4. **Adjacent organizations are one.** After every rule and model has spoken, two organization spans with only spaces between them (no tab, no line break, nothing found between) become one span, so one company gets one alias.

## Gate

`tests/model-plausibility.test.mjs` covers each rule with fake predictions, including what must be kept ("Thu Trang", "NGUYỄN VĂN AN", "Hà Nội, Việt Nam", two organizations a tab apart). `tests/fixtures/recognition-pack.json` gains an invented VAT invoice: both companies, the tax code and both addresses must be hidden, and the title, the column headings, "KIMSAN Xúc xích", "TRUFOOD Cải ngọt", "Thịt bò Úc xay", "Trang tra cứu" and "Trang 1/1" kept.

## Verified

On the owner's invoice with the installed pack, read in the app's batches of paragraphs (`scanBatches`, 8 000 characters) as well as one paragraph at a time: no name or place was found in the title, the headings, the product names or the footer; each company is one organization; the two companies, both addresses, the two tax codes and the provider's phone number are still found. `pnpm test` (393) and `pnpm test:models` with the installed pack (18/19 fixtures, the same known miss on uppercase prose as before) pass. The known miss, "YÊU CẦU TRA SOÁT GIAO DỊCH", is Vietnamese words in capitals and is untouched by rule 3.
