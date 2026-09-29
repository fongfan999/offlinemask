# Bounded structured-value repair

Extend the shared detector without changing models, pack routing, UI or dependencies. Recognize explicitly labelled 13–19 digit payment cards, 3–4 digit CVV/CVC values and 4–6 digit PINs. Reject length instructions, malformed numeric tokens and unlabelled numbers. These are privacy recognition rules, not payment validation; do not require Luhn validity.

Add canonical four-part decimal IPv4 only after an explicit IP/IPv4 label (including “IP đăng nhập”). Reject malformed tokens, CIDRs, version numbers and shorthand notation. Keep IPv6 behavior. Recognize a valid birthday after “Ngày sinh của <bounded capitalized name> là”; preserve model detections of the intervening name. Read account values from explicitly labelled TSV columns with another recognized header and consistent row width; do not guess columns or imply Excel support.

Opaque credentials retain precedence, NFC/NFD offsets remain exact, and email/phone/banking-only operation must not load a model. Add authored positive and negative unit cases; these are observed developer tests, not an independent accuracy set.

Replay all 362 previously observed cases with actual pair and Underthesea INT8 inference, using the same model-derived Detection arrays for frozen-before and changed policies. Check unrestricted, contextual-only, rule-only and raw local paths. Assert before outputs exactly reproduce the frozen pretrained-scope run, including all six individual selections. Report coverage gains, complete and partial losses, and newly masked ordinary positions; do not remove missed types from denominators. Preserve prior protocols and results. No training, downloads, telemetry or release-quality claims.
