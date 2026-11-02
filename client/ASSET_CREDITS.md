# Asset credits and licences

Every third-party asset shipped by the landing page, with its source and
licence. Update this file in the SAME commit as any asset change — the
zero-risk rule is that nothing ships unless it is ours or clearly licensed
for commercial marketing use.

## Photography (`public/brand/dishes/`)

All from Pexels, under the [Pexels licence](https://www.pexels.com/license/):
free for commercial use, no attribution required (credited anyway), edits
allowed. Each is used as GENERIC cuisine imagery — a dish, never presented
as any specific restaurant's food. Picked to contain no recognisable faces,
logos, brand packaging or storefront signage (verified by eye at pick time).

| File | Dish | Photographer | Source |
| --- | --- | --- | --- |
| `biryani.webp` | A vibrant plate of biryani garnished with lemon  | Alberta Studios | https://www.pexels.com/photo/biryani-on-a-plate-9738983/ |
| `burger.webp` | Close-up of gourmet burgers with cheddar, bacon, | Natan Machado Fotografia Gastronômica | https://www.pexels.com/photo/delicious-burgers-on-wooden-boards-on-table-15010285/ |
| `pancakes.webp` | Close-up of golden brown pancakes with syrup dri | Giovanna Kamimura | https://www.pexels.com/photo/golden-syrup-drizzled-pancake-stack-close-up-29395474/ |
| `pizza.webp` | Freshly baked Margherita pizza topped with mozza | Gian Larracas | https://www.pexels.com/photo/buratta-pizza-27793841/ |
| `ramen.webp` | A visually appealing Japanese ramen bowl with eg | Tiya Nh | https://www.pexels.com/photo/delicious-japanese-ramen-bowl-with-toppings-37105478/ |
| `salad.webp` | Close-up of a vibrant poke bowl with fresh veggi | Nadin Sh | https://www.pexels.com/photo/a-salad-in-a-bowl-12814860/ |
| `shawarma.webp` | Delicious close-up of a fresh doner kebab with v | Valeria Boltneva | https://www.pexels.com/photo/close-up-of-doner-with-meat-and-vegetables-18330028/ |
| `skewers.webp` | Savory grilled meat skewers displayed on a rusti | pedro furtado | https://www.pexels.com/photo/delicious-grilled-meat-skewers-on-wooden-stand-28902897/ |
| `sushi.webp` | An elegant display of assorted sushi on a black  | Maria Buloczka | https://www.pexels.com/photo/photography-of-sushi-10562410/ |

Processing: cropped to 4:3, resized to 800x600, WebP q70. Originals not
committed.

## Fonts (`public/fonts/`, self-hosted)

| Font | Licence | Use |
| --- | --- | --- |
| Syne (variable, latin) | [SIL OFL 1.1](https://fonts.google.com/specimen/Syne/license) | Display headlines, wordmark |
| DM Sans (variable, latin) | [SIL OFL 1.1](https://fonts.google.com/specimen/DM+Sans/license) | Body text |
| Instrument Serif (italic, latin) | [SIL OFL 1.1](https://fonts.google.com/specimen/Instrument+Serif/license) | The one accent word |

The OFL permits web embedding and commercial use. The Arabic wordmark جوعان
renders in the system Arabic font (no Arabic webfont is shipped).

## The device and all page graphics

The hero device is pure CSS (gradient metal, inset-shadow bevel and rim, a
sheen sweep) around a screen that is live HTML in our own design language —
no WebGL, no downloaded models, no device-maker likeness. Every other visual
on the page is CSS, inline SVG from lucide-react (ISC), or type. There are no
raster posters: every fallback (reduced motion and otherwise) is the same DOM
rendered statically, and the landing route is prerendered at build time from
our own components.

## The link-preview card (public/og-image.png)

Made in-house: a 1200×630 scriptless HTML card set in the site's own
licensed fonts (Syne, Instrument Serif, DM Sans — all OFL) over CSS shapes
(the red 3, the radial glow), screenshotted and optimised. No stock, no
photography, no third-party marks. Referenced by the og:image / twitter:image
tags in index.html.

## JavaScript dependencies added by the redesign

| Package | Licence |
| --- | --- |
| three | MIT |
| @react-three/fiber | MIT |
| three-stdlib | MIT |
| motion | MIT |
| @vercel/analytics | MIT (cookieless visit counts, production only) |

## Explicitly NOT used

- Google Places photography outside the live demo (the baked-in results
  screenshot was deleted with this rule).
- Real restaurant names or identities in marketing sections.
- Google rating badges or third-party marks outside the live demo.
- Stock from any source other than Pexels/Unsplash, marketplace 3D models,
  and any font not licensed for web embedding.

## Known third-party content OUTSIDE this page (listed, not touched)

The MOBILE app still ships `mobile/lib/placeholderImages.ts` — 10 hardcoded
Unsplash food-photo URLs used as placeholders wherever a restaurant has no
synced Places photos (DailyCard, ResultCard, the Swipe card, the detail
sheet, and the Home screen's FALLBACK_PICKS). Out of scope for the web
branch; tracked here so it is not forgotten.

## Hero streak clip (`public/hero/`)

AI-generated abstract motion clip (red light streaks converging on black),
created with **Higgsfield** (model `seedance_2_5`) on 2026-11-02 under the
account's **Plus plan**, whose terms permit commercial use of generated
output. Fully abstract by prompt and by eye: no food, people, UI, text,
logos, or recognisable anything — the zero-risk rule does not apply beyond
that check. Source generation job `84127cd5-60bb-4b43-a7e5-9e0f67e7acbe`
(variant 2 of 2; the unused variant 1 was job
`bbc8ebdd-957b-4e65-94c8-472361358fc0`).

| File | Codec | Size | Role |
| --- | --- | --- | --- |
| `streaks-av1.mp4` | AV1 (svt-av1, crf 42) | 269 KB | first source (Chrome/Firefox) |
| `streaks-hevc.mp4` | H.265 hvc1 (crf 30) | 232 KB | Safari |
| `streaks-h264.mp4` | H.264 (crf 26) | 414 KB | universal fallback |
| `streaks-poster.jpg` | JPEG | 23 KB | poster frame |

Processing: audio stripped, scaled to 540×960 from the 720×1280 master,
faststart. The 1.8 MB master mp4s live in gitignored
`client/.artifact-assets/hero-streaks/` and are not committed.

## Real restaurants on the page (2026-11-02)

The zero-risk rule for VENUE IDENTITIES was deliberately reversed by the
owner: the page may now show real restaurants, served live from
`/api/public/*` under a strict no-invented-data rule (real Google ratings
with attribution or no score, real prices or none, anonymous engine
reasons). Two asset consequences:

- **The Pexels dish photos are never paired with a real restaurant name.**
  On the live wall they are labelled by CUISINE ONLY; the full dish labels
  render only on the generic fallback (API unreachable), which contains no
  real venues.
- **Live restaurant photos appear ONLY on the demo's three results**,
  streamed per request from Google Places (photo names fetched fresh each
  time, never stored, per the Place Photos no-caching rule) and displayed
  with "Google · {author}" attribution from `authorAttributions`.
