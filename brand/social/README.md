# Social images

Facebook page artwork, drawn in HTML with the landing page's fonts and screenshot (like
`landing/og/card.html`), so it matches the site.

| File | Size | Notes |
| --- | --- | --- |
| `profile.png` (from `profile.html`) | 1080×1080 | Shown as a circle; the paper mask from the app icon on cobalt. |
| `cover.png` (from `cover.html`) | 1640×856 | Desktop shows the middle 1640×624 band, phones the middle ~1520 px; text and chips stay inside both. |

The fonts and screenshot come from `landing/`, so run `mise exec -- pnpm install` first. Render from this folder:

```sh
for f in profile:1080,1080 cover:1640,856; do n=${f%%:*}; "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --allow-file-access-from-files --force-device-scale-factor=1 --virtual-time-budget=3000 --window-size=${f#*:} --screenshot="$PWD/$n.png" "file://$PWD/$n.html"; done
```
