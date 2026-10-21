# 0113 — Landing page in the spirit of Dia, with real app screens

Date: 2026-10-20

## Context

The owner judged the 0112 "redaction desk" page still not good enough, citing all four of: too plain, no real product shown, message unclear, motion weak. They asked for a page like https://www.diabrowser.com/ in the product's own colours. On the same day offlinemask.com went live through Cloudflare's GitHub integration, so pushes to `main` now deploy the page (see `landing/README.md`).

Dia's page was studied in the browser. Its language is:
- a full-bleed painterly colour field holding a huge serif wordmark, with the real app window rising out of it and a playful sticker;
- a floating pill navigation and a download button pinned to the bottom of the screen;
- sections that tell the story with a sticky product window next to numbered steps;
- light serif display headings on paper and simple labelled feature cards.

## Decision

- **Real product imagery.** The page shows four screenshots of the actual app (`landing/shots/`), captured from the desktop web build using only its built-in sample text and spreadsheet, plus a fictional AI reply typed into the restore step (`landing/scripts/capture-app-shots.mjs`). A caption says they are real screens with sample data. The document sample was left out because its account number, written "tài khoản số …", is not masked by the current rule. That detection gap is reported to the owner separately.
- **Hero:** a cobalt wash replaces Dia's gold. It is layered radial gradients, slow-drifting blurred blots and film grain, all in the cobalt family with a paper highlight (no purple or lavender). Above sit the tagline as the `h1`, a giant upright and italic Noto Serif "OfflineMask" wordmark, and one explanatory line. The app window rises over the edge of the wash, with a warm starburst sticker "Chạy offline" and two floating chips that show a value struck through beside its code.
- **Navigation and download:** a centred glass pill nav, with a "Tải về" pill once the hero scrolls away. An ink download dock is pinned to the bottom and hides over the cobalt download band. Both use the platform-aware link from 0110.
- **Story:** "Ẩn trước khi hỏi. Đổi lại khi có câu trả lời." Three numbered steps scroll past a sticky app window that switches between the original, masked and restored screens.
- **Feature cards** in Dia's labelled-pill style: Bảng tính (with a screenshot), Tài liệu, Nhận diện, Lịch sử mã hóa, Không tài khoản, Tự kiểm chứng.
- **Kept:** the privacy boundary diagram, the FAQ, and a cobalt download band with every installer, checksums and the install guide.
- **Typography:** upright Noto Serif is added (pinned Fontsource 5.3.0 files, same licence) for display headings, alongside the existing italic.
- **Motion** is built with GSAP and respects reduced motion: wordmark letters rise, the window lifts into place, the sticker pops and the code chips scramble out of redaction blocks, then drift gently. The wordmark sinks on scroll, sections reveal, and the boundary codes slide across.
- `demo.js` and the scripted hero document from 0112 are removed; the real screens replace them.

No telemetry, storage or runtime network requests are added. The page grows by about 320 KB of WebP images (lazy-loaded below the hero) and about 60 KB of serif fonts.

## Verification

`pnpm lint` and `pnpm -C landing build` pass. Scroll-through captures with Chrome DevTools at 1440×900 (light and dark) and 390×844 confirmed several things. The hero intro plays. The story window switches with the active step. The dock hides over the download band. The phone layout stacks the story with inline screenshots, and there is no horizontal overflow at 390 px. Safari and real devices were not exercised.

## Follow-up — copy and polish before the first production push

The owner gave full freedom over copy and design before rolling out to offlinemask.com.

- **One idea throughout:** "AI không cần biết khách hàng của bạn là ai." It is the `h1`, the page title and the share image. Section headings were rewritten to match: "Ba bước. Tất cả trên máy bạn.", "Thứ AI thấy. Thứ ở lại với bạn.", "Hỏi AI thoải mái. Giữ khách hàng cho riêng bạn."
- **Hero scan:** the hero window holds the original and masked screenshots of the same sample session. A cobalt scan line sweeps across, revealing the masked screen over the original, while the hero is on screen. The "Bản gốc / Bản gửi AI" toggle in the title bar stops the loop and shows either screen; it also works with reduced motion, where nothing loops.
- **New "Vì sao" section:** "Hôm nay bạn đã dán gì vào ChatGPT?" Four role-based prompts (HR, accounting, customer support, legal) carry warm-highlighted values that scramble into codes as each card is read, then the line "AI vẫn làm đúng việc đó. Chỉ là không biết đó là ai." The values are fictional and limited to types the app suggests. A note says names need the optional Vietnamese pack or manual selection. The data-handling sentence is hedged ("tùy dịch vụ và cài đặt") rather than naming any provider.
- **Footer:** columns for product, resources and author, over a large pale wordmark.
- **Share image:** `landing/og/og.png` is re-rendered from `og/card.html` in the new hero style.
- **Hero badge and screenshots (October 2026):** the sticker is now a light-cobalt starburst with a shield-and-check icon over "OFFLINE" in spaced sans capitals. The warm orange is kept for marking real private values, so each colour means one thing. The hero and story screenshots come from the desktop app with the Vietnamese recognition pack, so the fictional name is masked as well. The capture steps are in `landing/scripts/capture-app-shots.mjs`. The hero caption was removed.
- **"Vì sao" section, redesigned (October 2026):** the four prompt cards and the closing line are replaced by one "Tin nhắn gửi AI" box under the rhyming heading "Việc gì cũng nhờ AI. Tên ai cứ giữ lại." Role tabs (Nhân sự, Kế toán, Chăm sóc khách hàng, Pháp lý) play in turn while the box is on screen. In each, the highlighted values scramble into codes, the status changes from "Có N thông tin riêng trong tin nhắn" to "Đã ẩn N thông tin riêng", and the send button turns cobalt. Choosing a tab stops the autoplay. With reduced motion nothing plays and each request is shown already coded. Without the script, all four requests are listed. The values stay fictional, and the pack caveat moved out of this section.
- **"Cách hoạt động" section, rebuilt (October 2026):** modelled on diabrowser.com's feature list. The left column is a compact list of three steps ("Ẩn thông tin riêng", "Hỏi AI như mọi khi", "Nhận lại bản đầy đủ"). Only the active step shows its description, with an ink bar beside it. The right column shows one large illustration built in HTML instead of a screenshot, because shrunken full-app screenshots were unreadable:
  - the letter with five warm-highlighted values;
  - a generic AI chat (no product branding) in which both sides contain only codes;
  - the AI's reply with codes, above the full version with the real values back.
  On wide screens the stage is pinned for 280vh and the scroll position picks the step. Clicking a step title scrolls to it. With motion on, the highlights appear one by one, the AI reply arrives, and the codes scramble back into real values. On phones, and without the script, each step is followed by its illustration. The illustrations use the same fictional values and codes as the hero screenshots. `landing/shots/text-restored.webp` is no longer used and was removed.- **Smoother "Cách hoạt động" scroll:** the step list and the illustrations are anchored to the top of the pinned stage instead of centred. Opening a step's description now only moves the titles below it, and no longer shifts the whole list while the page scrolls. Measured in headless Chrome, scrolling through the section runs at a steady 60 fps, and the first title moves at most 1px while pinned.
- **One section instead of two (October 2026):** the "message to AI" box and "Cách hoạt động" showed the same masking one after the other, right after the hero and its video. They are merged: the rhyming heading "Việc gì cũng nhờ AI. Tên ai cứ giữ lại." and the subtitle with the inline wordmark now head the Dia-style steps (`#om-how`). The role tabs (Chăm sóc khách hàng, Nhân sự, Kế toán, Pháp lý) sit above the step list, and each role swaps the content of all three illustrations so one example runs from document to chat to restored reply. The other roles' content lives in `<template data-om-scenes>` blocks. Without the script, the default role is shown and the tabs stay hidden. The separate box, its autoplay and its styles were removed.
- **No gap under the heading:** the pinned stage is as tall as its content (about 505px) rather than a full screen with the content centred, which had left a large empty band between the subtitle and the role tabs. It sticks at `max(96px, 50vh − 260px)`, and the script maps the scroll from that offset to the section's end.
- **Scroll performance (October 2026):** the owner found scrolling uneven, also on production. The fixes target the usual costs on Retina Macs:
  - The floating nav and its download button drop their live `backdrop-filter` blur for a 96% opaque paper background. The blur re-filtered the page under them on every scroll frame.
  - The cobalt washes' drifting blots are soft radial gradients instead of `blur(70px)` discs, and they pause while their wash is off screen.
  - The pinned "Cách hoạt động" stage gets its own compositing layer.
  - Lazy screenshots decode asynchronously.
  In a 4× CPU-throttled headless benchmark of scrolling from the top to the features section, the worst frame fell from 167ms to about 65ms on a cold first pass, with a steady 60 fps afterwards. Headless Chrome cannot measure GPU compositing, so the owner's own browser is the final check.
- **Scroll-linked steps:** the owner found the pinned steps unsmooth to scroll. While pinned, nothing moved until the next step snapped in. A progress rail beside the list now fills with the scroll down through the open step and replaces the static ink bar. The active illustration drifts up to 8px with the scroll. The pin is shorter (240vh instead of 280vh). Both update every frame while pinned and are eased with `gsap.quickTo`. With reduced motion the rail is set directly and nothing drifts.
- **Native scrolling, like Dia (October 2026):** the pinned stage that swapped illustrations in place still felt unsmooth, so the section now works the way diabrowser.com's does:
  - Wide screens: the step list (with the role tabs and the progress rail) is `position: sticky` in column one, and the three illustrations form a normal column in column two that scrolls past natively, 16vh apart.
  - The step whose illustration crosses mid-screen opens, and the rail fills through it. Clicking a step scrolls its illustration to the centre.
  - Each illustration waits in its "before" state (no highlights, AI reply not yet arrived, codes not yet restored) and plays its entrance once on reaching mid-screen. Switching role primes them again.
  - Phones: the two columns dissolve (`display: contents` with `order`), so each step is followed by its illustration.
  The pinned height, the in-place swapping and the card drift were removed. The sticky layout also works without the script; it then shows every step's description.
- **Step list polish:** the rail no longer fills cumulatively, which made earlier steps look active. An ink bar spans only the open step and glides to the next. Closed titles are muted at full opacity (about 6:1 contrast instead of about 3:1), titles are 22–26px instead of 24–30px, and the open step's number turns cobalt. The descriptions are tighter, and step 2 now says that AI only sees codes: "Dán văn bản hoặc mở tệp. OfflineMask tô sáng tên, số điện thoại, số tài khoản… để bạn xem lại rồi ẩn." / "Sao chép bản đã ẩn sang AI bạn hay dùng. AI chỉ thấy mã, nhưng vẫn đủ ý để giúp bạn." / "Đưa câu trả lời của AI vào OfflineMask. Mọi mã tự đổi về thông tin thật, ngay trên máy bạn."
- **Ẩn nhanh leads "Tính năng" (October 2026):** quick masking ([0096](0096-selection-popover.md), [0098](0098-quick-discovery.md)) was the last small card. It is now the full-width first card:
  - Heading "Bôi đen ở đâu, ẩn ngay ở đó." with a short explanation.
  - A note that it works on macOS and Windows, is switched on in Cài đặt › Thao tác nhanh, and that ⌘⇧M works on copied text.
  - An HTML illustration of "Ứng dụng bất kỳ" that loops while on screen: a request is selected, the round OfflineMask button appears after the selection and is clicked, and the values become codes in place. The AI reply's codes are then selected and restored the same way. With reduced motion it holds the moment before the click.
  It is not a fourth step: the three steps stay the mental model, and one line under them ("Nhanh hơn: bôi đen chữ trong bất kỳ ứng dụng nào để ẩn ngay tại chỗ. Xem Ẩn nhanh") links down to the card. "Không tài khoản" spans two columns to close the grid.
- **Smooth step open/close:** the owner found the collapse and expand laggy. The descriptions animated `grid-template-rows` (a full layout every frame), while the bar re-measured the steps every frame and eased after a moving target, so the two drifted apart. Now the script tweens the closing and opening descriptions between measured pixel heights. It computes where the bar ends up (the sum of the closed heads above, plus the open step's head and description) and tweens it with the same 0.45s `power2.inOut`. Nothing reads layout per frame, and the bar is recomputed only when ScrollTrigger refreshes on resize. With reduced motion the change is instant.
