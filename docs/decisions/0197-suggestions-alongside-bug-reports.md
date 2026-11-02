# 0197 — Suggestions go through the bug report page, and the website links it

Date: 2 November 2026. Status: implemented. Owner: "users are complaining they don't see a place to report bugs or suggest new features".

## Problem

The report page from decision 0147 existed, but users still could not find it:

- The app's sidebar button already read *Báo lỗi hoặc góp ý*, but the dialog it opened was titled *Báo lỗi* and offered only problems (missed, wrong, crash, other). Someone with an idea for a feature saw nothing that fit.
- On the website, `/bao-loi` was marked `noindex` and linked only from the privacy policy, so a visitor could find it only by going through the app.

## Decision

- A fifth kind, `idea` (*Góp ý hoặc đề xuất tính năng mới*), sits before `other` in `src/core/report.ts`, `landing/bao-loi.html` and the Worker's `reportKinds`. It is stored like any other report; `desktop/tests/report.test.mjs` already checks that all three lists match. When it is picked, the dialog's example text changes to a feature idea.
- The dialog and the page are titled *Báo lỗi hoặc góp ý*, and the question reads *Bạn muốn báo điều gì?*. The button stays *Mở trang báo lỗi*, the label the privacy policy names.
- The website links the page from the homepage footer (*Tài nguyên*) and from the install and privacy pages' footers. The `noindex` is dropped so a search for OfflineMask feedback can find it.
- Nothing changes in what is sent or stored, or when, so `landing/privacy.html` stays as it is.

GitHub issues and their templates remain for contributors; most users still have no GitHub account (decision 0147).
