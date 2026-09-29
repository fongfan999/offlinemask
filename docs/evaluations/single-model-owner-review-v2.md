# Owner correction: organizations remain in scope

The owner explicitly corrected the earlier response: organization names should be hidden. This supersedes the case-8 keep-visible expectation and the suggestion to leave organizations visible by default. It agrees with the existing application's organization mapping under “Thông tin riêng tư khác”; existing user category selection continues to apply. No UI or detector change is necessary to record the scope.

Example 8 must hide the full `Hop tac xa Nong san Suoi Mo` as an organization. Both saved candidates hide only `Nong san Suoi Mo` as a location. The correct diagnosis is incomplete masking and the wrong category, rather than excess masking. Both still fail this example, so the selected-review counts remain **A/Underthesea 5 of 12** and **B/BigMed 9 of 12**. The wider release rejection is unchanged.

The [corrected receipt](single-model-owner-review-v2/completed.json), [reviewed cases](single-model-owner-review-v2/reviewed-cases.json) and [verification](single-model-owner-review-v2/verification.json) retain exact original text/output bindings and explicitly supersede v1. The original response, initial clarification and historical results are preserved. No new inference, training, dependency, production source or pack changes occurred.

No other scope conflict remains in the twelve reviewed examples. Customer ID `KH847291` remains required in example 5. Example 1 remains a missed lowercase name in both outputs; example 2 still has fragmented/wrong-category output in A; example 5 still has incomplete or misclassified name output in both. These are detection defects, not unresolved scope decisions.

The review does not establish exhaustive privacy coverage for every possible document. Existing categories still include contact details, identifiers, cards/credentials, birth dates, IP/GPS and contextual names/addresses/organizations. Ordinary headings, amounts and operational dates are distinguished from those private values by existing policy. The owner's correction does not reopen model selection or imply any current candidate is ready for release.
