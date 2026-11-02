# 0197 — A floating "Báo lỗi / Góp ý" button, suggestions alongside bug reports

Date: 2 November 2026. Status: implemented. Owner: "users are complaining they don't see a place to report bugs or suggest new features"; "it's not about the title, it's about a placement, they also suggested a floating button".

## Problem

The report page from decision 0147 existed, but users still could not find it:

- The app's sidebar button already read *Báo lỗi hoặc góp ý*, but the dialog it opened was titled *Báo lỗi* and offered only problems (missed, wrong, crash, other). Someone with an idea for a feature saw nothing that fit.
- On the website, `/bao-loi` was marked `noindex` and linked only from the privacy policy, so a visitor could find it only by going through the app.

## Decision

- **Placement.** The entry leaves the sidebar, where it sat under *Cài đặt* and read as one more setting, for a raised cobalt (`--accent`) pill, *Báo lỗi / Góp ý* with a speech bubble, at the right end of the app's footer, highlighted like the website's at the owner's request. `AppFooter.vue` now owns `ReportDialog` and the screen names; the dialog renders beside the `<footer>`, not inside it, or it inherits the footer's monospace type. The footer is pinned to the window's bottom on every page, so the pill floats in the same corner everywhere. A free-floating button over the page was rejected: the bottom-right corner is where each step's sticky action row (*Ẩn thông tin*, decision 0134) puts its primary button. Below 520 px the pill shows only the bubble, so it stays on the footer's line.

- A fifth kind, `idea` (*Góp ý hoặc đề xuất tính năng mới*), sits before `other` in `src/core/report.ts`, `landing/bao-loi.html` and the Worker's `reportKinds`. It is stored like any other report; `desktop/tests/report.test.mjs` already checks that all three lists match. When it is picked, the dialog's example text changes to a feature idea.
- The dialog and the page are titled *Báo lỗi hoặc góp ý*, and the question reads *Bạn muốn báo điều gì?*. The button stays *Mở trang báo lỗi*, the label the privacy policy names.
- **On the website**, the owner asked for the same button, highlighted: a cobalt (`--accent`) pill, *Báo lỗi / Góp ý*, `position: fixed` at the bottom-right of the homepage, install, privacy and blog pages (the blog template, so every post too), linking to `/bao-loi`. There a fixed button is safe: the only other pinned control is the centred download dock, which phones do not show. It is left off `/bao-loi` itself and the 404 page, and hidden when printing.
- The website also links the page from the homepage footer (*Tài nguyên*) and from the install and privacy pages' footers. The `noindex` is dropped so a search for OfflineMask feedback can find it.
- Nothing changes in what is sent or stored, or when, so `landing/privacy.html` keeps its date; only §9's pointer now names the button in the bottom-right corner instead of the sidebar.

GitHub issues and their templates remain for contributors; most users still have no GitHub account (decision 0147).
