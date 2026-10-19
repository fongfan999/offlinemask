# 0105 — Portable product landing page

Date: 20 October 2026

## Request and decision

The owner requested a modern landing page with GSAP animation, intended for future reuse at `wotdafong.dev/products/offlinemask` in the Astro/EmDash blog, then specified Cloudflare Workers as the deployment target.

Build a separate static website in `landing/` with the existing Vite toolchain. A build-time HTML fragment, scoped CSS and framework-independent initializer form the portable page; standalone metadata and hosting configuration are separate. The accepted desktop UI is unchanged. The existing theme definitions move verbatim from `src/style.css` to `src/theme.css`, imported by both standalone shells. Keep Vietnamese copy, the paper/ink/cobalt theme, the brush mask mark and truthful product limits.

The page uses a synthetic interactive masking/restoration illustration, three workflow steps, supported formats, local privacy behavior, native FAQ disclosures and GitHub release links. It accepts no input, persists nothing and loads no models. It advertises no accuracy, anonymity or unverified platform guarantee. All content is readable without JavaScript; demo controls appear only after initialization. Animation is transform-based, respects reduced motion and has explicit cleanup for reuse.

## Dependencies and hosting

- GSAP 3.15.0, the npm `gsap` package from GreenSock; Standard GSAP license, https://gsap.com/standard-license/. This is not the repository's O’Saasy license. Bundled locally for the marketing page only; no CDN, telemetry or animation-service requests. GSAP plus ScrollTrigger and page interaction initially total about 45 KB gzip. Desktop entry points do not import it.
- Wrangler 4.147.0, Cloudflare's official Apache-2.0 tooling, for static Workers preview/dry-run/deployment. Development dependency only. Its esbuild/workerd installation scripts are explicitly allowed in pnpm; native inference/image dependencies remain disallowed. Both existing lockfiles are preserved; only pnpm's lockfile changes because no Rust dependency changes.
- Cloudflare Workers Static Assets serves `dist-landing/`, with no runtime worker logic or storage. No fallback-to-index SPA routing and no app assets copied into the site. Observability is disabled.
- A separate GitHub workflow verifies the page on relevant changes and deploys only on manual dispatch with the deploy flag on main. It uses the verified artifact from that exact GitHub SHA. No push/deployment is implicit in adding this configuration.

The blog was inspected read-only: it already uses Astro/EmDash/GSAP and matching design tokens. Migration guidance explains the static route, trusted fragment, host metadata, main/chrome ownership and navigation cleanup. This task does not change the blog or its CMS data.

## Documentation consulted

Current Context7 docs for GSAP `matchMedia`, context cleanup and scoped selectors; Vite `transformIndexHtml` pre-order and static builds; EmDash custom Astro pages alongside CMS loaders; Cloudflare static-assets-only Workers and Wrangler configuration. See `landing/README.md` for integration and publishing instructions.

## Verification

- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm build` (including typecheck), and all 299 `pnpm test` cases pass.
- `pnpm landing:deploy:check` builds the isolated static bundle and passes Wrangler dry-run. Only HTML, CSS, JavaScript and the favicon are emitted; no desktop runtime/model assets.
- Local Wrangler runtime serves the homepage with HTTP 200 and an unknown path with HTTP 404. The initial current-date configuration was newer than bundled workerd; compatibility date is pinned to the supported 2026-10-01 baseline.
- Shared theme extraction was compared byte-for-byte with the previous combined app stylesheet and is equivalent.
- Visual browser review in Dia (desktop, system dark), plus in-app browser review at 390 px: no horizontal overflow, all internal fragment destinations exist, original/masked/restored demo controls work, keyboard activation works, and a FAQ opens with Enter. Reduced-motion behavior is implemented using documented GSAP media cleanup; OS preference switching was not manually exercised.
- App build retains existing crypto externalization, mixed JSZip import and chunk-size warnings. No native code/model changes; native packaged-app/model qualification was not rerun.
- No GitHub push, remote deployment, custom-domain binding or live EmDash integration performed.
