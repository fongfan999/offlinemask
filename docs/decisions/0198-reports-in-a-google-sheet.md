# 0198 — Reports are tracked in a Google Sheet

Date: 2 November 2026. Status: implemented; the Sheet is set up by the owner. Owner: "how do we manage these issues, my friends and I will view it"; "I'm looking for a simple (kanban) version to manage it, maybe use another platform like google sheets"; "google sheets"; "no need to backfill, no body use it yet".

## Problem

Reports from `/bao-loi` (decisions 0147, 0197) land in the `offlinemask-reports` KV namespace and nowhere else. Nothing notifies anyone, they can be read only in the Cloudflare dashboard or with `wrangler`, and nothing records whether one has been handled. The owner and a few friends want to read and triage them together.

## Options

- **Private GitHub repository, one issue per report.** Full tracker with a board view, but more than the owner wants.
- **Trello or Notion board.** A real kanban, each a new service with its own token.
- **Google Sheet.** Chosen by the owner: everyone already has it and shares it like any Sheet. It has no kanban view, so the Sheet builds one from formulas.

## Decision

- **The Worker** (`landing/worker.js`) still stores each report in KV first. Once the visitor has their answer, `copyToSheet` posts the same fields (time, kind, message, version, OS, screen) and the KV key to the Sheet, with a shared secret. Nothing about the sender goes, as before. It runs only when both secrets are set; a failure leaves the report in KV and the visitor never sees it.
- **The Sheet** runs `landing/reports-sheet.gs` as an Apps Script web app. It checks the secret, skips a key it already has, prefixes text that would start a formula, and appends a row with *Trạng thái* = *Mới*. The script holds no Google credentials beyond its owner's own deployment, and the Worker holds none at all.
  - **Phản hồi**: one row per report: time, kind, message, version, OS, screen, *Trạng thái* (dropdown: Mới, Đang xem, Đang sửa, Xong, Bỏ qua, coloured), *Người xử lý*, *Ghi chú*, key.
  - **Bảng**: the board: one column each for Mới, Đang xem, Đang sửa and Xong, newest first, as "Góp ý · 02/11 · message". Changing a row's *Trạng thái* moves its card.
- `landing/privacy.html` §7 says reports are copied to a private Google Sheet that the maker and a few helpers read, under Google's policy; the date moves to 2 November 2026. `desktop/tests/privacy-contract.test.mjs` pins that sentence and what the Worker sends; `desktop/tests/report.test.mjs` checks the copy, that nothing goes without the secrets, and that a failed copy is harmless.
- No backfill: nobody had used the report page yet.

## Setting it up (owner)

1. Create a Google Sheet, share it with the friends who triage (editors), keep general access *Restricted*.
2. *Extensions → Apps Script*, replace the code with `landing/reports-sheet.gs`, save.
3. *Project Settings → Script properties*: add `SECRET` with a long random value, for example from `openssl rand -hex 32`.
4. In the editor, run `setup` once and grant access. It creates *Phản hồi* and *Bảng*.
5. *Deploy → New deployment → Web app*: execute as **me**, who has access **Anyone**. Copy the `/exec` address.
6. Give the Worker both values, then deploy the landing (a push to main):

   ```sh
   mise exec -- pnpm -C landing exec wrangler secret put REPORTS_SHEET_URL
   mise exec -- pnpm -C landing exec wrangler secret put REPORTS_SHEET_SECRET
   ```

7. Send a test from `offlinemask.com/bao-loi` and check that a row arrives. Delete it afterwards.

Changing `reports-sheet.gs` later means pasting it again and *Deploy → Manage deployments → Edit → New version*, which keeps the same address.

## Limits

- Anyone with the web app address and the secret can add rows; both live only in the Worker's secrets and the script's properties.
- Apps Script allows roughly 20,000 calls a day on a personal account, far above the KV write limit that already caps reports (decision 0147).
- Sheets sends no notification for a new row; turn on *Tools → Notification settings* in the Sheet for an email when it changes.
