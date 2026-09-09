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
- **Visual direction:** restrained, high-end liquid glass with readable text and a blue, white, and neutral palette. The owner explicitly dislikes purple/lavender. The earlier dark-green choice was not grounded in the owner's preference; do not restore it as the primary color.
- **Glass implementation:** consistency and speed matter. The current approach uses shared CSS tokens and one glass surface rule, with fallbacks. No dedicated glass library was requested or installed. Evaluate dependencies against demonstrated needs and measured behavior; do not claim that a library or CSS alone guarantees performance.
- **Home and navigation:** provide Text and Excel choices on the home page and left sidebar. Other file formats should be visibly coming soon until implemented.
- **Sessions:** each masking/redaction conversion should create a distinct session, comparable to conversation history in chat apps. Users must be able to return to earlier conversions and their choices. Starting a new conversion must not overwrite an earlier one.
- **Tooling and documentation:** use mise for tool versions. Study current official library/framework documentation with Context7 when doing library-specific work. Record scaffold provenance, consequential dependency choices, and implementation limits.
- **Open source:** the project is intended to be open source. Favor standard, maintainable patterns, reproducible setup, shared styling, clear contribution guidance, and documented dependencies. License selection remains pending; the owner has not selected one.

## Accepted prototype versus unfinished product

The committed baseline is an official Tauri Vue/TypeScript scaffold with custom UI, not a downloaded liquid-glass UI template. Text and Excel operate on public synthetic fixtures. Sample session history persists fixture references and mask/keep choices only. Excel copies tab-separated sample output; it does not import or export workbook files.

Real-input detection, Excel/file adapters, encrypted private history, restoration, cross-platform verification, and performance targets remain unfinished. Boilerplate acceptance must not be presented as acceptance or completion of those capabilities. Real private data must not be added to the sample localStorage path.

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
