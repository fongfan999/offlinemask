# 0012 — Complete structured credentials and identifiers

Date: 14 September 2026. Status: targeted implementation; existing model pack retained.

## Decision

Add a local structured-value recognizer for explicit username, password, API-key/access-token, numeric account, and postcode labels. Resolve these fields before checkbox filtering so a credential labelled by the model as email is still hidden under “Thông tin riêng tư khác”. The owner requested this follow-up after the text-boundary work and reiterated that detection improvement must not collect user input or corrections.

This supplements the existing model and contact/banking rules. It is not an alternative pretrained model, a model update, or a general credential detector for arbitrary prose. No new dependency or library API is introduced.

## Supported structure

| Field | Recognized structure | Category |
| --- | --- | --- |
| Username | Vietnamese “Tên đăng nhập”, English username/user name; colon or equals | Other |
| Password | “Mật khẩu”, optional “tạm”/“tạm thời”, or password; colon or equals | Other |
| API key/access token | API key/api_key/api-key, optional “thử nghiệm”, “Khóa API”, “Khóa truy cập”, access token variants; colon or equals | Other |
| Account | Existing numeric account scope, including sender/recipient/beneficiary labels; colon, equals, or horizontal whitespace | Banking |
| Postcode | Explicit Vietnamese/English postcode labels followed by five or six digits | Address |
| Transaction facts | Explicit transaction/received/processed-date labels with a valid DD/MM/YYYY date; amount/transaction-fee labels with supported Vietnamese numeric formatting and đồng/VND/₫ currency suffix | Retained |

Labels are matched case/accent-insensitively using the existing grapheme-to-source index. Captured values always refer to the original UTF-16 text. Numbers preserve leading zeros and separators. Account detection accepts 6–20 digits separated by individual spaces or hyphens; this is contextual detection, not ownership, account-validity or country-format verification. Postcode scope is five/six numeric digits, not a worldwide postal-address validator.

Quoted credentials support straight quotes, curly quotes and backticks, including spaces and punctuation inside the value. Backslash escapes prevent an embedded quote from ending the span; the source is not unescaped or decoded. Label-like text inside a quoted credential remains part of that credential. Bare credentials end at whitespace or a comma/semicolon separated from the next value by whitespace. Internal punctuation remains covered. A terminal period in a bare value remains masked because it could belong to the credential; quotes provide an unambiguous boundary. Multiline quoted secrets, unterminated quotes, empty strings and values exceeding the 1,024-unit bound do not produce a new structured span. Existing model evidence may still remain; the recognizer does not claim that those unsupported fields are fully checked.

Unquoted known placeholders such as “chưa cung cấp”, “đang cập nhật”, or “N/A” are excluded. Quoted strings such as `"null"` are treated as literal credentials. Ordinary instructions beginning with a recognized request/status phrase do not become a bare credential. This is a bounded format rule and remains ambiguous outside the documented structure.

## Reconciliation and privacy

The structured recognizer runs after the existing model/name/address reconciliation and after contact/banking providers, but before option filtering. Full explicit values replace overlapping guesses, including a valid-looking email inside a password. Evidence outside the field is preserved. The rule source is visible through the existing finding provenance.

Local-only runs also apply this reconciliation. They can recognize role-labelled accounts without loading model weights, and email-only selection does not accidentally hide an email-shaped password as a contact. Existing option availability is unchanged: “other” and address choices still require the optional pack because their broader scope remains contextual. No UI redesign or new switch is added.

Only well-formed, explicitly labelled transaction facts are retained against conflicting model guesses. Birth dates and arbitrary dates/numbers are not excluded. There is no blanket uppercase-heading suppression and no new global blacklist of ordinary Vietnamese words. Thus broader false positives remain a limitation.

All new code runs locally without network, storage, analytics, input logging, correction collection or automatic updates. Real input retains the existing RAM-only lifecycle. The tests and evaluation artifacts use synthetic values only. The default installer, pinned model files, manual download policy and production WASM selection remain unchanged.

## Validation and limits

See the [structured-value evaluation](../evaluations/2026-09-14-structured-values.md) for fresh-set results, full/category/partial-coverage regression comparisons, and test/build evidence. The same screening criteria remain in use. Success on structured examples does not establish general banking readiness, world-wide identifier coverage, or a final single-model choice. Unlabelled credentials, unrestricted prose addresses, unsupported formats and model-generated false positives remain separate unresolved work.
