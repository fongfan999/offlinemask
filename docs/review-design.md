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
