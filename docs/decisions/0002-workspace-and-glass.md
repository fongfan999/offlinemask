# 0002 — Format home, session navigation, and CSS glass surfaces

Status: Accepted as the boilerplate baseline, 9 September 2026. The owner will provide page-by-page feedback; this is not final design approval. See [product direction](../product-direction.md).

## Context and decision

The user requested a straightforward liquid-glass interface, a blue palette without purple, Text and Excel entry points, and a left sidebar with reopenable sessions similar to conversation history. The user also specified that OfflineMask will be open sourced and should follow standard, maintainable practices.

The home page presents Text and Excel. Other formats appear as noninteractive coming-soon labels. The sidebar contains format navigation and history; conversion controls stay in one workspace. Each explicit masking action creates a distinct session. Returning to a session restores its format, original/modified views, and individual keep/mask choices. Editing choices updates that session. Merely opening a format does not create history.

Both flows currently operate on synthetic fixtures. Excel has an interactive table and tab-separated clipboard output, not file import/export. Browser and desktop histories are separate local application origins.

## Glass implementation

No third-party glass library is installed. Standard CSS `backdrop-filter` supplies blur over translucent surfaces, with the prefixed WebKit form and an opaque fallback. Shared variables and the `.glass` class define fill, border, shadow, and blur consistently. The background consists of static blue/white gradients, without blurred decorative DOM layers. Filters are not animated; reduced-transparency preferences remove blur, and reduced-motion preferences remove transitions.

This is a CSS interpretation of liquid glass, not Apple's native Liquid Glass material or a physical refraction implementation. A library would not itself establish speed or visual equivalence across webviews. The blur budget is reduced from 36px to 20px; actual GPU cost and target hardware budgets remain unmeasured. Introducing a component library remains a separate decision if interaction complexity warrants it.

Reference: [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter). Official Vue documentation was queried via Context7 for [reactive state and side effects](https://vuejs.org/guide/essentials/watchers); this implementation uses explicit persistence at mutation boundaries rather than an unbounded deep watcher.

## Sample persistence boundary

`src/core/sessions.ts` defines versioned, validated records: random session ID, ordinal, format, fixed fixture ID, timestamp, and known mask/keep choices. Only this allowlist is serialized to localStorage. No raw originals, output copies, custom titles, or arbitrary input are saved. Output is reconstructed from the bundled fixture version. Invalid/unsupported history is reported and left intact rather than overwritten. Save failure leaves the open sessions usable and visibly reports that they are not saved.

This storage is appropriate only for public demo fixtures. It is not encrypted private storage, restoration, backup, or cloud sync. The production vault design remains required before persisting private input. Future fixture changes require explicit compatibility or migration handling.

## Open-source requirement

Use conventional Vue/TypeScript modules, semantic HTML, shared CSS tokens, pinned toolchains, lockfiles, documented dependencies, focused tests, and contributor instructions. The official Tauri scaffold provenance remains recorded in the development guide. License selection and attribution review are pending owner decisions before publication; this decision does not select or grant a license. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
