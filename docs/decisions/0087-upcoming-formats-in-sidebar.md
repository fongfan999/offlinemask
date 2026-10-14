# 0087 — PDF and images in the sidebar; home cards say what each is for

Date: 14 October 2026. Status: requested by the owner ("for pdf and images, I think putting to the sidebar with coming soon badges, feel free to design the homepage and sidebar a little bit to make it more relevant").

## Why

The home page's deferred-format row ("Định dạng · Sắp có · PDF · Hình ảnh") sat below everything, apart from the navigation it previews. The cards listed file formats ("Excel, ODS, CSV", "Word, ODT") rather than what people bring to them. As the formats grew (0076, 0078, 0084–0086), the cards read like a file-type list.

## Decisions

- **Sidebar.** PDF and Hình ảnh follow Tài liệu in the format list, with new `pdf` and `image` icons and the shared "Sắp có" badge. They are disabled buttons, faded, with no hover state and an accessible name such as "PDF, sắp có". They show what is coming in the place it will appear, without leading anywhere. This replaces the home page's coming-soon row, which is removed together with its styles.
- **Home cards.** Each card states its use first, with the file types it opens on a quiet monospace line below:
  - Văn bản: "Email, tin nhắn" / "Dán vào, TXT"
  - Bảng tính: "Sao kê, danh sách" / "XLSX, XLS, ODS, CSV"
  - Tài liệu: "Hợp đồng, báo cáo" / "DOCX, ODT"

  The descriptions are kept short so the three cards stay one line each and above the fold ([0066](0066-home-page-honest-and-compact.md)).
- **Not changed.** The hero line, illustration, start heading and pack notice stay as accepted. Naming file types in the hero ("trong văn bản, bảng tính và tài liệu") was tried. It wrapped the hero to two lines and pushed the cards down, and the cards already say it.

## Verified

`pnpm lint`, `pnpm typecheck` and `pnpm test` (257) pass. In the in-app browser:
- at 1024 × 768, in dark and light, the three cards are 104 px tall with no wrapping, and the pack notice ends at 637 px;
- at 375 × 812, the drawer shows the faded PDF and Hình ảnh items with badges, both disabled, and there is no horizontal overflow.
