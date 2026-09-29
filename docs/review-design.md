# Workspace design and verification

The current design follows [Decision 0002](decisions/0002-workspace-and-glass.md): a blue-and-white format home, Text and Excel sample workspaces, one-panel review, and persistent session navigation in a left sidebar. The sidebar collapses below 760px. Other formats are visibly coming soon.

## User flow

Choose a format from home or the sidebar. Review the synthetic input and click **Ẩn thông tin**. This creates a distinct saved sample session. Switch between original and masked output, optionally open **Xem thay đổi** to retain individual values, then copy the output. The Excel entry point groups Excel and CSV; the sample copies tab-separated text and does not import or export either file format.

Opening a previous session restores its choices. Starting another conversion keeps older sessions. The home page does not prepopulate fabricated history. Invalid or failed storage is reported, and malformed stored history is not silently overwritten.

## Styling and accessibility

Shared CSS tokens and one glass class define the translucent surfaces. All accents are blue or neutral; no purple/lavender remains. There is no glass library, runtime filter animation, or remote asset dependency. Opaque and reduced-transparency fallbacks are included. This is a CSS glass treatment, not native Apple material or verified physical refraction.

Controls use native buttons, labelled text fields and checkboxes, pressed/expanded states, visible focus, and live copy feedback. Small-window navigation moves focus into the sidebar, makes the background inert, and restores trigger focus on Escape. Choosing a destination closes the drawer and focuses the page heading. Wide tables scroll inside their panel.

## Verification on 9 September 2026

- Frontend type checks and production build passed.
- Eight core tests passed: explicit-choice gating, consistent aliases, original preservation, independent history, persistence round trips, serialization allowlisting, invalid-history rejection, and table shape/amount preservation.
- Browser walkthrough created separate Text and Excel sessions, retained an account number in one session, reloaded, and reopened both with independent decisions intact.
- Table output contains two rows with consistent aliases and unchanged amounts; copy displayed success feedback.
- Visual checks at 1280 × 720 and 640 × 760 showed no page-level horizontal overflow. Narrow table content scrolls within its panel.
- macOS release build passed. A native Excel sample session survived quitting and relaunching the app, and reopened with the masked table and unchanged amounts.
- Drawer opening, destination navigation, Escape dismissal, and focus restoration passed.

Only public synthetic fixtures and choices are persisted. Real input, encrypted private storage, file adapters, restoration, target-hardware performance measurements, full screen-reader evaluation, and additional operating systems remain future work.

## Home simplification verification — 9 September 2026

- Removed redundant navigation, slogans, and explanatory home copy; grouped CSV under Excel; changed masking labels to “ẩn thông tin”; displayed metadata version `1.0.0`.
- Bundled the blue-accented unDraw illustration locally (approximately 9 KB); [source and license](third-party-assets.md) are documented. The production build emits the local SVG asset.
- Frontend type checks, production build, all eight existing tests, and native formatting/Clippy checks passed.
- Browser visual checks covered 1280 × 720, 640 × 760, and 390 × 844. Narrow widths had no page-level horizontal overflow; home cards stack below 440px.
- Keyboard activation of the Text card focused the editor heading. Drawer opening focused the brand button and made the workspace inert; Escape restored focus to the menu trigger.
- Created separate Text and Excel sample sessions, reloaded, and reopened the saved Excel session from the narrow drawer. The masked table and unchanged amounts remained present, and navigation focused the session heading.
- The macOS release app bundle built successfully. After restarting the packaged app, its `tauri://localhost` home displayed the local illustration and version `1.0.0`; an existing native Excel session reopened with its masked table intact. Left the app on the updated home screen.

## Product-focused hero — 9 September 2026

Subsequent owner feedback rejected the unDraw image and requested a stronger explanation of the core feature. The new hero uses a two-line headline connecting masking to sharing with AI, one sentence about aliases and offline operation, and an original before/after document illustration. The example shows a synthetic name replaced by `[TEN_DEMO_01]` while the displayed amount remains unchanged. It is explicitly labelled as an illustration and makes no restoration or automatic AI-submission claim.

The illustration is static semantic HTML/CSS in `MaskingPreview.vue`, with existing icons and shared glass styling. The unDraw asset was removed; no dependency or remote asset was added. Text/Excel navigation and session behavior remain unchanged.

Frontend type checks and the production build passed. Browser checks at 1280 × 720, 640 × 760, and 390 × 844 confirmed readable layout with no page-level horizontal overflow. Keyboard activation of the Text card focused the editor heading, and the narrow drawer returned to Home correctly.

The macOS release bundle also built successfully. Restarting it displayed the new headline, alias example, and format cards from `tauri://localhost`. The existing session remained listed. Left the packaged application on this home screen for review.

## Spreadsheet naming and start prompt — 9 September 2026

The category is now “Bảng tính” across home, navigation, and the editor, with “Excel, CSV” as the home card description. The internal `excel` format key remains unchanged to preserve saved sessions. A semantic level-two heading, “Chọn nội dung để bắt đầu”, labels the format selection section. Hover and keyboard focus use the same blue border emphasis while retaining the visible focus outline.

Compact desktop spacing keeps the entire home page, including the version footer, within 1280 × 720. Browser checks also covered 640 × 760 and 390 × 844 with no horizontal overflow; cards stack at narrow widths. Keyboard navigation showed the blue card border and solid focus outline, and Enter opened the spreadsheet editor with its updated heading focused.

Final frontend type checks, production build, and macOS release bundle build passed. The final native visual smoke check could not run because the Mac was locked; the currently running native app may still show the prior build until restarted.

## Branding and external website — 9 September 2026

Added the existing shield above the headline, a discreet creator credit, and a footer link to the product homepage. The sample name remains synthetic. A compact ordered workflow explains local masking, manual copying to an AI tool, and an optional future restoration step labelled “Sắp có”. Keyboard focus now uses a thinner 2px outline without a second emphasized card border.

Frontend build/type checks, all 11 tests (including three external-link adapter cases), and native formatting/Clippy checks passed. Browser visual checks covered 1280 × 720, 640 × 760, and 390 × 844; narrow layouts had no horizontal overflow. The phone layout stacks the three steps, and Tab activation displays the 2px focus outline.

The browser link opened a separate tab targeting `https://offlinemask.com/` while preserving the app page. The destination returned `ERR_NAME_NOT_RESOLVED` in this environment, so live homepage content was not verified. This is distinct from launching the browser successfully. See [native URL scope and dependency rationale](decisions/0003-product-website-link.md).

The final macOS bundle built successfully and was restarted. Its home screen displayed the new branding, workflow, creator credit, and website link. Activating the native link opened `offlinemask.com` in Dia while preserving the application page, without an opener error. The destination reported NXDOMAIN, consistent with the owner's confirmation that the landing page is planned for later. Left OfflineMask visible on its updated home page.

## Integrated AI panel and sidebar footer — 9 September 2026

The AI step now follows the masked-copy panel in the same illustration, with an optional return-to-OfflineMask restoration note beneath it. The separate numbered workflow row was removed. Restoration no longer carries a “Sắp có” badge because it is required MVP scope; this presentation change does not implement restoration in the current sample editor.

Website, creator credit, version, and link-opening error feedback moved to the sidebar footer. The footer remains outside the scrolling history area and is available inside the narrow drawer. At 640 × 560, keyboard navigation scrolled history by 118px while the footer bottom stayed at 540px, retaining the 20px bottom inset. Escape from the footer link closes the drawer. Browser visual checks at 1280 × 720, 640 × 760, and 390 × 844 showed the unified flow and no page-level horizontal overflow at the narrow widths. At phone width, AI follows below the masked-copy panel.

Frontend type checks, the production build, and the macOS release bundle build passed. Restarted the packaged app and visually confirmed the unified illustration, restoration note without a coming-soon badge, and anchored sidebar footer. The existing native sample session remained listed.

## Illustration cleanup — 9 September 2026

Replaced the homepage illustration name with the owner-requested “Phan Thái Phong” and removed the sidebar creator credit. The amount remains fictional; editor fixtures and session storage are unchanged. Removed the redundant shield from the first connector so both forward arrows have the same 18px size, 40px connector width, and vertical alignment. The return note uses a matching left arrow and “Khôi phục bản gốc · Tùy chọn”, without a divider or reset symbol. Removed the visible example caption while preserving the diagram's accessible description.

Visual checks covered 1280 × 720, 640 × 760, and 390 × 844. Both desktop connectors had identical vertical positions and dimensions, and narrow layouts had no horizontal overflow.

Frontend type checks, the production build, and the macOS release bundle passed. Restarted the packaged app and visually confirmed the updated name, matching connectors, simplified restoration note, and website/version-only sidebar footer. The existing native sample session remained listed.

## Start heading and upcoming formats — 9 September 2026

Removed the remaining restoration note and updated the diagram's accessible description to match. The start heading is now 22px with stronger weight and more separation from the illustration. Deferred formats appear in a non-interactive list under “Định dạng sắp có”, with a subtle divider and a stacked label at phone widths.

Browser checks at 1280 × 720, 640 × 760, and 390 × 844 confirmed readable layout and no horizontal overflow. Keyboard activation of the Text card opened its editor. Frontend type checks, production build, macOS release bundle, and whitespace checks passed. Opened the packaged app and visually confirmed all three refinements; the existing sample session and anchored website/version footer remained present.

The owner accepted this final homepage on 9 September 2026 (“looks good, document and commit it”). It is the presentation baseline for subsequent page work, as summarized in [product direction](product-direction.md#current-acceptance).

## Real text entry and preview — 9 September 2026

The text page now accepts typed/pasted input and creates independent temporary sessions using local detection rules. It retains the accepted layout, original/preview switch, expandable mask/keep choices, and copying. An optional sample fills the editable draft. Real text and its mappings never enter persisted sample history. Supported rules and outstanding capabilities are recorded in [Decision 0004](decisions/0004-text-processing.md).

- Frontend type checks, production build, and all 22 tests passed, including 11 new tests for text detection/transformation, namespace collisions, limits, and the private-history boundary.
- Browser checks covered typed input, pasted multiline Vietnamese text, repeated names, account/phone/email masking, unchanged dates/amounts, exact original display, keep choices, keyboard copying with success feedback, and no-match previews.
- Created two private sessions, reopened the first, and confirmed its keep choice remained independent. A draft survived Home → Text navigation.
- Created a spreadsheet sample alongside a private text session, then reloaded: only the spreadsheet sample remained in history. Tests additionally verify that serialized history excludes private content, aliases, and metadata.
- Empty and whitespace-only input disabled processing. A 50,001-character paste was retained with a visible error and disabled action; it was not silently truncated.
- Visual checks covered the editor at 1280 × 720 and review at 390 × 844. At 390px and 640px widths, document scroll width equaled viewport width. Expanded changes remained readable, and the narrow drawer exposed the temporary-session label.

Browser copy failure falls back to selecting output for manual copying; switching to the original clears this fallback so the original view cannot accidentally display masked output. The failure branch was inspected in code; clipboard failure injection was not performed in this walkthrough. No cross-platform or comprehensive detection claims follow from these development checks.

The final macOS `.app` release bundle built successfully and was relaunched. Pasting a synthetic Vietnamese support message produced four findings and a preview with a repeated name using the same short alias, while the date, amount, and line breaks remained intact. Native copying displayed success feedback. The existing spreadsheet sample stayed listed, and the new text session was marked temporary. Left the packaged app on this preview. The earlier DMG build predates the final alias-length refinement; the verified final deliverable is the `.app` bundle.

## Library-backed text detection — 9 September 2026

This supersedes the rule-only detector verification above. The accepted layout and temporary-session boundary remain intact; see [Decision 0005](decisions/0005-library-text-detection.md).

- `pnpm test`: 25 checks passed, including actual contact parsers, overlapping model windows, whole-word boundaries, cancellation/retry, stale worker events, exact-original transformations, and private-history exclusion.
- `pnpm test:models`: 11 synthetic real-weight regressions passed with network fetch replaced by a throwing function. The cases cover repeated names in a letter, unlabelled people, street addresses, emoji, national/international phones, email domains, lowercase and unaccented names, ordinary prose, transaction date/amount retention, and identifiers at the tail of a longer document. Every non-whitespace character in annotated sensitive values must be covered; detecting a fragment is not sufficient. CPU startup was approximately 2.5 seconds, short cases 20–130 ms, and the long-tail case about 1.7 seconds on this development machine. These are CPU-backend observations, not WebView latency guarantees or a representative accuracy benchmark.
- In-app browser worker inference with both models produced complete names and addresses in the previously failing synthetic examples. Original switching, retaining a finding, and copying reflected exact expected text. A no-match example remained unchanged. Cancellation retained a 28,523-character synthetic draft. The 640×560 layout kept progress and cancellation controls reachable without horizontal clipping.
- Model failure during the earlier WASM-loader check retained the input and showed an error without creating a session. The loader was corrected to use the JS loader bundled by Transformers.js with its matching local WASM asset.
- Frozen offline dependency installation, frontend type checking, Rust formatting, and Clippy passed. Native runtime verification is recorded below separately from browser/CPU checks.

The two individual checkpoints had different misses; using either alone failed parts of the expanded corpus. Whole-word boundaries and combined evidence improve these examples but do not establish complete detection. One additional narrative proposed the ordinary word “Người” as a name; keep controls can reverse such false positives. No Windows/Linux, low-memory hardware, broad Vietnamese banking corpus, or clean disconnected OS-installation certification is claimed.

Packaged macOS verification (Apple Silicon, macOS 26.6.2):

- A locked release build with resource packaging completed; the model files are outside the executable in `Contents/Resources/models`. Every bundled manifest-listed asset was checked against its pinned SHA-256, and both model-license files were present. The application occupies approximately 1.3 GiB; the executable itself is approximately 7.8 MiB.
- With the Vite/Tauri development processes stopped and port 1420 not listening, the app loaded both models under production CSP and produced the expected four aliases for a synthetic Vietnamese name, street address, email, and phone. The date and amount remained readable.
- Original switching restored the exact input. A keep choice updated the preview, copying succeeded, and pasting via ⌘V into a fresh draft matched the copied preview. Reopening the conversion retained the keep choice. Native cancellation during model loading returned control to the editor.
- Resource packaging avoids recompiling/compressing model weights into the executable. It grants only read access to the bundled model directory, without a general filesystem plugin or private-data persistence.

These checks demonstrate local resource loading and the tested workflow. They are not a packet-capture audit or a clean disconnected installer/OS-provisioning certification.

## Optional models and category selection — 9 September 2026

Owner feedback moved models out of the default installer and added pre-processing category choices. The accepted glass palette, sidebar, and temporary sessions are preserved.

Verified on macOS 26.6.2 / Apple Silicon:

- Normal production builds succeeded with 1.3 GiB of development model assets present but excluded. `dist`, `dist-desktop`, and the packaged `.app` contain zero ONNX/tokenizer model files. The macOS app is approximately 9.75 MB (9.30 MiB); the optional model pack remains 1.41 GB.
- Fresh native app with no app-local models showed Settings → “Chưa tải”, explicit size, and the download action. Built-in categories processed synthetic email, phone, and account numbers immediately and left the name intact. Preview disclosed the unchecked name/address/other categories.
- The real HTTPS download progressed, paused, and retained its partial file. Restart restored “Đã tạm dừng” and the same byte count. Resume advanced from roughly 13 MB to 113 MB without replacing the partial transfer. The test was then paused; completing the entire network transfer was not repeated.
- Previously downloaded, pinned model files were copied into the app-local model directory for installation verification. Startup checked their hashes and showed “Sẵn sàng”. Packaged inference masked “Phạm Thị Hồng”, the complete synthetic street address, email, and phone, preserving `08/09/2026` and `2.500.000 đồng`. The app's optional test models remain installed outside the app bundle.
- Browser verification at 1280 px and 640 px checked responsive category cards, Settings, the missing-model gate, draft/choice preservation across Settings navigation, empty-selection gating, and Space-key checkbox control. Native AX labels explicitly announce category and capability availability.
- All 27 fast JavaScript tests, 5 native downloader tests, and 11 real-model synthetic regressions passed. Real-model CPU tests disable network fetch. TypeScript, Rust format/Clippy with warnings denied, and locked macOS app build passed. The dev server was stopped for the final native checks.

No Windows/Linux packaging or full disconnected-machine installation was tested. The optional downloader is user-triggered; there is no model removal/import UI yet. Private text and session choices remain RAM-only. Detection can still miss or misclassify information and requires review.

## Text-page copy and hierarchy — 10 September 2026

Applied the owner's seven annotated simplification requests. Removed the temporary badge, text-page eyebrow, always-visible download promotion, category-rule helper, original-preservation footer, and entry-page explanatory paragraphs. Missing choices now say “Cần tải thêm”; ordinary download UI refers to a “gói nhận diện”. Available choices have no extra status line. Enabled actions use solid blue; disabled controls use a distinct neutral fill.

Verified browser layouts at 1280 px and 640 px, Space-key deselection, banner appearance/disappearance, the route to Settings, and processing the synthetic sample into the expected local-only preview. The preview retains unchecked-category disclosure and one clear session-lifetime note. Type checking and the locked macOS bundle build passed. The packaged app was launched separately from the existing developer session and visually verified with synthetic sample input; the native download prompt appears only while a missing capability is selected. No detection or download implementation changed, so the model evaluation corpus was not repeated.

## Settings audit — 10 September 2026

Reduced the initial download view to the package title, one sentence of added capabilities, its 1.41 GB size, and “Tải về”. Removed repeated descriptions, the decorative icon, checklist, initial missing-state badge, separate built-in-features card, and offline reassurance. Attribution remains in a collapsed “Thông tin gói” disclosure. Progress, cancellation, retry, and installed state remain contextual; the top return-to-text control replaces the duplicate installed-card action.

Browser checks at 1280 px and 640 px confirmed a compact single-card layout, visible download size, collapsed-by-default details, and keyboard expand/collapse. Production type checking passed. This is a presentation change; detector and native downloader implementations are unchanged.

The packaged macOS app also displayed the existing paused download correctly, without starting a new transfer. Progress states show size in the progress readout only, avoiding a second size block below it. The locked macOS build passed.

## General manual updates and file-install placeholders — 10 September 2026

Added a general update row outside the recognition-pack card, explicitly covering the application and recognition packs. It is marked “Sắp có” and disabled while the release service/app updater is deferred. File installation is a secondary disclosure with a disabled file action and disabled offlinemask.com download-page reference. These placeholders contain no event handlers, network calls, navigation targets, or file access; opening Settings cannot initiate an update check. Existing local installation-status polling remains separate.

Verified browser presentation at 1280 px and 640 px, disabled-control semantics, the download-page placeholder, and keyboard expand/collapse. Type checking passed. Detector, downloader, and native permissions are unchanged; their existing test suites were not repeated for these presentation-only placeholders.

The locked macOS build passed. Native verification confirmed the general update button sits outside the pack card, and both it and file installation are disabled with “Sắp có”. Expanding the file-install disclosure exposes the disabled website placeholder and “Chọn tệp”; no update check or transfer was started.

## Settings polish and shared badge — 10 September 2026

Removed the Settings return button, refined all shared primary actions to a deeper blue gradient, and introduced one reusable coming-soon badge for Settings and the homepage's deferred formats. Added two concise lines explaining that update checks are manual and cover the app and recognition packs. Both future actions remain disabled.

Verified Settings at 1280 px and 640 px, keyboard disclosure expansion/collapse, disabled action/link semantics, and the shared homepage badge. White text against the lightest primary-button gradient stop has a calculated 5.45:1 contrast ratio. Type checking, production frontend build, locked macOS bundle build, and diff whitespace checks passed. The rebuilt packaged app displayed the new button, badges, manual-update copy, and existing paused download without a new transfer. Detection and downloader behavior were unchanged; their regression suites were not repeated for this presentation-only change.

## Checkpoint comparison — 10 September 2026

Added a reproducible 66-case, 97-entity synthetic comparison with full-span and category-selected coverage, excess masking, request failures, two isolated CPU rounds, timing, and peak process RSS. Added a validated optional checkpoint selection argument to the detector for evaluation; the application still defaults to the unchanged two-model manifest. Corrected provenance labelling when selecting only the second checkpoint. No UI, download protocol, installed model files, or network policy changed.

All 32 fast tests, the original 11 real-model regression cases, TypeScript checking, production frontend build, and whitespace checks passed. Both comparison rounds completed with identical quality results. Those evaluations intentionally report, rather than conceal, the newly discovered alignment error and unmet coverage gates. None of the three configurations passed the provisional screening floor. The original suite passing is not evidence that the broader failures are resolved. No native configuration changed; no new packaged UI smoke test was needed. See [measured results](evaluations/2026-09-10-model-comparison.md) and the [decision](evaluations/2026-09-10-model-decision.md).

## Alignment fix and alternative checkpoints — 10 September 2026

Fixed the observed uppercase alignment failure by preserving raw tokenizer pieces and actual per-token predictions, including unknown IDs that the convenience pipeline had dropped. Validate input/logit layout and keep fail-closed errors. Added the uppercase negative fixture to the real-model regressions and three focused unit tests for unknown pieces, separators and invalid output.

All 35 fast tests, 12 real-model regression cases, TypeScript checks, and the locked macOS packaged build passed. The repaired Small/Large/pair and BigMed/Underthesea INT8/Underthesea FP32 were evaluated in two isolated CPU rounds on the unchanged 66-case corpus, with identical quality outcomes across repeats. The current configurations and BigMed had no request failures. The experimental Underthesea JavaScript adapter failed on six cases; a separate native-tokenizer exact-offset reference completed all inputs and quantified FP32/INT8 quality differences. These candidate failures are recorded, not presented as successful validation.

Both new candidate repositories were downloaded explicitly to developer evaluation storage with pinned revisions and upstream content verification. Underthesea was exported and quantized locally in an isolated Python environment. Exact export settings, versions, hashes, raw synthetic results, runtime/memory measurements and limitations are recorded in the [protocol](evaluations/alternative-model-protocol.md), [comparison](evaluations/2026-09-10-alternative-comparison.md), and [decision](evaluations/2026-09-10-alternative-decision.md). No alternative was added to the installer or production pack, and app-local user model files were untouched. CPU results are not desktop WASM certification; the pure runtime fix had no UI changes requiring a new visual audit.

The BigMed candidate also ran through the existing 12-case model regression gate: nine passed and three failed on incomplete names (`mixed-contact-address`, `lowercase-name`, `unaccented-names`). The production configuration passes all 12. These candidate regressions are another explicit reason not to replace the pack.

## Verified positioning and manual review — 10 September 2026

Implemented [Decision 0007](decisions/0007-text-positioning-and-manual-review.md): strict sequential source alignment for the pinned tokenizers, complete-grapheme model windows, and contextual manual hiding from either text view. Corrections preserve unrelated aliases/choices, account for textarea newline normalization, and stay in RAM. Last-correction undo does not rewind the manual alias counter.

Validation on the development Mac:

- 47 fast tests and TypeScript checks passed. 120 real-tokenizer offset mappings passed with network fetch forbidden, covering NFD, NBSP, literal special tokens, emoji and repeated CRLF input.
- All 12 existing real-model regressions passed. The 66-case current-pair rerun completed without request failures and retained 81/97 complete-entity coverage. The 12 fresh cases completed but exposed two partial addresses and false positives; see [full results and limits](evaluations/2026-09-10-text-reliability.md).
- Browser preview: local-only processing with the pack absent; pointer selection and keyboard activation of manual masking; keyboard undo; correction after an existing alias; copy followed by paste into a new draft matched the corrected output; reopening the session retained its correction and undo. At 390 × 844, the contextual action and undo fit inside the card with the existing copy action. Temporary viewport override was reset.
- Final locked macOS `.app` build passed. Relaunched the packaged release and tested local-only processing without downloading the pack, Unicode source preservation, keyboard selection, manual hiding, undo, a correction from the original view, and copy success. A correction after undo used `AN_THEM_2`, preserving the counter. The previous test release contained only sample history; the user's separate dev server/debug application was left running.

No native code, dependency pins, model manifest, or app-local installed model files changed in this step. The packaged smoke test exercises the lightweight path; model inference/quality checks used local CPU, not desktop WASM benchmarking. Other OS/older WebView support and representative user-data accuracy remain unverified. No automatic Internet check or new download action was introduced.

## Address completion — 10 September 2026

Added [bounded, model-supported address completion](decisions/0008-address-boundary-completion.md) without changing the UI, dependencies, checkpoint manifest, or production model files. Full original source positions and higher-priority local identifiers remain intact. Stronger address additions cannot discard previously covered address tails.

All 56 fast tests, TypeScript checks, the developer benchmark's TypeScript check, 14 real-model regressions (the existing 12 plus complete apartment/rural cases), and 120 tokenizer-position checks passed. The current pair and three smaller configurations were scored on five synthetic sets; actual misses and candidate errors are retained in the [address evaluation](evaluations/2026-09-10-address-policy.md). Final unseen address coverage is 9/9; harder earlier misses remain, so this is not production accuracy certification or justification for a smaller pack.

The isolated macOS benchmark bundle built successfully, but its interactive timing/memory run is pending because the computer was locked. No attempted run is counted as a performance or native interaction pass. The final locked production bundle built successfully with the normal configuration after creating the isolated harness; its bundle identifier was verified separately from the benchmark app. The user-managed pack and separate dev server/debug application are untouched; benchmark weights exist only in the separate developer test directory.


### Desktop model reliability follow-up — 10 September 2026

An isolated release benchmark using production workers completed cold/warm short text, 2,000, 10,000, and 50,000 UTF-16 units after cleanup and yielding tokenizer preparation. The complete synthetic address at the end was covered in every result. Earlier versions reset because WebKit exceeded its memory limit; these failures are retained in the [runtime report](evaluations/2026-09-10-desktop-runtime.md). The completed run still used 7.20 GiB peak footprint and took 400.708 seconds at the text limit. This is not release performance acceptance. Manual cancellation during model loading returned to an enabled Run control. No private text was used or stored; only the isolated synthetic benchmark persists metrics.
