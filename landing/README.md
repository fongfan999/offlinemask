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

The Worker is named `offlinemask-landing`; `landing/wrangler.jsonc` has no account identifier, custom domain or secrets. The static assets require no Worker script, storage binding or application server. Observability is disabled. No analytics or remote runtime assets are included.

The repository's local-first release policy applies:

1. Implement, verify and commit in the primary workspace.
2. With authorization, compare and reconcile the primary workspace and GitHub `main`, then push the verified commit.
3. Configure GitHub's `production` environment with `CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN` allowed to deploy Workers for that account. Do not commit credentials.
4. Run the **Landing page** workflow on `main`, selecting **deploy**. Its verify job builds and dry-runs the selected revision. Its deploy job consumes the exact uploaded static artifact for that SHA, then publishes it through Wrangler.
5. Verify the workflow, returned workers.dev URL, served HTML and asset hashes against the selected commit. Attach a custom domain through Cloudflare only when its destination is agreed.

Pushes and pull requests run verification only. They never deploy automatically. `pnpm -C landing deploy` is available for a maintainer's explicit manual deployment, but must not bypass the project's GitHub deployment order without an authorized exception. `product.html` names the release only as `__OM_VERSION__`; the build replaces it with the version in `desktop/package.json`, so per-platform links and `SHA256SUMS.txt` point at that release's assets. Deploy the page after the matching GitHub release is published. Without JavaScript, or on Linux and phones, the main button opens GitHub's latest release; on macOS and Windows `product.js` points it at the visitor's installer.

## Reuse in the Astro / EmDash site

The host repository currently uses Astro, EmDash and GSAP. No Vue integration, iframe or CMS migration is needed for this page.

- `product.html` is the authoritative static, trusted source fragment, with a namespaced root, header, main and footer. It is injected **at build time**, so headings, links and FAQs remain available without JavaScript.
- `product.css` scopes its rules to `om-` classes. It imports the existing product mark and `fonts.css`: self-hosted Noto Sans normal and Noto Serif italic, with Latin and Vietnamese subsets from pinned Fontsource 5.3.0 packages. Font licenses are emitted into the build as `font-licenses.txt`. The bundled fonts add about 117 KB uncompressed and make Vietnamese letterforms independent of system fonts.
- `product.js` exports `initOfflineMask(root)`. It scopes animations/listeners to that root and returns a cleanup function. GSAP uses `matchMedia` to disable motion when reduced motion is requested, including preference changes.
- `demo.js` holds the four fictional walkthrough stages: original, masked and reviewed, prewritten AI reply, and restored reply. Playback runs once, either when requested or the first time the example scrolls into view if the visitor has not touched it; any control stops it, as do a hidden document and a reduced-motion preference. Values pass to and from their aliases through GSAP ScrambleTextPlugin, part of the same `gsap` package. Direct stage buttons remain available with reduced motion. This is a workflow illustration, not a recognition engine or an AI connection.
- The "Cách hoạt động" section holds a static boundary illustration (masked copy beside the AI, lookup table on the device). On wide screens without reduced motion, `product.js` pins it and scrubs the round trip with scrolling; otherwise it stays static. Format previews sweep their redaction marks in once on view.
- `main.js`, `standalone.css`, `index.html`, the Vite config and Wrangler config belong only to the standalone host.
- `og/card.html` is the source of the 1200×630 share image `og/og.png`, using the same pinned fonts. After editing it, re-render from `landing/og/` with Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --window-size=1200,630 --screenshot="$PWD/og.png" "file://$PWD/card.html"`. Share crawlers need an absolute `og:image` URL, so prefix the production domain once it is chosen.
- `brand/theme.css` contains the existing app's exact shared palette and font tokens, extracted without changing their values. The wotdafong host already uses this palette; supply those theme variables there instead of importing desktop styles.

For migration, replace `__OM_VERSION__` in the fragment at build time as the Vite config does, and vendor `product.html`, `product.css`, `fonts.css`, `font-licenses.txt`, `product.js`, `demo.js` and the referenced `brand/mark-mono-black.svg` together, preserving relative asset paths (or update the single CSS URL). Install `@fontsource-variable/noto-sans@5.3.0` and `@fontsource-variable/noto-serif@5.3.0` in the host, retain their license notice in the published assets, and keep the typography overrides scoped to `.om-page`. Add an Astro route at `src/pages/products/offlinemask.astro`. Import the trusted fragment with `?raw`, render it using `<Fragment set:html={productHtml} />`, and import the CSS and initializer in Astro's bundled script. Do not inject CMS or user HTML through this raw-fragment boundary.

Use a product document layout with `lang="vi"`, the page's title/description and the live destination's canonical URL. The existing blog `Base.astro` includes its own `<main>`, navigation and footer, so do **not** wrap this full fragment in it unchanged. Either use a product layout retaining the site's `EmDashHead`, `EmDashBodyStart`, `EmDashBodyEnd` and `createPublicPageContext` integration, or split the fragment's outer chrome from its product sections when adopting the blog chrome. Leave EmDash's generated environment types, content loaders and database alone.

With Astro client navigation, call the returned disposer on `astro:before-swap`, then initialize the new root on `astro:page-load`. With ordinary document navigation, a single initialization is sufficient. The host already depends on GSAP, so reuse its installed version rather than loading a CDN copy.

Before publishing at the future URL, verify the page inside the host's actual layout, set canonical/Open Graph URL metadata, and decide whether to redirect the standalone domain. No future URL is advertised as live now.
