# OfflineMask

Mask and restore sensitive data, entirely on your device.

OfflineMask is a planned cross-platform desktop tool for preparing sensitive information before using external AI. The initial focus is Vietnamese banking workflows, with an extensible design for other industries, languages, and file formats.

The MVP covers pasted text, CSV, supported Excel workbooks, user review, consistent aliases, encrypted local restoration mappings, and reusable rule packs and profiles. Required resources can be supplied locally, and the application operates without external network requests.

## Project status

Ready for initialization. The selected application stack is **Tauri 2 + Vue 3 + TypeScript + Vite**, with pnpm for frontend dependencies and a focused Rust layer for native integration.

Start with the [accepted stack decision and initialization handoff](docs/decisions/0001-desktop-stack.md). Application code has not been scaffolded yet.

See [the product requirements document](PRD.md) for scope, user journeys, acceptance criteria, and open decisions.

See [Tauri 2 versus Electrobun 2](docs/desktop-framework-comparison.md) for the supporting comparison and unmeasured performance questions.
