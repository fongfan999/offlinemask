# 0175 — A mascot: the ninja who wears the mask

Date: 30 October 2026. The owner asked for the logo's ninja to come alive: an animation on the website of the ninja masking data "like slicing bananas", then a mascot.

## Why

The mark already reads as a ninja's mask at small sizes (decision 0093), and the app's and website's logos already leave like one, in a puff of smoke (decision 0172). A mascot gives that character a body, and the slice says what the product does in one gesture: the value is cut away and its code is left in its place.

## What

- **The mascot is generated, like the mark.** `brand/make_mark.py` draws three candidates with the same brush (`MASCOTS`; sheet `brand/mascots.png`): M1 a round head, M2 a head-and-body bean, M3 the logo as the face. M2 is chosen (`build_mascot`) because it can sit on a line of text, which the first version of the slice needed. Its band is the mark's own swipe with ink eye dots, tied on with two cobalt tails; the head is ink, so in dark mode it is drawn in the dark theme's ink. `build.py` writes `brand/mascot.svg` (parts carry `om-mascot-head`, `-band`, `-eyes` classes so a page can recolour them), `brand/mascot-paper.svg` for dark backgrounds, and the paths into `desktop/src/components/brand-paths.ts`.
- **The website's slice.** In "Cách hoạt động" step 1, after "Ẩn thông tin" is pressed, each highlighted value in turn is cut with one thin cobalt stroke; the two halves fall away and the code appears where the value was. The data is the banana: a literal fruit would be too jokey for office users, and a sword too sharp, so the cut is a brush stroke in the brand's cobalt. It replaces that scene's old fade from value to code and does not add a demo, so the page still shows each demo once. `cutValue` in `landing/product.js` measures each cut when it starts, since the codes before it change the line; only transform and opacity animate, the halves are copies of the value clipped along the cut, and a value broken over two lines is cut without halves. The loop runs only while the scene is on screen, as before; with reduced motion the scene shows its end state as before. The first version had the ninja pop in, hop from value to value and make each cut with a swing, then flip away. The owner found that much movement tiring to watch (it gave them a headache), so the website and the film keep only the cut, and the mascot stays where it is still: the 404 page and the app's card.
- **The intro video.** The film's "Ẩn nhanh" scene (the Motion artifact behind `landing/media/offlinemask-intro.mp4`, decision 0113) uses the same cut: after the click each value in turn gets one cobalt stroke, and the halves fall away as the code appears, instead of the old scramble. A short whoosh and a pop mark each cut. Its line "Vẫn ứng dụng quen. / Chỉ cần bôi đen." rises a quarter of a second later, so it does not land on the first cut. The film's length (35.7 s) and every other scene are unchanged, and so is the poster (the slogan at 7.2 s).
- **A 404 page.** `landing/404.html`, served by Cloudflare for unknown paths (`not_found_handling: 404-page`), shows the mascot swaying above "Trang này ẩn mình, / không để lại hình." (4+4; mình–hình share vowel and the huyền tone) and a button home. It is noindex and not in the sitemap. Because it answers at any depth, the build rewrites its `./` links to `/`.
- **In the app.** The "cannot open" card (a file that will not open, a folder with nothing to hide) shows the mascot tilting its head once, in place of the file or folder icon. Nowhere else: the accepted layout stays as it is.

## Not done

- No poses beyond the one drawing; motion is transforms of the whole figure.
- The mascot is not in the hero, the share image or the app's home.
