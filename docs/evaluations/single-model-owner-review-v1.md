# Owner review of the single-model examples — 19 September 2026

All twelve responses are recorded. The owner subsequently confirmed that customer identifier `KH847291` in example 5 must also be hidden. There are no unanswered questions in this review receipt. The initial pending ledger remains an immutable historical snapshot; the [completed receipt](single-model-owner-review-v1/completed.json) records current status.

**B is BigMed; A is Underthesea.** Comparing the saved outputs to the reviewed expected spans and existing category mapping, B matches 9 of these 12 examples and A matches 5. This is a comparison of deliberately selected, already observed examples, not overall accuracy or a new release qualification. Both candidates remain rejected under the broader frozen quality evaluation.

| Example | Confirmed expectation | A: Underthesea | B: BigMed |
| --- | --- | --- | --- |
| 1 | Hide the full lowercase `đỗ hoàng phúc` as a person | Misses the name | Misses the name |
| 2 | Hide the full `H’Hen Niê` as a person | Fragments the name and labels parts as location | Matches |
| 3 | Keep ordinary uppercase headings | Unwanted masking | Matches |
| 4 | Hide the decomposed name and account number | Matches | Matches |
| 5 | Hide customer ID, full `Lâm Quốc Hưng`, and full address | ID/address correct; misclassifies `Hưng` as organization | ID/address correct; misses `Lâm Quốc` |
| 6 | Hide the full slash-number address | Matches | Matches |
| 7 | Keep the Unicode test string | Unwanted masking | Matches |
| 8 | Keep the cooperative-name example | Unwanted location finding | Unwanted location finding |
| 9 | Hide the full decomposed `Tạ Uyên Chi` | Matches | Matches |
| 10 | Hide the card number and CVV | Matches | Matches |
| 11 | Keep ordinary title-case headings | Unwanted masking | Matches |
| 12 | Hide the full alley/house-number address | Matches | Matches |

## Preserve feedback and distinguish it from computed diagnosis

The [verbatim response](single-model-owner-review-v1/response.txt) is retained with source/output hashes. Example 1's quoted `đỗ hoàng phúc → TEN` is recorded as the desired output: neither saved model result actually detected the name. It must not be counted as a success for either model.

The owner described A in example 2 as overmasking. The saved spans show a more specific problem: person/location category fragmentation within the desired name, with no additional lexical positions outside it. Both descriptions remain recorded; no blanket endorsement of A's all-options masking is inferred.

The original reply to example 5 omitted `KH847291`. The follow-up explicitly confirms it must be hidden. The final assessment counts that finding as correct for both candidates, not excess masking. Both still fail the full-name requirement, independently of the ID clarification.

Example 8 differs from the original synthetic fixture, which annotated the cooperative name as an organization to hide. The owner's reviewed expectation for this example is now “keep.” Both candidates incorrectly identify its body as a location. Globally disabling organization findings would therefore not fix these actual outputs. This case-level feedback does not authorize removing all organizations from the product's “other” category, or treating organizations/locations in every context as public.

## Reusable evidence, not rewritten history

[Reviewed cases](single-model-owner-review-v1/reviewed-cases.json) provide a separate twelve-case regression overlay with exact original UTF-16 source spans, including decomposed accents. They preserve this review for future candidate comparisons without rewriting any historical fixture, threshold or score. All categories are mapped by the assistant to the existing six-category schema; the raw owner wording is retained separately.

The [initial receipt](single-model-owner-review-v1/receipt.json) records all responses and the then-pending ID question. The [completed receipt](single-model-owner-review-v1/completed.json) references it by hash and incorporates the clarification. The [verification](single-model-owner-review-v1/verification.json) checks all 12 source hashes/spans, 24 candidate assessments, raw response, scripts, original outputs and prior evidence hashes. No model inference was repeated and no production source, pack, dependencies or UI changed. Application tests were not rerun for this evidence-only update; the previous run remains 151 passing tests.

The author of these synthetic examples and the reviewer are different, but the examples were already observed and model outputs were supplied. This is human review of expected behavior, not a blind independent holdout or approval of the separate MiniLM training corpus. No training, real user-input collection or release acceptance is inferred.

## Product conclusion

The owner review makes the cost of false positives concrete: ordinary headings, symbols and this cooperative example should remain usable. The compact candidate's higher aggregate coverage does not establish the better experience. Conversely, BigMed's better performance on these selected examples does not excuse its missed names or overturn its broader failure.

Keep the release rejection in force. The next product question is the general scope of contextual categories—particularly organizations versus personal information—before any new evaluation claims. That is separate from the now-complete twelve-case review. A future change to global scope needs an explicit decision and a new versioned comparison; these annotations must not be generalized automatically. Do not restart model tuning, train a new model or silently ship BigMed on the basis of this review.
