# 0192 — A long history shows a page at a time and can be searched

Date: 31 October 2026. The owner noted that with a passcode, a day or a week of work leaves a long list in the sidebar, and asked for paging with a "load more" button and a search.

## What

- **A page at a time.** "Lịch sử" shows the newest 30 entries. "Xem thêm", with how many remain, adds the next 30 at the end of the list. Searching, or locking and unlocking, starts again from the first page.
- **Search behind a magnifier.** With a passcode and at least one entry, a magnifier sits at the end of the "Lịch sử" heading. It opens a field above the list; Escape or the close icon clears it and shows the whole list again. Without a passcode the list holds at most one entry per kind, so there is nothing to search.
- **What is searched.** The entry's title ("Tài liệu #4"), its date as shown, its file name, a text's original and masked copy, and the values hidden in a file. At first hidden values were left out, so a name never pointed to the entry that held it; the owner asked for them, since finding the entries about one customer is what search is for, and the history is already unlocked by its owner. Accents and case are ignored ("hop dong" finds "Hợp đồng") and every word must appear, in any order.
- **Nothing new is stored.** The vault is already decrypted in memory once unlocked; paging and search only change what the sidebar draws. Storage, the vault format and what leaves the machine are unchanged, so `landing/privacy.html` is too.
- **Made-up history for trying it.** Dev builds only (`import.meta.env.DEV`, absent from the production bundle): with history unlocked, `offlinemaskSeed.add(80)` in the dev tools console adds invented texts, Word documents and spreadsheets over the last seven days, saved into the vault like real entries; `offlinemaskSeed.clear()` removes exactly those (their ids end in `5eed5eed5eed`).
- **Test.** `history-search.test.mjs` covers accents, word order, the date and that a hidden value finds its entry, in texts and in files.
