# 0120 — The landing page scores 100 on PageSpeed

Date: 22 October 2026. Status: requested by the owner ("make the landing page 4 100-points on mobile and desktop on google pagespeed").

## Problem

Lighthouse 13.5 on offlinemask.com scored mobile 81/97/100/100 and desktop 94/97/100/100 (performance, accessibility, best practices, SEO). Accessibility failed colour contrast on the hero's view toggle and the footer wordmark. Mobile performance lost on layout shift (0.16: the web fonts changed the hero's height, which moved its colour blots and everything below) and on first and largest contentful paint: under the simulated slow 4G, everything requested before the first paint counts against it, and that was 117 KB of fonts, the 51 KB animation script, two 2048 px screenshots and the grain tile.

## Decision

Each change keeps the page looking as accepted; the aim is that the first paint waits only on the HTML.

- **CSS inline.** A build plugin in `vite.config.mjs` inlines each page's stylesheet (asset URLs rewritten to `assets/`) and drops the CSS files. Every page has its own stylesheet, so no caching is lost.
- **Hero intro in CSS.** The rise of the copy, the wordmark letters (now one span per letter in `product.html`), the window tilting up, the sticker and the chips are CSS keyframes with GSAP's timings and curves (`expo.out` ≈ `cubic-bezier(0.16, 1, 0.3, 1)`). They start with the first paint, with or without the script, and are skipped under reduced motion. `splitWordmark` is gone; the script keeps the chips' scramble (only if it arrives before they land), the idle drift and everything below the hero.
- **The script loads after the first contentful paint.** `main.js` imports the CSS and dynamically imports `product.js` once the page has loaded and painted (a `paint` PerformanceObserver, with a three-second fallback). Script tags are emitted with `fetchpriority="low"`. With motion the window opens on the original screen in CSS (`--om-scan: 0%`), so the scan loop picks up without a jump; a `<noscript>` style keeps the masked screen and hides the video button without the script.
- **Fonts.** The serif italic is only ever set at weight 400, so `landing/fonts/` holds that one weight cut from the same Fontsource 5.3.0 variable files with FontTools 4.60.1 (`fonttools varLib.instancer <file> wght=400`, then `pyftsubset --unicodes='*' --layout-features='*' --flavor=woff2`): 66 KB becomes 20 KB, and the cmaps are identical to the originals. The OFL allows modified versions and Noto has no reserved font names; `font-licenses.txt` still applies. The home page preloads all four font files so they usually arrive before the first paint. The sans stays as published (cutting its weight range would change the FAQ's light "+").
- **No layout shift.** The hero's blots are placed from the top in viewport units that match the old percentages on common screens. Below 430 px the tagline has a fixed line break where Noto Sans wraps it anyway, so the fallback font takes two lines too. The video button keeps its place (invisible) until the script shows it.
- **Lighter images.** The hero screenshots get 800 and 1280 px variants (`srcset`, recorded in `scripts/capture-app-shots.mjs`); the video poster is set on first open; the grain tile is greyscale quality 50 (22 → 15 KB) and is only applied once the script runs (`.om-js`), since at 3% it is felt rather than seen.
- **Contrast.** The toggle's idle label uses `#595d54`, the warm scene pill's text is mixed 25% toward ink, and the footer wordmark is generated content: a decorative logotype, which has no contrast requirement and should not be read as text.

## Verification

Lighthouse 13.5 against the production build served over HTTP/2 with Brotli (like Cloudflare), three runs: 100/100/100/100 on mobile and desktop each time; mobile FCP 0.95–1.12 s, LCP 1.73–1.76 s, CLS ≤ 0.002. The thinnest margin is mobile LCP (100 needs about 1.85 s or less), so new above-the-fold images or fonts will cost the score. Headless Chrome screenshots checked the intro, scan loop, reduced motion, dark mode, no-JS, and the privacy and install pages. The PageSpeed API itself was over its anonymous quota, so the live check is left for after deploy.

Not changed: Cloudflare injects its Web Analytics beacon (`static.cloudflareinsights.com`) on the live site. It is a zone setting, outside this repository.
