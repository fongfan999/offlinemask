# Boundary policy added after the first independent checks

18 September 2026. The first native implementation matched all 883 frozen token-offset records, but two of 31 separately authored checks failed: the second decomposed name inherited its preceding space, and `B` in `A\r\nB` inherited the line break. This is the reference tokenizer's whitespace-attachment convention, not an ID or UTF-16 conversion discrepancy.

Retain raw `offsets` for exact tokenizer correspondence and add parallel `maskOffsets` for replacement boundaries. Trim only whole whitespace graphemes at either edge; preserve interior whitespace and all non-whitespace symbols. A whitespace-only token keeps its model index but has no masking span. Inserted special tokens have no raw or masking span; special-token lookalikes in source retain a span.

This is a behavior repair, not a relaxation of the independent expected boundaries. The same 31 assertions pass after switching masking assertions to `maskOffsets`; the raw offset comparison remains unchanged and passes all 883 records. The failed output, original library source and original boundary script are retained. This policy must be carried through entity-span aggregation when integrating with the app.
