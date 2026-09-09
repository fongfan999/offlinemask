# Workspace design and verification

The current design follows [Decision 0002](decisions/0002-workspace-and-glass.md): a blue-and-white format home, Text and Excel sample workspaces, one-panel review, and persistent session navigation in a left sidebar. The sidebar collapses below 760px. Other formats are visibly coming soon.

## User flow

Choose a format from home or the sidebar. Review the synthetic input and click **Che thông tin**. This creates a distinct saved sample session. Switch between original and masked output, optionally open **Xem thay đổi** to retain individual values, then copy the output. The Excel sample copies tab-separated text; it does not import or export an Excel file.

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
