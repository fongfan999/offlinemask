# 0194 — The intro video follows the app

Date: 1 November 2026. The owner: "the app has been updated a lot, please review the app and update the introduction video."

## What was reviewed

The film behind `landing/media/offlinemask-intro.mp4` is a Motion artifact ([0113](0113-landing-product-page-with-real-screens.md), the cut in [0175](0175-ninja-mascot.md)): seven scenes whose code lives in the artifact's store, not in this repository. Each was read against the app as it is on `main` (2.5.0 and the unreleased scanning work):

- **The problem, the slogan, Ẩn nhanh in the AI tool, the AI's reply.** Still right. The OfflineMask circle shows in AI tools ([0135](0135-circle-only-where-ai-is.md)), and the message is masked there.
- **Restore in Word with the circle.** Wrong since 0135: outside AI tools the selection is not read and the circle never appears. Restoring an AI answer pasted into Word goes through ⌘⇧M (Ctrl+Shift+M), which works everywhere.
- **"Ẩn cả tệp Excel, Word."** Text PDFs open since 2.3.0 ([0149](0149-text-pdf-documents.md)) and whole folders since 2.5.0 ([0171](0171-mask-a-whole-folder.md)); neither was in the film.
- **End card.** The logotype swipe ([0193](0193-logotype-swipe.md)) was already in the film's end scene, but the MP4 on the website, exported on 30 October, still shows "Mask" as plain light-cobalt letters.
- **Left out on purpose.** Scanned PDFs and pictures ([0180](0180-scanned-pdfs-and-images-read-on-the-machine.md), [0191](0191-windows-reading-opened.md)) are not released yet, so the film does not promise them; the app's new home and sidebar ([0172](0172-sidebar-by-task.md)) are not shown because the film stays in the viewer's own applications by design ("Vẫn ứng dụng quen"), as the earlier cuts did.

## What changed in the film

- **Restore scene ("Back where you work").** The circle is gone. After the reply is selected in the Word window, three keycaps, ⌘ ⇧ M, pop up on a cobalt pill beside the end of the selection, press, and become the check mark as the codes turn back into the real name and numbers. The pointer stays at the end of the selection. The line below reads "Câu trả lời của AI còn mã. Bôi đen, bấm ⌘⇧M là có lại tên thật." The keycaps reuse the button gesture's parts, so the timing of the scene is unchanged.
- **Files shot.** "Ẩn cả tệp Excel, Word, PDF." over the same spreadsheet.
- **New shot, "Cả thư mục một lượt."** A folder window "Hồ sơ khách" lists Sao kê T10.xlsx, Hợp đồng thuê nhà.docx, Hóa đơn 0412.pdf and Danh sách khách.csv, the kinds the folder page takes; each file's "Chờ" becomes "Đã ẩn" in turn, with the folder page's own words, and the title becomes "Hồ sơ khách (OfflineMasked)", the copy's name ([0150](0150-offlinemasked-suffix.md)). The rhythm scene is now five shots of three beats (9.375 s instead of 7.5 s), so the film is 37.6 s instead of 35.7 s, and the end card lands on the downbeat of bar 13 of the score. The groove runs one bar longer, a kick marks the fifth cut, and the folder's files pop with a soft chime as the copy is saved.
- Everything before 18.7 s is untouched, so the poster (the slogan at 7.2 s) stays.

## Checked

The film's own player was run headless with Chrome from the type's render-offline recipe (the page's `index.html`, `app.js` and `app.css`, the store's modules and assets copied into a scratch folder), and stills were rendered at 0, 7.2, 20.2, 21.0, 21.65, 22.1, 23.0, 24.6, 26.3, 27.0, 27.35, 28.2, 30.5, 32.3 and 35.7 s: the keycaps sit beside the selection and clear the text (a first draft centred on it covered the last words), the folder's states and title flip as written, the end card shows the swipe, and the runner logged no error. Offline the Google face is not fetched, so only layout was judged, not spacing.

## Export

A video file comes only from the film page's Export. The owner exported the new cut on 1 November 2026 over `landing/media/offlinemask-intro.mp4` (37.65 s, 1920×1080, 30 fps, H.264 with AAC, 4.25 MB; the previous file was 35.78 s and 3.97 MB). Frames taken from the file at 7.2, 21.65, 27.35 and 36 s show the unchanged poster, the keycaps beside the selection, the saved folder and the end card with the swipe. The poster, the worker's byte ranges and `desktop/tests/landing-downloads.test.mjs` need no change. When scanning is released, the files shot's line is the place to say that pictures and scans are read too.
