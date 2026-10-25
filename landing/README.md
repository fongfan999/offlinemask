# OfflineMask landing page

A standalone Vietnamese product page, prepared for Cloudflare Workers Static Assets and later reuse at `wotdafong.dev/products/offlinemask`. It does not load the desktop application, recognition models, Tauri, Vue or private user input. The interactive example contains fictional data only.

## Local development

From the repository root, use the versions pinned by mise:

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm -C landing dev
mise exec -- pnpm -C landing build
mise exec -- pnpm -C landing preview
mise exec -- pnpm -C landing workers:dev
mise exec -- pnpm -C landing deploy:check
```

Development serves port 4322. `preview` previews the production build. `workers:dev` builds and serves using the local Workers runtime. `deploy:check` builds and runs Wrangler's dry run without publishing. Build output goes to `landing/dist/`; the desktop app under `desktop/` and its release workflow are separate. Unknown production paths return 404, rather than pretending to be a SPA route.

## Cloudflare deployment

The Worker is named `offlinemask-landing` and serves https://offlinemask.com (and `www`) as custom domains declared in `landing/wrangler.jsonc`; the file holds no account identifier or secrets. The static assets need no storage binding or application server; the small Worker below only answers the download paths. Observability is disabled and the page loads no analytics script or remote runtime assets. The Worker counts each `/download/<platform>` in the `offlinemask_downloads` Analytics Engine dataset, with platform and country only (decision 0144); Cloudflare's own zone analytics shows visits.

The Cloudflare project is connected to this GitHub repository, so **pushing to `main` deploys the page**. Treat a push as a release of the website: implement, verify and commit in the primary workspace, then push only with the owner's authorization. The **Landing page** GitHub workflow only verifies (lint, build and a Wrangler dry run) on pull requests and pushes that touch the page; it never deploys. `pnpm -C landing deploy` remains for an explicitly authorized manual deployment. After a deploy, check the served HTML and asset hashes against the pushed commit.

Downloads never send a visitor to a GitHub page (decisions 0139, 0140). `worker.js` is the site's only server code: it answers `/latest.json` (newest version, its day from that tag's `CHANGELOG.md`, and the download paths) and `/download/<platform>` (a redirect to the file), from `SHA256SUMS.txt` of the newest **published** GitHub release, reused for five minutes per Cloudflare location. Publishing a release updates the live page within minutes, with no deploy; a draft is ignored. Every other path is a static asset and never runs the Worker (`run_worker_first` in `wrangler.jsonc`). The page writes the version that was newest at build time (`__OM_VERSION__`, `__OM_RELEASE_DATE__`; offline builds fall back to `desktop/package.json`), and `latest.js` replaces it from `/latest.json` once the script runs. The Vite dev server answers the Worker's paths with the same module; `desktop/tests/landing-downloads.test.mjs` covers it. Windows links to the Store listing `__OM_STORE_ID__` from `desktop/store/microsoft-store.json`. On macOS and Windows `product.js` points the main button and the dock at the visitor's download; elsewhere, or without JavaScript, they lead to the list of downloads, which starts open.

## Reuse in the Astro / EmDash site

The host repository currently uses Astro, EmDash and GSAP. No Vue integration, iframe or CMS migration is needed for this page.

- `product.html` is the authoritative static, trusted source fragment, with a namespaced root, header, main and footer. It is injected **at build time**, so headings, links and FAQs remain available without JavaScript.
- `product.css` scopes its rules to `om-` classes. It imports the existing product mark and `fonts.css`: self-hosted Noto Sans normal and Noto Serif italic, with Latin and Vietnamese subsets from pinned Fontsource 5.3.0 packages. Font licenses are emitted into the build as `font-licenses.txt`. The serif italic is a weight-400 cut kept in `fonts/` (decision 0120); the four files add about 71 KB and make Vietnamese letterforms independent of system fonts.
- `product.js` exports `initOfflineMask(root)`. It scopes animations/listeners to that root and returns a cleanup function. GSAP uses `matchMedia` to disable motion when reduced motion is requested, including preference changes.
- `shots/` holds WebP screenshots of the real desktop app, taken from its web build with only the built-in sample text, spreadsheet and the fictional AI reply in `scripts/capture-app-shots.mjs`. Recapture them when the app UI changes. The page says they are real screens with sample data.
- The hero intro (wordmark letters, the app window rising, sticker and floating code chips) is CSS so it starts with the first paint; `main.js` loads `product.js` only after the page has painted (decision 0120). `product.js` adds the chips' redaction scramble through GSAP ScrambleTextPlugin and the idle drift, switches the sticky story screenshots as steps scroll past, hides the bottom download dock over the download section, and animates the privacy diagram. All of it is static with reduced motion, and the story falls back to inline screenshots below 860 px.
- `privacy.html` (with `privacy.js` and `privacy.css`) is a second standalone page, served at `/privacy`; the Vite build lists both pages as inputs. Keep it in step with the app: it states what is stored, where, and when the app uses the network.
- `main.js`, `standalone.css`, `index.html`, the Vite config and Wrangler config belong only to the standalone host.
- `og/card.html` is the source of the 1200×630 share image `og/og.png`, using the same pinned fonts. After editing it, re-render from `landing/og/` with Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --window-size=1200,630 --screenshot="$PWD/og.png" "file://$PWD/card.html"`. The build emits it unhashed as `/og.png`, and `index.html` references it as `https://offlinemask.com/og.png`, with a matching canonical and `og:url`.
- `search.js` builds what crawlers read (decision 0145): the home page's JSON-LD (`SoftwareApplication` plus a `FAQPage` read from the FAQ in `product.html`, so editing a question updates it), `/sitemap.xml` and `/robots.txt`. Add a new page to `pages` there.
- `brand/theme.css` contains the existing app's exact shared palette and font tokens, extracted without changing their values. The wotdafong host already uses this palette; supply those theme variables there instead of importing desktop styles.

For migration, replace the `__OM_…__` tokens in the fragment at build time as the Vite config does, keep `/latest.json` and `/download/*` reachable on the host (route them to this Worker, or port `worker.js`), and vendor `product.html`, `product.css`, `fonts.css`, `font-licenses.txt`, `product.js`, `shots/` and the referenced `brand/mark-mono-black.svg` together, preserving relative asset paths (or update the single CSS URL). Install `@fontsource-variable/noto-sans@5.3.0` and `@fontsource-variable/noto-serif@5.3.0` in the host, retain their license notice in the published assets, and keep the typography overrides scoped to `.om-page`. Add an Astro route at `src/pages/products/offlinemask.astro`. Import the trusted fragment with `?raw`, render it using `<Fragment set:html={productHtml} />`, and import the CSS and initializer in Astro's bundled script. Do not inject CMS or user HTML through this raw-fragment boundary.

The page has one, light theme: both standalone pages set `data-theme="light"` on `<html>`, which `brand/theme.css` honours over the system preference, and `product.css` has no dark rules. A host should render it with the light theme tokens. Use a product document layout with `lang="vi"`, the page's title/description and the live destination's canonical URL. The existing blog `Base.astro` includes its own `<main>`, navigation and footer, so do **not** wrap this full fragment in it unchanged. Either use a product layout retaining the site's `EmDashHead`, `EmDashBodyStart`, `EmDashBodyEnd` and `createPublicPageContext` integration, or split the fragment's outer chrome from its product sections when adopting the blog chrome. Leave EmDash's generated environment types, content loaders and database alone.

With Astro client navigation, call the returned disposer on `astro:before-swap`, then initialize the new root on `astro:page-load`. With ordinary document navigation, a single initialization is sufficient. The host already depends on GSAP, so reuse its installed version rather than loading a CDN copy.

Before publishing at the future URL, verify the page inside the host's actual layout, set canonical/Open Graph URL metadata, and decide whether to redirect the standalone domain. No future URL is advertised as live now.
