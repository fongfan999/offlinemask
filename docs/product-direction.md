# Product direction and accepted boilerplate

Recorded: 9 September 2026. These notes capture the owner's feedback and guide future implementation. Later explicit feedback can revise this direction.

## Current acceptance

On 9 September 2026, after the homepage refinements below, the owner confirmed:

> looks good, document and commit it

The current homepage is accepted. Preserve this design for subsequent page work:

- Existing shield branding and a concise hero explaining local masking before sharing with AI.
- Original → masked copy → manual copying to AI illustration, with matching arrows. Use the owner-approved public name “Phan Thái Phong” and a fictional amount; omit the restoration note and visible example caption.
- A prominent “Chọn nội dung để bắt đầu” heading above Văn bản and Bảng tính cards; group Excel and CSV under Bảng tính.
- A quiet, non-interactive “Định dạng sắp có” list for PDF, Word, and images.
- Reopenable sessions in the sidebar, with the website link and version `1.0.0` anchored below history. Omit the creator credit and redundant new-session button.
- Responsive glass styling and a restrained keyboard-only focus indicator.

This acceptance covers the homepage presentation, not completion of production import, detection, encrypted history, or restoration. Restoration remains required MVP scope. The website landing page will be built separately later. Verification is recorded in [review design notes](review-design.md).

The dated feedback sections below preserve design history; this accepted state supersedes earlier conflicting presentation choices.

## Earlier boilerplate acceptance

> It's not perfect, but I think it's good enough for boilerplate, I'll feedback every page later

The current interface is accepted as the boilerplate baseline. This does not mean every page is final, that the design has been validated with users, or that the MVP is complete. Preserve this baseline while the owner supplies page-by-page feedback. Apply future feedback to the relevant page and update these notes when a shared decision changes. Do not initiate another broad visual redesign or reopen accepted choices without a new request or concrete implementation problem. Necessary bug fixes and explicitly requested features can proceed.

## Requirements to carry forward

- **Straightforward use:** the earlier dense three-panel review experience felt overwhelming. Keep the primary workflow obvious and secondary controls tucked away until needed. Do not add dashboards, review gates, dialogs, or technical controls without a clear user need.
- **Visual direction:** since 9 October 2026 the owner's personal brand theme replaces the earlier blue/white liquid glass: warm paper, ink, one cobalt accent, mono eyebrows, italic-serif emphasis, light and dark following the system. See the dated section below and [Decision 0052](decisions/0052-brand-theme-and-restoration.md). The owner explicitly dislikes purple/lavender. The earlier dark-green choice was not grounded in the owner's preference; do not restore it as the primary color.
- **Surface implementation (historical glass note):** consistency and speed matter. The current approach uses shared CSS tokens and one glass surface rule, with fallbacks. No dedicated glass library was requested or installed. Evaluate dependencies against demonstrated needs and measured behavior; do not claim that a library or CSS alone guarantees performance.
- **Home and navigation:** provide Text and Excel choices on the home page and left sidebar. Other file formats should be visibly coming soon until implemented.
- **Sessions:** each masking/redaction conversion should create a distinct session, comparable to conversation history in chat apps. Users must be able to return to earlier conversions and their choices. Starting a new conversion must not overwrite an earlier one.
- **Tooling and documentation:** use mise for tool versions. Study current official library/framework documentation with Context7 when doing library-specific work. Record scaffold provenance, consequential dependency choices, and implementation limits.
- **Source availability:** on 8 October 2026, the owner selected the O’Saasy License Agreement, superseding the earlier pending-license direction. Favor standard, maintainable patterns, reproducible setup, shared styling, clear contribution guidance, and documented dependencies. See [Decision 0050](decisions/0050-osaasy-license.md) for remaining publication work.

## Accepted prototype versus unfinished product

The committed baseline is an official Tauri Vue/TypeScript scaffold with custom UI, not a downloaded liquid-glass UI template. Excel and legacy text samples operate on public synthetic fixtures. Text now also accepts real input with library-backed offline detection and temporary in-memory sessions; see [text processing decision](decisions/0004-text-processing.md). Sample session history persists fixture references and mask/keep choices only. Excel copies tab-separated sample output; it does not import or export workbook files.

Broader detection validation, Excel/file adapters, encrypted private history, restoration, cross-platform verification, and performance targets remain unfinished. Boilerplate acceptance must not be presented as acceptance or completion of those capabilities. Real private data must not be added to the sample localStorage path.

## Where future changes belong

- [PRD](../PRD.md): product requirements and remaining MVP work.
- [Workspace and glass decision](decisions/0002-workspace-and-glass.md): current implementation rationale and storage boundary.
- [Review design notes](review-design.md): actual interaction and verification evidence.
- [Contribution guide](../CONTRIBUTING.md): reproducible setup and engineering conventions.

Future page feedback should record the page, requested change, and any shared decision it supersedes. Do not invent page requirements before that feedback arrives.

## Home-page feedback — 9 September 2026

- Remove the redundant sidebar “Phiên mới” button (and its plus/pencil pair); users start from Text or Excel, and reopen existing conversions from history. Keep the new-session action within an existing conversion.
- Remove vague workspace/privacy slogans, sidebar storage/account claims, card sample-exploration footers, and home-page history/prototype explanations. Keep sample labels and current capability limits where the user enters the sample editor.
- Use “ẩn thông tin” in place of “che” in visible masking labels. Keep the home heading and format descriptions short.
- Group CSV within the Excel entry point. Only PDF, Word, and images remain separate coming-soon formats. This updates navigation grouping; CSV/XLSX import and export are still unfinished.
- Initially replaced the decorative shield with unDraw “Private Data”; the subsequent hero feedback below supersedes this choice.
- The footer displays only the app version, starting at `1.0.0`, read from package metadata. Keep frontend/native versions aligned. This owner-selected version does not imply production readiness.

The accepted glass styling, Text/Excel entry points, and independent, reopenable sample sessions remain the baseline.

## Home hero refinement — 9 September 2026

The owner rejected the generic character illustration and requested a clearer presentation of the product’s core feature. Replace it with an original before/after document illustration: a synthetic name becomes an alias while the amount stays readable. The headline connects masking to sharing with AI; one sentence explains aliases and offline use. Keep the illustration visibly labelled as an example, with sample-only capability limits still in the editor. Do not advertise unfinished restoration or imply automatic AI submission, guaranteed anonymity, or general file compatibility.

The visual is implemented as static HTML/CSS with existing icons, preserving the blue/white glass palette and Text/Excel cards. No third-party illustration or new dependency is needed. See [artwork notes](third-party-assets.md).

## Format selection polish — 9 September 2026

The owner accepted the overall home layout. Use “Bảng tính” (Spreadsheet) for the category in the sidebar, home card, workspace breadcrumb, and editor title; Excel and CSV are formats within this category. Keep the internal `excel` identifier for compatibility with existing sample history. Add “Chọn nội dung để bắt đầu” as a visible section heading above the two entry cards, associated with the section for assistive technology. Refine spacing and give cards the same blue border emphasis on hover and keyboard focus. Preserve the accepted hero and illustration.

## Branding, website, and workflow — 9 September 2026

Add the existing shield mark above the headline and a discreet “Phát triển bởi Phan Thái Phong” credit in the footer beside the product website. Keep the public synthetic example separate from authorship. Show three concise steps: mask in OfflineMask, manually copy to an AI tool (ChatGPT, Gemini, Claude as examples), and optionally return to restore. Restoration is explicitly marked “Sắp có”; no restore control or provider integration is implied.

Use a quieter 2px keyboard-only focus outline and remove the extra focus border treatment on cards. Retain keyboard navigation and a visible focus indicator. Short desktop windows use compact format cards to accommodate the added workflow without crowding the hero.

The footer links to `https://offlinemask.com/` in the default browser on an explicit click, with no user content attached. This external website action is separate from offline processing. See [website link decision](decisions/0003-product-website-link.md).

The owner confirmed the `offlinemask.com` landing page will be built later. Keep the intended link; building, deploying, or repairing that site is outside this task.

## Unified workflow and anchored product links — 9 September 2026

Move website, creator credit, version, and website-opening feedback into the bottom of the sticky sidebar. Session history scrolls independently above this footer; the same footer is available within the narrow navigation drawer.

Merge the separate numbered steps into the illustration: original → masked copy → manually copy to the user's AI, with an optional return-to-OfflineMask restoration note beneath. The AI panel sits immediately to the right of the masked-copy panel on desktop. Remove the restoration “Sắp có” badge: restoration is required MVP scope, as already specified in the PRD. This corrects the scope presentation without claiming the prototype restoration implementation is complete; retain current capability limits inside the sample editor. Only the genuinely deferred file categories retain coming-soon labels.

## Illustration details — 9 September 2026

At the owner's explicit request, use “Phan Thái Phong” in the homepage illustration's original-name field and remove the sidebar creator credit. This is a public illustrative example with a fictional amount, not a real transaction or a change to persisted editor fixtures. Keep the website and version anchored in the sidebar.

Use identical, vertically centered forward arrows with equal spacing between all three panels; remove the redundant shield from the first connector. Simplify the return note to a left arrow and “Khôi phục bản gốc · Tùy chọn”, without the divider or reset icon. Remove the visible “Ví dụ minh họa” caption; retain the accessible diagram description and capability limits in the sample editor.

## Home selection hierarchy — 9 September 2026

Remove the restoration note beneath the illustration following the owner's feedback that it still feels awkward. The diagram now ends at manually copying to AI; restoration remains required MVP scope in the PRD. Increase the start heading from 16px to 22px with stronger weight and clear separation from the illustration. Present the deferred PDF, Word, and image formats as a readable, non-interactive list under “Định dạng sắp có”, separated from the available format cards by a subtle rule. Remove the tiny outlined coming-soon badge and stack the label above the list on phones.

## Text processing — 9 September 2026

The owner requested the core text flow: type/paste, process, and preview. The text page now starts empty with optional sample input and uses local libraries and optional models to create distinct temporary sessions. Preserve the existing glass layout, original/preview switch, expandable choices, and copy action. Real text never enters sample history storage. The UI explains detection gaps and loss of private sessions on close/reload; encrypted persistence and restoration remain unfinished. See [Decision 0004](decisions/0004-text-processing.md) for session boundaries; [Decision 0005](decisions/0005-library-text-detection.md) records libraries, models, and limits.

### Optional models and category choices — 9 September 2026

The owner revised the distribution requirement: keep the default app small; download models from Settings only when wanted. The owner also requested checkboxes for what to hide, showing which choices require missing models. The Text page defaults to available email/phone/labelled-identifier detection on a fresh install. Name, address, and other contextual categories remain visible and selectable, with a model requirement and a direct Settings route. A missing selected model blocks that run; no silent fallback. Draft text and choices survive navigation to Settings. Preview sessions record their selected scope and identify categories not checked. Settings shows the optional pack size, progress, pause/resume/retry, and installed state. Preserve offline processing and RAM-only private sessions. See [Decision 0006](decisions/0006-optional-models.md).

## Text-page simplification — 10 September 2026

The owner's guiding principle is **less is more**, especially for nontechnical users. Remove the temporary-session badge, the local-processing eyebrow, the general category/rule explanation, and the original-preservation footer from text entry. Do not replace those with other reassuring slogans. Available choices need no status subtitle. Missing capabilities say “Cần tải thêm”, and the download banner appears only when at least one selected choice needs the missing pack. User-facing download controls call it a “gói nhận diện”; technical model provenance belongs under expandable package details.

Keep enabled primary actions a strong solid blue and distinguish disabled buttons with a muted neutral fill. Text entry ends at the primary action, without the former session-routing explanation or long prototype paragraph. The result screen retains its useful unchecked-category scope, review reminder, and one plain statement: “Đóng ứng dụng sẽ xóa phiên này.” Sample-only Excel labels remain. This supersedes the more verbose labels and always-visible download notice in the previous entry.

## Settings simplification — 10 September 2026

Apply the same “less is more” principle to the optional download page. Use one card: package title, one sentence describing added categories, download size, and the relevant action. Remove the page subtitle, decorative package icon, repeated benefits/checklist, “not bundled” explanation, offline reassurance, and separate built-in-features card. Omit “Chưa tải” when the download action already makes that clear. Keep meaningful progress, pause/retry, and installed states. Shorten the initial action to “Tải về”, retain the top return-to-text control, and avoid a duplicate return action inside the installed card. “Thông tin gói” stays collapsed by default and contains concise source/license attribution.

## Manual updates and file installation — 10 September 2026

The owner requires **no automatic Internet update checks**. One general “Kiểm tra cập nhật” action belongs outside the recognition-pack card and will check both the app and all supported recognition packs when the release service is implemented. Never tie this check to startup, Settings navigation, a timer, or the existing local model-status polling. App update support is explicitly deferred. Do not report “up to date” without a real successful check of every supported component.

The owner also approved installation from a downloaded file, with a future offlinemask.com download page. For now, the general update button and file-install entry are clearly marked “Sắp có” and disabled. The website reference is a non-navigating download-page placeholder, not a fabricated URL. Keep file-install instructions under a secondary disclosure. These placeholders do not initiate any network requests, open file dialogs, install files, or change the working pack downloader.

## Settings polish and shared status badge — 10 September 2026

Remove the top return-to-text button; the sidebar provides navigation. Use a deeper blue with a subtle gradient for shared primary actions, superseding the earlier solid cyan-blue treatment. Use one reusable “Sắp có” pill badge for Settings placeholders and the homepage's deferred-format group; keep the latter non-interactive. This supersedes the earlier plain-text coming-soon treatment.

At the owner's request, explain the manual update policy once in Settings: OfflineMask does not automatically check through the Internet; users initiate checks for both the application and recognition packs. Keep the future update and file-install actions disabled, with their badges, until implemented. Avoid spreading this explanation across the text workflow.

## Text review reliability — 10 September 2026

The owner asked to prioritize reliability and trust. Preserve the current pack while strengthening verified source positions. Add one contextual manual action to text review: select missed text in either view, then “Ẩn phần đã chọn.” Keep the hint short, reveal the button only for a meaningful selection, and offer undo for the last correction. Corrections affect the selected occurrence and remain in the temporary session. Do not imply that manual correction or a passing integration test establishes complete detection. See [Decision 0007](decisions/0007-text-positioning-and-manual-review.md).

## Vietnamese pack selection — 11 September 2026

The owner confirmed that users should see one Vietnamese recognition pack and challenged the two-model implementation as a final solution. The requested comparison is complete: both current checkpoints individually and together fail the existing reliability criteria on fresh synthetic cases with native and WASM execution. See [Decision 0010](decisions/0010-vietnamese-model-selection.md). Keep the simple optional-pack experience and manual-only updates. Prefer a single primary detector supported by local rules, but do not present either current checkpoint or their pair as release-selected. The existing development installation remains intact; no replacement model or native production migration is approved by this evaluation.

The owner subsequently emphasized that this detector is the foundation for Excel, images, PDFs and future formats, and requested deeper model selection before calling the foundation complete. Preserve that priority. The [shared-core audit and proposed evaluation](evaluations/shared-detection-core-plan.md) separates model quality, common processing policy and format extraction/source mapping. This is a proposed evaluation sequence, not approval of a replacement checkpoint or an implemented file workflow.

## No tracking for detection improvement — 14 September 2026

The owner reiterated that OfflineMask must not track users or collect content to improve detection. No analytics, correction uploads, automatic crash reports containing input, or background network feedback should be added. All current quality evaluations use synthetic developer fixtures processed locally. Those measurements are reproducible evidence about the fixtures, while actual usage patterns and real-world accuracy remain assumptions. Preserve manual-only downloads and future general update checks, and keep private input and corrections out of persistence and evaluation datasets.

## Shared detection reliability — 15 September 2026

The owner asked us to implement the strongest practical reliability improvements after the broader challenge. Preserve the six choices and current layout. Add bounded labelled passport/tax recognition to the existing banking option and reflect it in its secondary tooltip; keep card information under “other.” Improve complete credentials and address boundaries in the shared policy without adding user-facing technical controls, changing the pack, or collecting data. [Decision 0016](decisions/0016-complete-values-and-field-meaning.md) records the supported bounds and evaluation. Passing development regressions does not finalize the contextual model or qualify future file formats.

## Contextual field reliability — 17 September 2026

The owner approved the next targeted shared-core improvements: IPv6, written birth dates, organization boundaries and less masking of ordinary text. Keep these changes under the existing categories and pack requirements. Use a small IP parser and bounded field semantics; do not expand the UI or infer a final model decision from improved observed fixtures. [Decision 0017](decisions/0017-contextual-fields.md) records the implementation, evidence and remaining release work.

## Organization scope confirmation — 19 September 2026

The owner corrected the earlier case-review response and explicitly confirmed that organization names should be hidden. Preserve organizations within the existing contextual “Thông tin riêng tư khác” scope and respect the user's selected categories. Do not implement the assistant's earlier suggestion to leave organizations visible by default or introduce a separate organization choice based on that suggestion. The full organization name, including its legal prefix when part of the name, is expected in reviewed example 8. Customer identifiers remain in scope as separately confirmed. See the [corrected review](evaluations/single-model-owner-review-v2.md); model qualification remains unresolved.

## Quality-first v1 model selection — 19 September 2026

The owner reaffirmed automatic name, address and organization detection as a release requirement; a manual-only or assisted beta cannot replace it. Choose the model(s) with the strongest measured detection coverage for v1, with specialist AI engineering expected later. A larger optional recognition pack is acceptable to investigate; the default installer stays small, one Vietnamese pack remains the UI, and all downloads/updates are manual. Do not infer permission for cloud processing, telemetry, custom training, altered labels or reduced quality claims.

The new [coverage-first comparison](evaluations/quality-first-v1/README.md) selects Underthesea + BigMed + mSuperClinical as the integration target, with model findings restricted to contextual categories and structured fields handled by shared rules. This is a measured candidate selection, not owner approval of its remaining misses/excess masking, desktop integration, or public release. The existing app pack remains unchanged until the selected assets and runtime are integrated and verified. [Decision 0037](decisions/0037-quality-first-v1-candidate.md) preserves the exact tradeoffs and remaining checks.

## Conditional organization deferral — 20 September 2026

The owner is willing to defer automatic organization recognition from v1 if the smaller GLiNER2-based candidate performs well on the remaining required fields. This supersedes the earlier mandatory-organization release requirement for that evaluation. Names, addresses, customer identifiers and the other retained capabilities still require qualification. Preserve organization annotations and report those results separately; do not rewrite earlier evidence or claim that excluding a category improves full-scope accuracy. If selected, describe the reduced supported scope clearly and retain manual selection. This is conditional scope approval, not model selection or a change to the installed pack. See [Decision 0038](decisions/0038-conditional-v1-organization-deferral.md).

The subsequent [smaller GLiNER2 evaluation](evaluations/gliner2-compact-v1/README.md) completes local testing of the ~670 MB PII Engineer INT8 candidate. It runs successfully with the tested compatible runtime, but misses retained name/location requirements and fails unnecessary-masking checks even when organizations are excluded. [Decision 0039](decisions/0039-gliner2-compact-evaluation.md) records that this configuration is not selected to replace the pack. Preserve the smaller-download goal; this result does not automatically reapprove the 2.01 GB ensemble or narrow address/location scope.

## Owner-selected v1 pair and compressed downloads — 20 September 2026

The owner selected **Underthesea INT8 + mSuperClinical INT8** for v1 and requested smaller downloads that install locally. This replaces the earlier three-model integration target; keep one optional Vietnamese recognition pack. Measure lossless compression of the exact tested files before promising transfer savings, and show actual download and installed sizes. Use a simple download/install/ready flow with resumable transfers and one-time verified extraction. Preserve the pair's existing organization behavior, shared rules and offline/manual-update boundary. Model selection does not mark failed quality checks as passed or mean the production manifest has changed. See [Decision 0040](decisions/0040-v1-pair-and-compressed-download.md).

## Compressed optional pack — 20 September 2026

Show transfer size and installed size separately when they differ. Downloading and installing are distinct progress stages; only the complete, verified pack is ready. Preserve pause/resume and the one-pack interface. Public R2 assets and the native installer are recorded in [Decision 0041](decisions/0041-compressed-pack-installer-and-r2.md). The 712 MB selected-pair size must not be shown for the still-active legacy model manifest; switch the inference adapter and pack together after validation.

## Selected pair connected — 20 September 2026

[Decision 0042](decisions/0042-production-recognition-pair.md) connects the production detector to the selected Underthesea + mSuperClinical pack. Settings now shows the verified 712 MB transfer and 1.14 GB installed size. Preserve one recognition pack, explicit downloading, original text and manual review. Integration parity does not imply perfect detection or an independently validated banking accuracy rate.

## 21 September — Text cancellation recovery

Explicit cancellation after processing starts now keeps the loaded recognition pack available for retry, with request-ID isolation and a five-second hard-stop fallback. Loading cancellation and navigation/unmount retain hard termination. No model or masking-policy change, telemetry, or persistent private-input storage was added. The packaged Mac trial measured a 1.721-second retry versus an earlier 11.680-second hard reset/reload. Cold startup and an observed WebKit reload during a forced-reset test remain qualification work; see [Decision 0043](decisions/0043-cancellation-recovery.md).

## 21 September — Prepare installed recognition in the background

At the owner's request, start loading the verified installed pack as soon as it is ready, including after a manually requested installation. Masking joins that same load, so time spent typing or navigating reduces the remaining wait. Do not download missing packs, check updates, send input, or run document inference during preparation. Keep the UI unchanged and avoid repeated automatic load retries after failure. See [Decision 0044](decisions/0044-background-recognition-loading.md).

## 21 September — Serialized model release and reload

Resetting now explicitly disposes model sessions before a queued request reloads them in the same worker. Closing the app still destroys its worker immediately. This follows a reproduced web-view restart during repeated replacement-worker loads. Six subsequent normal reloads across two packaged trials completed; the full stress run also passed cancellation and the 50,000-character limit. Do not imply release readiness: sampled memory reached about 5.1 GiB and the longest synthetic case took 224.6 seconds. See [Decision 0045](decisions/0045-release-model-sessions-before-reload.md).

## 21 September — Selected-pair native runtime comparison

Keep the selected models and one-pack experience fixed while qualifying native inference to address desktop runtime cost. The developer comparison matched all 398 saved outcomes and reduced the identical long fixture from 224.6 seconds in the earlier packaged WASM run to 23.9 seconds in the native harness. This is not yet a packaged native result or a production backend switch. Memory and desktop lifecycle still require qualification; see [Decision 0046](decisions/0046-selected-pair-native-runtime.md).

## 21 September — Packaged native runtime qualification

The selected pair now has an isolated native desktop test path. It matched all 398 saved previews, completed the longest synthetic text in 18.8 seconds, and returned a short result in 256 ms after eight seconds of background preparation. The normal text/preview UI smoke checks passed. Keep the production backend unchanged while native crash/hang recovery, full offline GUI validation and distribution/platform qualification remain open. See [Decision 0047](decisions/0047-packaged-native-recognition.md). This changes runtime evidence, not model selection or accuracy claims.

## 21 September — Native failure containment

Keep the selected recognition pair fixed while qualifying a separate native helper process. The opt-in packaged helper matched all 398 saved previews and recovered from deliberately stopped/killed helpers without losing drafts or existing sessions. Automatic internet activity and silent document retries remain excluded. Keep the default backend unchanged until offline GUI and distribution/platform qualification are complete. See [Decision 0048](decisions/0048-isolate-native-recognition.md).

## 9 October — Structural refactor without visual change

The owner reviewed the whole project and asked for every finding to be applied: "everything, as long as we won't break the app, the app is simply to mask PII data." The frontend shell was split into composables and page components, pack status is pushed from the native layer instead of polled, the duplicated runtime binary was removed from the bundle, the native download tolerates slow connections, and Prettier/ESLint/CI were added. Markup, CSS classes, copy and the accepted glass styling are unchanged.

Two small behavior changes are intentional: a detection run keeps going while the user navigates and its session appears in the sidebar when done, and an open session offers "Xóa phiên" beside "Phiên mới" so private text can be dropped without quitting. Fingerprinted detection sources and frozen evaluation scripts were left untouched. See [Decision 0051](decisions/0051-shell-refactor-and-tooling.md) for details and the checks that remain for a packaged run.

## 9 October — Personal brand theme and in-session restoration

The owner asked for product improvements at the assistant's discretion and for the app theme to follow their personal brand at wotdafong.dev ("Wot Da Fong?"). The theme now uses that brand's tokens: warm paper, ink, one cobalt accent, mono uppercase eyebrows, an italic-serif second line in the hero, pill buttons, flat sheets with a hard offset shadow, and a dark scheme that follows the system. Layout, copy and the six detection choices are unchanged; the `.glass` class name stays as the sheet rule. The homepage's AI panel is drawn as the brand's tilted sticky note. The personal **P?!** mark is Phong Phan's own and is not used as the product logo.

Product changes in the same pass:

- **Khôi phục bản gốc từ phản hồi của AI.** An open private text session has a collapsed panel where the AI's reply is pasted; exact aliases of that session are replaced with the original values on the device and the result can be copied. Alias-shaped tokens from another session are listed and left untouched; nothing is guessed (PRD FR-09). This is RAM-only restoration within the session, not the encrypted vault; closing the app still clears everything.
- **Recognisable sessions.** Private sessions are listed by the first line of their masked copy instead of "Văn bản #1"; the number, time and "Tạm thời" move to the subtitle. Sample sessions keep their names.
- **⌘/Ctrl + Enter** in the draft runs the primary action.

This supersedes the earlier blue/white glass acceptance for presentation only. Detection behavior, offline boundaries and manual-only downloads are unchanged.

## 9 October — Product mark and copy

The owner asked for a logo and allowed copy changes. The mark is **an alias**: two inked brackets around a cobalt dash, `[—]`, the shape the product produces when it hides a value. It replaces the scaffold shield everywhere: sidebar tile, hero tile, favicon and the generated platform icons (`brand/tile-cobalt.svg` → `pnpm tauri icon`). The wordmark sets **Offline** in ink and **Mask** in cobalt. Rules and files are in [brand/README.md](../brand/README.md); the personal P?! mark stays Phong Phan's and is not the app logo.

Copy: the hero subline now names what gets hidden ("Tên, số tài khoản, số điện thoại… được thay bằng bí danh ngay trên máy bạn. Không cần Internet."), and an open private session's subtitle walks the loop ("Đọc lại bản đã ẩn, sao chép sang AI, rồi dán phản hồi bên dưới để khôi phục."). The page description meta follows the hero. All other copy is unchanged. See [Decision 0053](decisions/0053-product-mark.md).
