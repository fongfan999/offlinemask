# OfflineMask — Product requirements document

**Product name:** OfflineMask

**Version:** 0.1 — MVP draft

**Updated:** 9 September 2026

**Status:** Product name selected and MVP scope documented. Technology selection is next; no application implementation or foundation has been selected.

## 1. Product purpose

Build a fully offline, cross-platform desktop application that helps users identify and mask sensitive information before sharing material with an external AI tool, then restore known identifiers in the returned results locally.

The first users are individual Vietnamese banking employees. The product must support reusable workflows and be easy to extend to additional file formats, industries, and languages. The supplied transaction spreadsheet is one example of daily work, not the boundary of the product.

The application prepares and checks data. Users separately decide whether and where to share the exported material. The MVP does not submit files or prompts to an AI service.

### Problem

Employees want to use AI on operational data but preparing that data manually takes time. Sensitive information appears in structured columns, document headers, and free-form narratives. Repeated uploads require repeated configuration. Inconsistent replacements can break relationships, while careless transformations can change the information needed for analysis. Users also need a dependable way to restore identifiers afterward.

### Intended outcome

An employee can prepare a reviewed copy of text or tabular data, reuse the same configuration on similar work, understand which checks passed, and restore unchanged aliases in returned results without requiring internet access for any application operation.

## 2. Users and initial workflows

| User | Primary need |
| --- | --- |
| Banking employee working with transaction data | Mask identifiers while retaining the approved fields and relationships needed for analysis. |
| Banking employee handling customer narratives | Find sensitive details in Vietnamese text, review suggestions, and prepare material for summarisation. |
| Repeat user or knowledgeable colleague | Save useful configurations and share reusable rules without sharing customer records or restoration mappings. |

The MVP ships two starter workflow profiles:

1. **Transaction analysis:** spreadsheet or CSV preparation, column-aware masking, consistent aliases, and selected count/total checks.
2. **Customer-complaint summarisation:** pasted Vietnamese text, contextual detection suggestions, manual correction, and local restoration of aliases in a returned summary.

These profiles are editable starting points. They do not automatically determine what a bank permits users to disclose.

## 3. Differentiation and validation hypothesis

**Proposed value proposition:** Prepare Vietnamese banking data for AI with less manual review, and verify that masking preserves the information needed for the job.

The intended advantage comes from Vietnamese banking rules, useful workflow profiles, and measured reliability. Offline processing, reversible masking, multiple file formats, configuration export, and Vietnamese language support are not individually unique features.

The product should develop three strengths:

- **Relevant detection:** Vietnamese names and identifiers in their operational context, including missing accents, abbreviations, customer codes, and transaction narratives within explicitly tested coverage.
- **Reusable preparation:** users correct a workflow once and reuse appropriate rules on later files.
- **Specific verification:** confirm defined properties such as transaction counts, approved totals, alias consistency, and exact restoration of known aliases.

This is a product hypothesis, not an established market or accuracy claim. A different interface or model alone does not demonstrate the advantage.

### Competitive context

Public documentation reviewed during product discovery on 9 September 2026 indicates:

| Product | Existing overlap | Relevant limitation or uncertainty |
| --- | --- | --- |
| Omit | Offline detection, review, reversible vault, and audit reports. | Its documented contextual detection languages exclude Vietnamese. |
| LocalMask | Offline document workflows, financial use cases, consistent aliases across files, custom rules, and restoration. | Its public detection coverage specifies English and Chinese; Vietnamese detection is unverified. |
| Prompt Anonymizer | Local text masking and restoration, desktop/browser interfaces, and listed Vietnamese support. | No native Excel workbook workflow was found in the reviewed documentation and Python CLI. Vietnamese banking accuracy is unproven. |

These are documentation findings, not results from independent product tests. Prompt Anonymizer is a possible source of reusable components and a comparison baseline; it is not the selected application foundation.

## 4. Scope boundaries

### Required for MVP

- Desktop application for Windows, macOS, and Linux.
- Vietnamese as the first content language and a usable Vietnamese review experience.
- Pasted text, CSV files, and a documented subset of ordinary XLSX workbooks.
- Detection suggestions with explanations and manual review controls.
- Consistent masking within a local project and encrypted restoration mappings.
- Preview, workflow-specific checks, export, and restoration of known aliases.
- Versioned rule packs, saved profiles, configuration import/export, and explicit reuse of review corrections.
- Fully disconnected installation and operation using locally supplied resources.

### Deferred

- PDF, Word, scanned documents, images, audio, OCR, and legacy or macro-enabled Excel formats.
- Browser extensions, clipboard interception, AI-provider integrations, and automatic submission to external AI.
- Central administration, shared team vaults, cloud accounts, cloud synchronisation, and enterprise deployment consoles.
- Public marketplace, automatic pack updates, and arbitrary executable third-party plugins.
- Training a custom detection model and adding further language packs.
- A local conversational AI assistant or a replacement for banking analysis systems.
- A possible mobile mini version for use on the go, to be considered after the desktop product demonstrates demand.

Cross-platform support is part of the intended MVP. Minimum OS versions, CPU architectures, and the verified release matrix must be decided before implementation planning; unsupported builds must not be advertised as supported.

## 5. Core user journeys

### A. Prepare and restore a new job

1. Create or open a local project.
2. Paste text or import supported files.
3. Select a workflow profile, or start with defaults.
4. Review detected fields, explanations, uncertain content, and compatibility findings.
5. Accept or reject suggestions; add selections or whole-column rules.
6. Generate a masked preview and run the profile's checks.
7. Resolve blocking findings, then export a new copy. Originals remain unchanged.
8. Use the exported material in an AI tool separately.
9. Paste or import the returned result into the same project.
10. Preview restoration of exact known aliases, inspect unresolved cases, and export a restored copy.

### B. Reuse a review on similar files

1. During review, classify a field such as `STK thụ hưởng` as an account identifier.
2. Choose **Remember for similar files** and inspect the proposed reusable rule.
3. Save it into an existing profile or create a new one.
4. On a later import, identify a matching profile using headers and structure.
5. Apply its suggestions and highlight changed, ambiguous, or unmatched fields.
6. Review the new file before export.

A decision about one cell or one occurrence is not automatically promoted to a global exception. Profiles do not imply automatic export.

### C. Share a configuration

1. Select a rule pack or profile for export.
2. Review the included rules and dependencies.
3. Export a portable configuration that excludes private project data by default.
4. Transfer it through any user-chosen channel, including USB.
5. Import it on another computer, inspect compatibility and contents, then select it in a profile.

An imported pack is available throughout the application. Availability does not make it active for every document.

## 6. Functional requirements

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FR-01 | Local projects | Users can save and reopen a project with its files, profile selection, review state, and protected mappings. Restarting the app does not invalidate saved aliases. |
| FR-02 | Supported input | Text, CSV, and supported XLSX fixtures import without silent conversion of identifiers or data types. Unsupported formats and workbook features are identified before an unsafe export can occur. |
| FR-03 | Detection suggestions | Each suggestion identifies a type and source location and explains the triggering rule or detector. Low-confidence or ambiguous suggestions remain reviewable. Coverage and known limitations are documented. |
| FR-04 | Review controls | Users can accept/reject a suggestion, select a text span or cell, act on an entire column, and preview affected occurrences before a bulk change. |
| FR-05 | Consistent aliases | An approved value uses a consistent, collision-free alias within its defined project/type scope. Distinct values do not accidentally share aliases. Existing text that resembles an alias is handled without accidental restoration. |
| FR-06 | Protected mappings | Original values and restoration mappings are stored encrypted locally. Shared configuration exports do not include vault contents or keys. The project must be unlocked before restoring private values. |
| FR-07 | Preview and checks | Users can inspect the masked result and a summary of changes, unresolved findings, and selected validation results before export. A check is not marked passed if it could not run. |
| FR-08 | Export | Export produces a separate text, CSV, or XLSX copy within supported scope. It does not modify the original or automatically send the output elsewhere. |
| FR-09 | Restoration | Exact known aliases in pasted text, CSV, and the supported XLSX subset restore deterministically using the selected project's mappings. Recognisable unknown or malformed aliases and detected mapping conflicts are flagged without guessed substitutions. Removed or unrecognisably rewritten aliases cannot be reliably detected or restored. |
| FR-10 | Rule packs | Users can import, export, inspect, enable, and disable versioned declarative packs. Unsupported versions, missing required resources, and conflicting rules are visible. |
| FR-11 | Profiles | Users can create, edit, duplicate, save, and export profiles that select packs and override settings. Similar-file matching shows why a profile was suggested and flags structural changes. |
| FR-12 | Remember corrections | Users explicitly promote appropriate review changes into reusable rules. The app shows the future scope of a rule before saving it. One-file unmasking stays local to that file by default. |
| FR-13 | Rule provenance | Review shows which pack, profile, or file decision produced the effective action. Imported packs cannot silently override a user's current-file decision. |
| FR-14 | Offline resources | All required application, runtime, rule, and model resources can be supplied locally. First launch, detection, export, restart, and restoration work with networking unavailable. |
| FR-15 | Operational feedback | Long operations show progress and support cancellation. Parsing or detector failures produce actionable findings; they never silently produce an output labelled fully checked. |

## 7. Detection and transformation behaviour

### Detection strategy

Use a replaceable detection layer combining patterns, format checks where applicable, column headers, nearby labels, private dictionaries, and user rules. Evaluate pretrained local models for contextual Vietnamese names and addresses.

Initial entity categories are names, phone numbers, email addresses, identity numbers, bank account identifiers, and customer codes. Detection must be described in terms of tested cases; the application must not imply that every occurrence of a category can be found automatically.

For names, column labels, user selections, and dictionaries provide a baseline. Broader recognition in arbitrary Vietnamese prose may require an existing model. A rules-only implementation may satisfy the MVP only if it meets the agreed supported-workflow evaluation criteria. Model selection remains open; custom model training is not a dependency.

Numeric length alone is insufficient to identify a bank account or identity number. Use available context, distinguish identifiers from amounts and references, and surface ambiguity. Likewise, matching or similar names do not establish that two records belong to the same person. Entity grouping requires stronger identifiers or user confirmation.

### Transformations

- **Replace with an alias:** reversible through the local project mapping.
- **Keep:** retain a user-approved field needed for the task.
- **Omit:** exclude an unnecessary field from the exported copy; the original stays local.

Partial masking and date/amount generalisation are not required for the first release. They can be added as explicit transformations with their own utility checks later. Omitting content does not promise automatic reconstruction in an AI-generated result.

Alias consistency is scoped to a project. Generated aliases must be distinguishable across projects so a returned token cannot silently match a different project's mapping. Opening another project or importing a profile must not automatically reuse customer mappings. Any future sharing of mappings across projects requires a separate design.

## 8. File support and verification

The exact XLSX support matrix is an implementation-planning decision. It must be published and tested before release. The following behaviour is required regardless of the selected library:

- Process selected sheets and text outside the main table, including document headers.
- Preserve identifier representations, including leading zeros, within the supported input representation. Do not silently coerce identifiers into numbers.
- Define and test handling of formulas, dates, merged cells, formatting, hidden sheets/rows/columns, comments, workbook properties, and embedded content.
- Hidden or non-cell content must not bypass protection simply because it is absent from the main review table.
- Remove, process, or block unsupported sensitive content explicitly. Do not silently drop workbook features and claim preservation.
- Do not fetch external workbook resources or execute macros or untrusted embedded code.
- Handle CSV encoding, delimiters, quoting, and formula-like values explicitly so export does not introduce unintended spreadsheet execution.

For each workflow, users select the fields approved to remain and the properties to verify. Examples include row counts, monthly totals for retained amounts/dates, consistent account grouping, and mappings across related files.

These are specific integrity checks. Passing them does not establish that all analyses remain equivalent, that no sensitive information remains, or that an external AI's answer is correct. If a required field is omitted, the corresponding check must report that it cannot establish the property.

Restoration of pasted text, CSV, and the declared supported XLSX subset is required for the MVP. Only the precise XLSX feature matrix remains to be confirmed alongside file handling. Restoration changes exact known aliases; it must not overwrite the AI's calculations or infer deleted source records.

The app can flag recognisable malformed or unknown tokens and detected mapping conflicts. It cannot reliably identify aliases that an AI has removed or rewritten beyond recognition. A summary may legitimately omit source entities; any list of source aliases absent from the response is informational, not automatically an error.

## 9. Rule packs and profiles

### Concepts

| Object | Contents | Portability |
| --- | --- | --- |
| Rule pack | Identifier, version, description, language/domain tags, compatible schema/app range, declarative rules, required detector references, and permitted validation settings. | Importable/exportable; available application-wide. |
| Profile | Selected pack versions, workflow settings, header aliases, structural matching hints, transformations, and profile overrides. | Save, duplicate, and export with explicit dependencies. |
| File review state | Decisions about particular spans, cells, columns, or occurrences. | Saved in its project; not automatically a reusable pack. |
| Project vault | Original values, alias mappings, keys or protected key references, and private dictionaries. | Private local state; separate from shared configuration. |

### Matching and precedence

Profiles match headers and structure rather than fixed column letters or filenames alone. The app explains the match and shows unfamiliar or ambiguous fields. It must not confidently apply an old schema when a new file has changed meaning.

Effective precedence is: built-in defaults → selected packs → profile overrides → current-file decisions. Same-level pack conflicts must be reported and explicitly resolved; implementation must not depend on accidental import order. The exact conflict controls and match thresholds remain design decisions.

### Export and import requirements

- Packs are versioned, inspectable configuration data, with schema validation and bounded rule execution. They cannot contain arbitrary scripts, shell commands, network actions, or executable plugins.
- Shared exports omit customer-specific literals, private dictionaries, source snippets, vault contents, and restoration mappings by default. User-authored configuration can still contain sensitive text, so export includes a contents preview.
- Exported profiles list their pack dependencies. Dependencies must either be included where permitted or supplied locally; missing required dependencies cannot be silently ignored.
- Referenced model resources are distributed separately from ordinary settings packs. Import cannot initiate an internet download; missing resources must be supplied locally.
- Imports do not silently replace an installed version or activate new global behaviour. Users can inspect imported versions and choose them in a profile.
- Private encrypted project backup/recovery is a separate concern from sharing a rule pack; its MVP extent remains open.

## 10. Offline operation, privacy, and usability

### Offline contract

The MVP application and its bundled processing components initiate no external network requests during supported operations. There are no account requirements, online licence checks, telemetry, cloud inference, remote assets, background update requests, or runtime model downloads. Users obtain optional packs, updates, and model resources outside the app and import them locally.

Installation prerequisites must be bundled or distributable through an offline installation procedure. A computer that has never been online must be able to complete the supported workflow with locally supplied resources.

The app itself does not submit material to AI. Export is a deliberate local file or copy action. Any later external sharing happens separately under the user's control.

### Local data handling

- Keep source files unchanged and write separate outputs.
- Encrypt persistent restoration mappings and private dictionaries using established cryptographic components.
- Define vault unlocking, key handling, retention, deletion, and recovery before implementation. Do not invent a proprietary encryption scheme.
- Keep raw personal values, mappings, source snippets, and secrets out of routine logs and diagnostics.
- Minimise sensitive temporary files and document recovery/cleanup behaviour after cancellation or crashes.
- Expose private data only when required for local review or restoration. Do not include it in shared configuration by default.

Reversible masking is pseudonymisation. Retained transaction facts and contextual details can still be sensitive or identify someone. The product must describe what it changed and checked without promising anonymity, universal compliance, or permission to upload the result.

### Usability and performance

The app must work on ordinary employee laptops without requiring a dedicated GPU. The reference hardware, minimum OS versions, installer size, memory budget, and processing-time targets remain to be measured and agreed.

Benchmark cold start, warm detection, export, and restoration separately for text and representative spreadsheets. Keep review responsive during processing, bound expensive rules, and allow cancellation. Use clear Vietnamese labels, keyboard-accessible controls, and status cues that do not rely only on colour. English UI support is a later scope decision.

## 11. Product architecture boundaries

Technology selection should prioritise development speed, high-quality UI/UX, cross-platform support, lightweight distribution, and responsive processing. A possible future mobile mini version should be considered when separating portable rules, profiles, and business logic from desktop-specific file handling and interfaces. Mobile is not an MVP requirement and does not require feature parity with the desktop application.

These are responsibilities, not technology selections:

1. **Desktop experience:** projects, import, review, profiles, previews, and export.
2. **Format adapters:** parsing and writing supported formats, source locations, and compatibility findings.
3. **Detection providers:** rules, dictionaries, and optional local models returning findings through a common contract.
4. **Policy and transformation engine:** effective configuration, masking decisions, alias scope, and deterministic transformations.
5. **Private project storage:** review state and encrypted restoration mappings.
6. **Validation:** supported integrity checks, unresolved findings, and output summaries.
7. **Pack management:** versioning, compatibility, import/export, and resource references.

User-configurable rule packs are distinct from developer-maintained software modules. Adding a future file adapter or detector should not require replacing the review workflow or mapping system. Proven parsers, detectors, storage, and cryptographic libraries should be reused where suitable.

No commitment has been made to Prompt Anonymizer, Presidio, OpenMed, any model, frontend framework, language, database, or desktop runtime. Their selection follows this PRD.

## 12. Pilot and acceptance plan

### Pilot design

- Recruit 3–5 Vietnamese banking practitioners and cover at least three concrete daily workflows, including structured data and unstructured text. The two starter profiles are the initial product flows; an additional representative task tests generality.
- Include synthetic cases and appropriately authorised local examples. Keep confidential examples on approved local machines; sharing a rule pack must not share the evaluation data.
- Create reviewed labels for important identifiers and expected output properties. Separate development examples from held-out evaluation cases.
- Compare manual preparation and the strongest suitable existing baseline using equivalent tasks and retained-information requirements.
- Record misses by entity type, unnecessary masking, review time, grouping errors, export defects, restoration failures, and performance. Do not hide critical failures behind one aggregate accuracy score.

### Proposed success target

Aim for at least **50% lower median preparation/review time** than the best tested baseline, without increasing critical-identifier misses on the held-out cases. This is a proposed pilot target, not an achieved result or a universal privacy guarantee. Final thresholds, sample sizes, and critical categories must be set before scoring.

Release evaluation must also demonstrate:

| Area | Required evidence |
| --- | --- |
| Disconnected operation | Clean offline installation, first launch, restart, masking, pack import, export, and restoration succeed with networking disabled. Instrumentation checks attempted as well as successful external requests from the application and its bundled components; neither is accepted. |
| Restoration | Unchanged known aliases restore correctly across pasted-text, CSV, and supported XLSX fixtures, saved projects, and restarts. Recognisable unknown/malformed tokens, mapping conflicts, and wrong-project cases are flagged without guessed substitutions. Tests document that removed or unrecognisably rewritten aliases cannot be reliably recovered or detected. |
| Output integrity | Originals remain unchanged. Declared workflow properties pass, or export clearly reports why they cannot be established. No silent unsupported-feature loss is accepted. |
| Reusable configuration | A saved profile works on a structurally matching new file; reordered columns work; changed or ambiguous structures are surfaced. |
| Sharing separation | Shared configuration export contains none of the project's vault data, keys, source snippets, or excluded private dictionaries/literals. |
| Conflict handling | Pack conflicts, incompatible versions, and missing resources produce visible outcomes with deterministic resolution. |
| Platform support | The core workflow passes on every OS/architecture listed as supported for the release. |
| Performance | Measurements meet the agreed reference-machine budgets without a required GPU. |

If the prototype does not demonstrate a useful advantage, narrow the workflow, improve the relevant pack, or extend an existing product instead of committing to a broad duplicate application.

## 13. Delivery sequence

1. Review this PRD and choose the technology stack for OfflineMask using the priorities above.
2. Define the first fixtures, supported-file matrix, offline resource plan, vault lifecycle, and measurable acceptance thresholds.
3. Build a complete text and simple-table flow: import, review, alias, export, save/reopen, and restore.
4. Add pack/profile management and the remember-for-similar-files flow.
5. Complete supported XLSX handling, output checks, and both starter profiles. Benchmark candidate local detectors against the rules baseline.
6. Run the pilot, correct failures, verify all supported platforms, and decide whether the proposed advantage is demonstrated.

No delivery dates or effort estimates are committed in this document.

## 14. Open decisions

| Decision | When needed |
| --- | --- |
| Technology stack and third-party licences | Next technical selection; OfflineMask is the selected product name. |
| Detection providers and whether a pretrained model is necessary | After evaluating the initial corpus and supported cases. |
| Exact XLSX feature subset for import, export, and restoration | Before implementing file adapters; pasted text and CSV restoration are already required. |
| Vault unlock, retention, deletion, recovery, and private backup scope | Before implementing persistent sensitive storage. |
| Profile matching thresholds and same-level pack conflict controls | Before implementing automatic profile suggestions. |
| Pack schema, dependency packaging, and distribution/update details | Before implementing portable configuration. |
| Supported OS versions/architectures and hardware/performance budgets | Before release planning and benchmark acceptance. |
| Pilot participants, third workflow, baseline, dataset size, and thresholds | Before pilot scoring. |

## 15. Research references

Sources support the competitive context and component evaluation only; they do not select a dependency or establish independent performance results.

- [Omit product capabilities](https://omitsys.com/) and [detection languages/offline installation](https://omitsys.com/download/).
- [LocalMask coverage](https://localmask.com/en) and [workflow documentation](https://localmask.com/en/docs).
- [Prompt Anonymizer capabilities and language backends](https://github.com/akazah/prompt-anonymizer), [text-based CLI input](https://github.com/akazah/prompt-anonymizer/blob/main/src/prompt_anonymizer/cli.py), and [published evaluation scope](https://github.com/akazah/prompt-anonymizer/blob/main/docs/EVAL.md).
- [Presidio detection and transformation architecture](https://github.com/data-privacy-stack/presidio/blob/main/docs/text_anonymization.md).
- [OpenMed language support](https://github.com/maziyarpanahi/openmed/blob/master/docs/languages.md) and [offline configuration](https://github.com/maziyarpanahi/openmed/blob/master/docs/configuration.md).
