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

## 3D

Everything in the WebGL scene is modelled in code from Three.js geometry
primitives (rounded boxes, planes) with canvas-drawn textures generated at
runtime from our own design system. No downloaded models, no scanned assets,
no Apple hardware likeness: the device is an original generic rounded slab.

## JavaScript dependencies added by the redesign

| Package | Licence |
| --- | --- |
| three | MIT |
| @react-three/fiber | MIT |
| three-stdlib | MIT |
| maath | MIT |
| motion | MIT |

## Explicitly NOT used

- Google Places photography outside the live demo (the baked-in results
  screenshot was deleted with this rule).
- Real restaurant names or identities in marketing sections.
- Google rating badges or third-party marks outside the live demo.
- Stock from any source other than Pexels/Unsplash, marketplace 3D models,
  and any font not licensed for web embedding.
