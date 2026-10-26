# 0159 — Official decisions: the identifier's name, public bodies, the place of issue

Date: 26 October 2026. Status: implemented, measured, in 2.3.0 before it was pushed. Owner, testing the 2.3.0 native build on a decision granting them unemployment benefit ("I just tested this file"), then: "hold the push. Add this decision to my private set with an expectation list, fix the leak and the over-masking by structure, measure on all sets, and move the tag."

## What the document showed

A government decision is a kind the sets of 0152 and 0153 did not hold. On it, the 2.3.0 build:

- **Leaked the 12-digit personal number** after "Số định danh cá nhân:", the official name of the number on the CCCD card. The identifier rule (`banking.ts`) knew only the labels CCCD, CMND, "căn cước" and "chứng minh nhân dân".
- **Masked the city after every state body as an address** nine times ("ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH", "Sở Nội vụ …", "Trung tâm Dịch vụ việc làm …", "Bảo hiểm xã hội …", "Bưu điện …"), the bodies as organizations six times, and the place of issue in the date line ("Thành phố Hồ Chí Minh, ngày 23 tháng 9 năm 2026"). A model found the city; the address completion of 0081 then grew it over the body's words ("THÀNH PHỐ HỒ CHÍ MINH SỞ NỘI VỤ").
- **Read document wording as people and places:** "Như Điều 4" and "Lưu" in the "Nơi nhận" block as names, "Quyết định" in "thi hành Quyết định này" as a place.
- **Mangled the hospital:** "BỆNH VIỆN ĐA KHOA TÂM ANH TP. HCM" came out as "BỆNH [TEN] [DIA_CHI] [DIA_CHI]", "VIỆN" a name and the rest two addresses.
- **Cut the residence:** "Nơi ở hiện nay:" was not an address label, and the model's span ended inside the apartment number ("Căn hộ chung cư số A34.07"), so "07" stayed outside the alias.

The document went into the owner's private set (0152) in its own folder, `~/OfflineMask-eval/decisions`, with a hide, keep and ignore list written for it and marked draft until the owner reviews it; nothing from it is in the repository. Baseline: not read 0, leaked 3 (the identifier, the hospital, the residence), over-masked 11.

## Changes, each a structure of the document

1. **The identifier's official name is a label** (`banking.ts`): "Số định danh cá nhân", "Mã định danh (cá nhân)", "định danh cá nhân", before 12 or 9 digits.
2. **Public bodies are not private data, and the place after one is its jurisdiction** (`model-policy.ts`, `publicBodyRanges`). A term for a state body or public service in the text ("ủy ban nhân dân", "UBND", "hội đồng nhân dân", "chính phủ", "quốc hội", "bảo hiểm xã hội", "trung tâm dịch vụ việc làm", "công an", "tòa án", "viện kiểm sát", "kho bạc nhà nước", "ngân hàng nhà nước", "bưu điện", "Sở/Bộ" with the standard department names, "Cục/Chi cục" with the standard services) opens a range, extended over every place or organization a model found touching it, across a gap of up to two words (the unit's kind, which a model leaves out or cuts: "Ủy ban nhân dân [Thành phố] Hồ Chí Minh", "[Thành] phố Hồ Chí Minh"), and over a "name" that is a piece of the place ("HỒ" then "CHÍ MINH") unless it looks like a real name (0156's `looksLikeKnownName`: "Giám đốc Sở Y tế Nguyễn Văn An" keeps the name). Every model span inside the range is dropped, so nothing seeds the address completion. The range is built from each model's own spans, so each model's pass shields the same body.
3. **The place of issue** (`issuePlaceRanges`): up to six words without a number at the start of a line or cell, followed by ", ngày d tháng m năm yyyy", are where the document was signed. Read from the text, not from a span, because the two models' passes run apart: in the first version the place span shielded its own pass and the other model's lone "Chí" (an organization at 0.95) survived. A residence before a date in prose ("Ký tại 12 Lê Lợi, Quận 1, ngày …") has a number and is kept as an address.
4. **Official-document wording joins the boilerplate phrases** (0080 rule 4): "quyết định", "nghị định", "thông tư", "công văn", "nơi nhận", "như điều N", "như trên", "lưu:" with the filing initials after it ("Lưu: VT, TTDVVL"; the pack read "VT" as a name at 0.93), "KT.", "TM.", "TL.".
5. **A hospital or school carries its kind like a legal form** (`context-fields.ts`): "bệnh viện", "phòng khám (đa khoa)", "trường đại học/cao đẳng/THPT/THCS/tiểu học/mầm non" join the legal prefixes, so "BỆNH VIỆN ĐA KHOA TÂM ANH TP. HCM" is one organization with one alias. Two details made it work: "đa khoa" folds to "da khoa", and "da" was a stop word ("đã" ends a name), now excepted before "khoa"; and an abbreviation with its period before another capital ("TP. HCM") is one token of the name.
6. **Residence labels and a period inside a value** (`labelled-fields.ts`): "nơi ở hiện nay", "chỗ ở hiện nay", "nơi cư trú", "hộ khẩu thường trú", "nơi đăng ký thường trú", "địa chỉ hiện tại" join the address labels, and a period between a letter or digit and a digit ("A34.07") no longer ends the value.

No dependency was added. `tests/model-plausibility.test.mjs` covers each rule with an invented decision and fake model spans, and the residence-before-a-date case. `tests/fixtures/recognition-pack.json` gains `government-decision`, an invented decision for the real models: the person, birth date, identifier, both addresses, account and hospital must be hidden; the bodies, the date line, the title and the "Nơi nhận" block must stay.

## Result

| Set | Documents | Not read | Leaked | Over-masked | Unlisted |
| --- | --- | --- | --- | --- | --- |
| Owner's decision (new) | 1 | 0 | 3 → 0 | 11 → 0 | 0 |
| Owner's invoices | 10 | 0 | 0 → 0 | 0 → 0 | 0 |
| Synthetic, seeds 1–7 | 189 | 0 | 0 → 0 | 0 → 0 | 3 → 3 (the same "Nam", "Số", "Số" as 0156) |

`pnpm test` 418, `pnpm test:models` 22/22 with the installed pack, lint and typecheck pass.

## Not done

- The synthetic generator (0153) has no decision layout yet; the gate fixture and the owner's document are the measurements for this kind. A generated layout (decisions, notices, certificates) is the next addition to the public set.
- Public bodies are kept readable everywhere, in a CV's employer line too. A model may still find a company inside a body's range only when the range does not reach it.
