# Product direction and accepted boilerplate

Recorded: 9 September 2026. These notes capture the owner's feedback and guide future implementation. Later explicit feedback can revise this direction.

## Current acceptance

On 9 September 2026, after the homepage refinements below, the owner confirmed:

> looks good, document and commit it

The current homepage is accepted. Preserve this design for subsequent page work:

- Existing shield branding and a concise hero explaining local masking before sharing with AI.
- Original → masked copy → manual copying to AI illustration, with matching arrows. Use the owner-approved public name “Phong Phan” (since 11 October 2026, matching wotdafong.dev; earlier “Phan Thái Phong”) and a fictional amount; omit the restoration note and visible example caption.
- A prominent “Chọn nội dung để bắt đầu” heading above Văn bản and Bảng tính cards; group Excel and CSV under Bảng tính.
- A quiet, non-interactive “Định dạng sắp có” list for PDF, Word, and images.
- Reopenable sessions in the sidebar, with the website link and version `1.0.0` anchored below history. Omit the creator credit and redundant new-session button.
- Responsive glass styling and a restrained keyboard-only focus indicator.

This acceptance covers the homepage presentation, not completion of production import, detection, encrypted history, or restoration. Restoration remains required MVP scope. The website landing page will be built separately later. Verification of each later change is recorded in its decision under `decisions/`.

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
- **Accessibility and controls:** native buttons, labelled text fields and checkboxes, pressed/expanded states, a visible keyboard focus indicator and live copy feedback. Small-window navigation moves focus into the sidebar, makes the background inert and restores the trigger's focus on Escape; choosing a destination closes the drawer and focuses the page heading. Wide tables scroll inside their panel.
- **Tooling and documentation:** use mise for tool versions. Study current official library/framework documentation with Context7 when doing library-specific work. Record scaffold provenance, consequential dependency choices, and implementation limits.
- **Source availability:** on 8 October 2026, the owner selected the O’Saasy License Agreement, superseding the earlier pending-license direction. Favor standard, maintainable patterns, reproducible setup, shared styling, clear contribution guidance, and documented dependencies. See [Decision 0050](decisions/0050-osaasy-license.md) for remaining publication work.

## Accepted prototype versus unfinished product

The committed baseline is an official Tauri Vue/TypeScript scaffold with custom UI, not a downloaded liquid-glass UI template. Excel and legacy text samples operate on public synthetic fixtures. Text now also accepts real input with library-backed offline detection and temporary in-memory sessions; see [text processing decision](decisions/0004-text-processing.md). Sample session history persists fixture references and mask/keep choices only. Excel copies tab-separated sample output; it does not import or export workbook files.

Broader detection validation, Excel/file adapters, encrypted private history, restoration, cross-platform verification, and performance targets remain unfinished. Boilerplate acceptance must not be presented as acceptance or completion of those capabilities. Real private data must not be added to the sample localStorage path.

## Where future changes belong

- [PRD](../PRD.md): product requirements and remaining MVP work.
- [Workspace and glass decision](decisions/0002-workspace-and-glass.md): current implementation rationale and storage boundary.
- [Decisions](decisions/): rationale and verification for each change, numbered in order.
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

The visual is implemented as static HTML/CSS with existing icons, preserving the blue/white glass palette and Text/Excel cards. No third-party illustration or new dependency is needed; the briefly evaluated unDraw image is not part of the bundle.

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

## Later direction — 11 September to 11 October 2026

From here on every change has its own decision with rationale and verification, so this log keeps only the owner's direction and where the details live.

| Date | Direction | Record |
| --- | --- | --- |
| 11 Sep | Users see one Vietnamese recognition pack. Neither current checkpoint nor the pair is release-selected; the detector is the foundation for future formats, so model selection comes before calling it complete. Manual-only updates stay. | [0010](decisions/0010-vietnamese-model-selection.md), [shared-core plan](evaluations/shared-detection-core-plan.md) |
| 14 Sep | No tracking to improve detection: no analytics, correction uploads, crash reports containing input or background network feedback. Evaluations use synthetic developer fixtures only; private input and corrections never become persisted or evaluation data. | [CONTRIBUTING](../CONTRIBUTING.md#privacy-and-sample-data) |
| 15 Sep | Strongest practical shared-rule improvements: labelled passport/tax identifiers under the banking choice (reflected in its tooltip), card details under “other”, complete credentials and address boundaries. No new user-facing controls, no pack change, no data collection. | [0016](decisions/0016-complete-values-and-field-meaning.md) |
| 17 Sep | IPv6, written birth dates, organization boundaries and less masking of ordinary text, under the existing categories and pack requirement. | [0017](decisions/0017-contextual-fields.md) |
| 19 Sep | Organization names are hidden under “Thông tin riêng tư khác”, including a legal prefix that is part of the name. No separate organization choice; customer identifiers stay in scope. | [owner review v2](evaluations/single-model-owner-review-v2.md) |
| 19 Sep | Automatic name, address and organization detection is a release requirement; choose the strongest measured coverage. A larger optional pack is acceptable; the installer stays small; no cloud processing, telemetry, custom training or altered labels. | [0037](decisions/0037-quality-first-v1-candidate.md) |
| 20 Sep | Organization detection could be deferred from v1 if the compact GLiNER2 candidate passed the remaining fields. It did not; the deferral lapsed. | [0038](decisions/0038-conditional-v1-organization-deferral.md), [0039](decisions/0039-gliner2-compact-evaluation.md) |
| 20 Sep | Underthesea INT8 + mSuperClinical INT8 selected for v1 as one optional pack. Show transfer and installed sizes separately; download, install and ready are distinct stages with pause/resume; only the verified pack is ready. Selection does not mark failed quality checks as passed. | [0040](decisions/0040-v1-pair-and-compressed-download.md), [0041](decisions/0041-compressed-pack-installer-and-r2.md), [0042](decisions/0042-production-recognition-pair.md) |
| 21 Sep | Cancelling after processing starts keeps the loaded pack for retry; the installed pack is prepared in the background without any network use; model sessions are released before a reload. Memory and long-text latency remain release work. | [0043](decisions/0043-cancellation-recovery.md), [0044](decisions/0044-background-recognition-loading.md), [0045](decisions/0045-release-model-sessions-before-reload.md) |
| 21 Sep | Native inference qualified in isolation (same 398 synthetic outcomes, markedly faster) and contained in a helper process that survives crashes. Models and the one-pack experience stay fixed; the default backend changes only after offline GUI and platform qualification. | [0046](decisions/0046-selected-pair-native-runtime.md), [0047](decisions/0047-packaged-native-recognition.md), [0048](decisions/0048-isolate-native-recognition.md) |
| 9 Oct | Apply the whole project review “as long as we won't break the app”: shell split into composables and pages, pushed pack status, tooling and CI. A run continues while the user navigates; “Xóa phiên” sits beside “Phiên mới”. Markup, copy and styling unchanged. | [0051](decisions/0051-shell-refactor-and-tooling.md) |
| 9 Oct | The theme follows the owner's personal brand (wotdafong.dev): warm paper, ink, one cobalt accent, mono eyebrows, italic-serif emphasis, flat sheets, system light/dark. In-session restoration of the AI reply, sessions titled by their first masked line, ⌘/Ctrl + Enter. The personal P?! mark is not the product logo. | [0052](decisions/0052-brand-theme-and-restoration.md) |
| 9 Oct | The product mark is an alias, `[—]`; the wordmark sets Offline in ink and Mask in cobalt. Hero and open-session copy name what is hidden and walk the loop. | [0053](decisions/0053-product-mark.md), [brand/README](../brand/README.md) |
| 9 Oct | Keep the name **OfflineMask** after exploring about a hundred alternatives: “offline” carries the trust promise, “mask” is understood everywhere, the personality lives in the mark. Do not reopen naming without new reasons. offlinemask.com, .app, .dev and .io were unregistered at check time; registering them is the owner's task before any public mention. | this entry |
| 11 Oct | The repository is prepared for public contribution and the models become data: everything about them lives in `packs/<id>.json`, gated by `pnpm test` and `pnpm test:models`. | [0054](decisions/0054-replaceable-recognition-packs.md), [packs/README](../packs/README.md) |
| 11 Oct | Text ships first, and the home page must be usable without help: an honest first-run strip for the one-time 712 MB download, four numbered steps, “mã thay thế” instead of “bí danh”, the sample name “Phong Phan”. Still open for the owner: a single Văn bản card while only text ships, and what a fresh install shows for sample sessions. | [0058](decisions/0058-home-page-first-run-clarity.md) |
| 11 Oct | The screen after masking must not fail silently: unchecked categories are a visible warning that names likely person names still in the text when name recognition did not run, with highlight-to-hide and the pack download as fixes; the summary says how many categories were not checked. The copy button is step 3, the restore panel opens as step 4 after copying. Alias scopes are four hex characters. Heading is the first line, tab “Bản đã ẩn”, footer “Chỉ lưu trong lúc mở ứng dụng.” | [0059](decisions/0059-review-screen-clarity.md) |
| 11 Oct | The text card is a stepper like the home illustration, one step on screen at a time: paste, mask, copy, paste the reply. Long forms that scroll lose the user. Copying moves to step 4; the restore panel is step 4 inside the same card. | [0060](decisions/0060-text-card-stepper.md) |
| 12 Oct | Paste and mask are one step, so the flow is three steps on the home page and the text card. Copying is an explicit choice: "Chỉ sao chép" stays, "Sao chép và khôi phục" moves on to pasting the AI reply. | [0061](decisions/0061-three-steps-and-copy-choice.md) |
| 12 Oct | Sessions should survive a restart. Private sessions are kept in a passcode-protected encrypted vault; a forgotten passcode has no recovery and starts the user with an empty list. Setting a passcode is opt-in from Settings or the review footer. | [0062](decisions/0062-passcode-vault.md) |
| 12 Oct | The passcode is app-level and created on first launch; sessions are stored on disk behind it, never only in memory. Sessions are its first use. | [0063](decisions/0063-app-level-passcode.md) |
| 12 Oct | The passcode is optional. Nobody is asked to create one at launch; after masking, the review screen offers to keep sessions behind a passcode, set in place. The lock screen appears only once a passcode exists. | [0064](decisions/0064-optional-passcode.md) |
| 12 Oct | The passcode is six digits, entered like a phone passcode. | [0065](decisions/0065-six-digit-passcode.md) |
| 12 Oct | Home page promises only what works on a fresh install: processing is offline, the 712 MB pack is optional and adds names, addresses and other private information. Illustration copy matches the app; format cards are horizontal so they sit above the fold; the hero mark shows only without the sidebar. Bảng tính waits for the spreadsheet pass. | [0066](decisions/0066-home-page-honest-and-compact.md) |
| 12 Oct | Settings offers Giao diện: Tự động (default, follows the system), Sáng or Tối, remembered on this machine; the desktop title bar follows. Brand-kit colours unchanged. | [0067](decisions/0067-appearance-setting.md) |
| 12 Oct | Settings is three cards (Gói nhận diện, Mật mã · Lưu lịch sử, Ứng dụng). File install lives with the pack; the version sits with updates; the passcode form opens on request and removing the passcode is tucked behind a disclosure; no crumb repeating the heading. | [0068](decisions/0068-settings-three-cards.md) |
| 12 Oct | User-facing copy says “lịch sử” (entries are “mục”), not “phiên”; “Xóa khỏi lịch sử” and “Tạo mới” on the text page. Code names and storage are unchanged. | [0069](decisions/0069-history-wording.md) |
| 13 Oct | Text screen: hidden values and likely missed names are highlighted in the review, a likely name hides in one click, the text box comes first with what to hide folded into one line, "Sao chép và tiếp tục" / "Chỉ sao chép", "Sửa văn bản", and restoring follows the pasted reply with highlighted results. | [0070](decisions/0070-text-screen-review-highlights.md) |
| 13 Oct | History is a passcode feature: without one the sidebar list is hidden and nothing mentions saving; the review screen offers it once. After copying a restored reply: "Dán câu trả lời khác" or "Ẩn văn bản mới", no "Xong". | [0071](decisions/0071-history-needs-passcode.md), [0070](decisions/0070-text-screen-review-highlights.md) |
| 13 Oct | Without a passcode each format has one screen: a new result replaces the last, and returning from another page shows whatever was open, including a pasted reply. | [0072](decisions/0072-one-screen-without-history.md) |
| 13 Oct | Bug: pausing the pack download could stick at "Đang tạm dừng…"; statuses now carry a revision and stale ones are ignored. "Tải thêm để tiếp tục" starts the download. | [0073](decisions/0073-pack-status-revision.md), [0070](decisions/0070-text-screen-review-highlights.md) |
| 13 Oct | The text page's pack notice and button follow the download, install, pause and error stages, with progress. | [0074](decisions/0074-text-page-pack-progress.md) |
| 13 Oct | Lock screen: six phone-like slots, unlock on the sixth digit without a button, a red shake and message for a wrong passcode, "Mở khóa để xem lịch sử của bạn.", and reset copy that matches Settings. | [0075](decisions/0075-lock-screen-feedback.md) |
| 13 Oct | Spreadsheets are real: drop or pick an .xlsx/.csv (≤ 20 MB, 100 000 rows), preview 20 rows with a per-column choice like Mailchimp (keep, scan, or hide as a type), mask all, save a masked copy, and restore the AI's returned file. Values, sheets and basic look are kept; without a passcode the download warns that restoring needs the app open. | [0076](decisions/0076-spreadsheet-files.md) |
| 13 Oct | Spreadsheet follow-up from the owner's statement file: find the header below titles and summary lines, keep money and date columns, scan counterparty columns, detect each distinct text once, and show a progress panel with an estimate and Hủy. Making the native Rust recognition the default remains a separate decision. | [0076](decisions/0076-spreadsheet-files.md) |
| 13 Oct | Speed matters more than the earlier "WASM until qualified" caution: end users are likely on weaker Windows PCs. Native recognition (about 13× faster here) is prepared for Windows x64 with CI builds and a manual qualification checklist; it becomes the Windows default once that checklist passes. `desktop:dev:native` gives release speed in development. | [0077](decisions/0077-native-recognition-windows.md) |
| 14 Oct | Word (.docx) is the next file type, under the general category "Tài liệu" (like "Bảng tính" for Excel and CSV): low effort, high impact. Same three steps as spreadsheets; text, tables, headers, footers, notes, comments and deleted tracked changes are masked with formatting kept; mailto links and author fields too. PDF and images stay "Sắp có". | [0078](decisions/0078-word-documents.md) |
| 14 Oct | The models over-hid a real book (public names, places, lowercase words as names). Documents and spreadsheets now end with **Kiểm tra trước khi tải**: every hidden value with its type and count; uncheck a value to keep it everywhere, or a type chip to keep the whole type for that file. In files only, a name must contain a capital letter. A minimum model score of 0.3 was measured to regress no gate and is now pack data (0.4+ loses labelled values). | [0079](decisions/0079-file-review-and-capital-names.md) |
| 14 Oct | Long texts get the same progress panel as files (steady percentage, bar, estimate), shown only when masking takes longer than a moment, so short texts never flash it. | [0082](decisions/0082-text-progress-panel.md) |
| 14 Oct | .txt is not a document format: a .txt or .md dropped on Tài liệu opens on Văn bản, pasted and ready to mask. File errors under drop zones are smaller (13 px). | [0083](decisions/0083-plain-text-files-open-in-text.md) |
| 14 Oct | Tài liệu also takes OpenDocument text (.odt, LibreOffice), with the same steps and review. Masked copies of .odt and .docx drop the first-page thumbnail, which would show the original. Other Word-like formats (.doc, .rtf, Pages) stay out. | [0084](decisions/0084-opendocument-text.md) |
| 14 Oct | Bảng tính also takes OpenDocument spreadsheets (.ods, LibreOffice); the masked copy stays .ods with only hidden cells rewritten. Old .xls waits for the owner's decision on the SheetJS reader (CDN-only distribution). | [0085](decisions/0085-opendocument-spreadsheets.md) |
| 14 Oct | Old Excel (.xls, including banks' HTML "xls" exports) opens in Bảng tính via SheetJS 0.20.3 from its CDN (pinned by integrity); the masked copy is saved as .xlsx and the page says so. | [0086](decisions/0086-old-excel-files.md) |
| 14 Oct | PDF and Hình ảnh move from the home page's coming-soon row into the sidebar, after Tài liệu, as faded, non-clickable items with the "Sắp có" badge. Home cards lead with their use (Email, tin nhắn · Sao kê, danh sách · Hợp đồng, báo cáo) and list file types on a quiet line below. | [0087](decisions/0087-upcoming-formats-in-sidebar.md) |
| 14 Oct | The sidebar names each format's file types (TXT, MD · XLSX, XLS, ODS, CSV · DOCX, ODT); the text box accepts a dropped .txt/.md; the Văn bản card says "Dán email, tin nhắn"; the home page drops the "Gói nhận diện đã sẵn sàng." strip once the pack is installed. | [0088](decisions/0088-formats-in-sidebar-and-quiet-home.md) |
| 14 Oct | Home page for first-time, low-tech users: one start box (drop or choose any supported file, or paste text anywhere) opens the right page with the content loaded; cards become "Hoặc chọn loại nội dung"; "Tệp và văn bản không rời khỏi máy bạn." and "Xem thử với ví dụ" sit under the box; the pack strip is an outlined, optional offer; illustration steps also fit files. | [0089](decisions/0089-home-start-box.md) |
| 18 Oct | Quick actions for use from other apps: ⌘⇧M masks ordinary clipboard text and restores an AI reply in place; a draggable always-on-top panel offers the same two buttons and shows each outcome; both under Cài đặt › Thao tác nhanh. The clipboard is read only on the user's press. | [0090](decisions/0090-clipboard-quick-actions.md) |
| 18 Oct | ⌘⇧M first takes the selection of the front application and puts the result back over it; without the macOS Accessibility permission (Cài đặt › Thao tác nhanh › Cấp quyền), or with nothing selected, it works on the clipboard as before. | [0091](decisions/0091-in-place-replace.md) |
| 18 Oct | Background mode: a menu bar / tray icon with the quick actions, the window hides instead of quitting on close (the panel says so; the tray item quits), and an optional "Khởi động cùng máy" that starts hidden. | [0092](decisions/0092-background-mode.md) |
| 18 Oct | macOS Services: "Ẩn thông tin bằng OfflineMask" on selected text in any app (result to the clipboard) and "Ẩn thông tin tệp bằng OfflineMask" on files in Finder (opens the first file on its page). Built .app only. | [0094](decisions/0094-macos-services.md) |
| 18 Oct | Opt-in clipboard watch, off by default: on copy, the built-in rules check the text on the machine and the panel offers to mask if they find something; nothing stored. PRD wording amended. | [0095](decisions/0095-clipboard-watch.md) |
| 18 Oct | A new mark, from twelve brush sketches in two rounds: a cobalt swipe with two eye holes, the thing that hides drawn as a character beside P?!. Generated by `brand/make_mark.py` like the personal mark; app icons, favicon and in-app tiles come from the generator. The alias `[—]` is retired. | [0094](decisions/0093-brush-mark-and-sketches.md), [brand/README](../brand/README.md) |
