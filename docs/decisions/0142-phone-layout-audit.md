# 0142 — Phone layout audit against Dia

Date: 25 October 2026. Status: implemented. Owner: "the landing page on desktop works great, now it's time to audit on the mobile, please study how diabrowser.com handles it on a small vertical screen".

## What Dia does on a phone

Read at 375 × 812 in the in-app browser: one column with small side gutters, a persistent pill header, the app screenshots at full width, the three numbered steps as screenshot, number, heading, copy, the features as stacked cards (pill label, copy, screenshot), one full-width black call to action repeated before the footer, a two-column mono link grid, and no horizontal overflow. Headings are 28–36 px, body about 17 px.

## What the audit found

The home page already stacks the same way (decision 0113): the story's steps are followed by their illustrations, the feature cards are one column, the footer is two columns, and nothing overflows sideways at 375 or 320 px. `install.html` and `privacy.html` are fine. Four things were wrong on the home page:

- **The download dock covered the footer's last line.** The dock hides from the download band "to the end of the page", but that end is measured when the page script starts. On a phone no platform is detected, so the script then opens the list of builds, which makes the page about 250 px longer than the measured end, and the dock came back over the copyright line and the big footer wordmark. Now opening or closing the list (`toggle` on the `<details>`) refreshes ScrollTrigger, and the dock stays away to the bottom.
- **The sample sheet scrolled sideways inside its card** and the phone's hidden scrollbar gave no hint of the third column. Phones already hid the row-number and amount columns; now the account column goes too, so Họ tên and Điện thoại fit in the card. The script still codes all three columns; the hidden one simply is not seen. The document peeking out behind the sheet poked past the card's edge; its offset and tilt are smaller on phones.
- **The role tabs were a horizontal scroller** with the third tab cut off at the edge and no fade or scrollbar to say so. They now wrap onto two rows (Chăm sóc khách hàng, Nhân sự / Kế toán, Pháp lý), as Dia stacks everything on a phone.
- **Scene breadcrumbs did not truncate** on 320 px phones because the flex item could not shrink; `min-width: 0` lets the ellipsis apply.

The hero window's "Bản gốc / Bản gửi AI" toggle is a touch larger on phones (12 px text, 27 px tall in a 36 px bar).

Not changed: the bottom dock stays (Dia has a top pill instead; the dock is the accepted download control), the privacy marquee between the two heading lines, and the section spacing.

## Follow-up the same day: smaller lockup and video button on phones

Looking at an iPhone SE capture, the owner asked whether the logo, buttons and type were too big. The headline (22 px), subtitle (16 px), wordmark (14vw) and dock match Dia's sizes at this width. Two things were oversized, and the owner chose to shrink them on phones only:

- **The top lockup** was a 228 × 64 px chip (52 px mark, 20 px name): the name at display size right above the hero's big wordmark, and tall enough to push the app window below the fold on a 667 px screen. On phones it is now a 44 px chip (36 px mark, 17 px name, 160 px wide). Wide screens keep the 64 px lockup from 0141.
- **The "Xem video" button** was 52 px tall with a 30 px play disc; on phones it is 44 px with a 28 px disc and 14 px text, still a comfortable tap.
- The hero's top padding drops from 112 to 88 px and the window's gap from 36 to 30 px, so on an iPhone SE the window's title bar reaches the first screen.

## Follow-up the same day: a phone layout of its own

The owner's second look at the iPhone SE capture: "the descriptions feel cramped", "what's the point of showing download button here on the mobile", "the desktop version is great, we get the ideas from it and feel free to re layout the mobile, if keeping 100%, it's hard for mobile users", "remember on mobile, we also have a big browser address bar". Phones (640 px and under) now differ from the wide layout in these ways:

- **Hero copy** is the rhyme alone, "Chưa hình dung ra? Xem qua vài chục giây là hiểu ngay!", at 17 px and a 1.55 line height; the video it points to explains the rest. The explaining sentence ("Ẩn thông tin riêng trước khi hỏi AI, nhận lại bản đầy đủ khi AI trả lời.") is wrapped in `.om-hero-lead`, shown on wide screens only. A first draft had kept the explanation and dropped the rhyme, with the video's length on the button; the owner preferred the rhyme ("the rhyme is back, that means remove the first sentence") and saw no reason for the length.
- **Hero window:** the whole app window is unreadable at 339 px, so on phones the two screenshots are cropped to the letter (a 4:3 stage, `object-fit: cover` at 70% 38%), where the codes can be read; the scan line still sweeps across. The 1280 px rendition is requested (`sizes` 170vw), since the crop shows about 55% of the image.
- **No dock.** A phone cannot install the app, so the pinned download button is gone. The download band itself is unchanged: its button and the list of Mac, Windows and Linux builds say what the app runs on, as the owner asked ("just show as they are"). A draft replaced the band on phones with a note and a "send the link to my computer" share button; it was removed on that instruction.

## Verification

In the in-app browser at 375 × 812 after the change: the dock has `om-hidden` from 200 px above the download band through the last scroll position, with the platform list open; the sheet's table is 275 px in a 291 px wrap and not scrollable, and the peeking document ends 19 px inside the card; the four role tabs sit on two rows inside the gutters; no horizontal overflow at 375 or 320 px; no console errors. At 320 px the breadcrumbs show an ellipsis; the sheet still scrolls a little inside its card there, which is accepted. At desktop width the sheet keeps all five columns. After the follow-up, at 375 × 667: the lockup measures 160 × 44 px, the video button 44 px tall, and the window bar starts at 587 px, inside the first screen; no horizontal overflow. `pnpm lint` passes. After the second follow-up, at 375 × 553 with the script running: the subtitle is the rhyme's two lines, the video button is 44 px, the scan stage 325 × 242 px loading the 1280 px rendition, the dock `display: none`, the download band's button and list present, no horizontal overflow and no console errors; `pnpm lint` and `pnpm -C landing build` pass. Not checked: a real phone or Safari.
