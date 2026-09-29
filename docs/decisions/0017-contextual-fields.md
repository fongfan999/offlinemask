# 0017 — IPv6 and contextual field boundaries

Date: 2026-09-17. Status: implemented shared policy; release model selection remains open.

The owner approved closing the remaining shared-detector gaps before revisiting candidate selection. Keep the existing six choices and one optional recognition pack. No new UI, telemetry, private-input persistence, download or update behavior is introduced.

## Behavior and bounds

- Validate maximal IPv6 candidates with **ipaddr.js 2.5.0**, including compressed, IPv4-mapped and scoped addresses. Keep exact source offsets, brackets and sentence punctuation. Reject malformed whole candidates rather than masking valid fragments. CIDR ranges are outside this rule. Bare `::` requires an IP label to avoid treating punctuation as an address.
- Recognize valid numeric and Vietnamese written-out dates after explicit birth-date labels, including bounded prose connectors. Validate calendar days rather than accepting impossible dates. Other explicitly labelled transaction, appointment and accounting dates remain visible, as do bounded version numbers, HTTP codes and operational counts. Unlabelled dates and arbitrary numbers retain existing detection behavior.
- Complete a legal organization prefix and bounded proper-name body when an explicit organization label or intersecting name/organization model evidence supports it. Allow a small set of lowercase business-name connectors, but never cross a line or consume an action phrase. This is boundary repair, not a general Vietnamese organization recognizer; lowercase, abbreviated, unusual and long names may remain incomplete.
- Reconcile meaning before category selection: organizations, IPs and birth dates stay under “Thông tin riêng tư khác.” Complete explicitly labelled credentials take precedence over anything recognized inside their value. Contextual options still require the pack; the actual no-pack contact/banking path is unchanged.

## Dependency provenance

[ipaddr.js](https://github.com/whitequark/ipaddr.js) is a small zero-dependency IP parser under the MIT license. Version 2.5.0 is pinned in both the package manifest and pnpm lockfile. Its npm unpacked size is 64,424 bytes; this is not a measured installer increase. The [license notice](../licenses/ipaddr.js-MIT.txt) is retained. The implementation uses `IPv6.isValid`; it introduces no network calls. Library documentation was checked through Context7 against the official repository.

## Evidence and limits

The [context-field experiment](../evaluations/context-fields.md) preserves the previous policy, old annotations and model assets and compares complete, partial and category-selected coverage. It also checks exact newly masked ordinary positions, unchanged model-derived predictions, deterministic repeats and the actual no-pack path. New unit checks cover malformed input, ordinary prose, NFD offsets and credential precedence.

All evaluation data is developer-authored and synthetic, including the already observed challenge. These are development regressions, not independent final validation or real banking accuracy. No new checkpoint, pair architecture or packaged desktop release is qualified by this work. Rerunning all candidates under the same policy, independent validation and desktop resource/offline qualification remain separate steps.
