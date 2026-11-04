# WEB V2 — "The journey of 3" · Storyboard + tech plan

**Status: FULL FIRST DRAFT — all 7 chapters built at `/v2` on `web-v2`** (2026-11-03;
look = the approved red lacquer). The live site (`/` on main) is untouched. Next: the
owner's draft review, then the "Polish backlog" at the bottom of this file.

One continuous scroll-driven 3D journey. One persistent hero object — a glowing 3D **"3"**
(the 3 in Jou3an; "exactly 3 answers") — and the camera moves around it chapter by chapter.
All copy and controls are HTML; the canvas is scenery, never the text.

---

## 1. Research notes (what we take, and what we don't)

Visited with Playwright at 393 and 1440 (screenshots kept out of the repo, analysis only).
No code, assets or wording is copied from any of them.

**thewatch.60fps.fr** — the structural blueprint.
- ONE full-viewport canvas for the whole page; one product object persists while the camera
  and an exploded-view choreography carry the chapters. We do the same with the "3".
- A very long scroll runway (~38 viewports for ~7 beats) makes the scrub feel unhurried.
  Lesson: give every chapter ≥2 viewports of runway; never let two beats share a scroll inch.
- Giant display type INTERLEAVED with the object (text passes behind/in front). Lesson for us:
  the "3" may overlap the headline, but the headline must stay HTML (theirs is), with the
  object's depth doing the layering illusion — never rasterised text in the scene.
- Per-chapter background mood (light grey ↔ black) resets the eye between beats. Ours stays
  on the brand's blacks, with the RED's intensity doing the mood work.
- HTML annotation labels floating beside the 3D at rest — exactly how our chapter copy works.

**trionn.com** — the craft bar.
- Lenis confirmed in the wild (`window.lenis`); buttery scrub with zero jank on a dark
  WebGL monogram — rim-lit, barely-lit-until-it-matters. Our ch1 ignition borrows that
  restraint: darkness first, the object earns its light.
- Atmosphere from thin line-work and sparse particles, not fog soup. Micro-typography
  (small caps, monospace labels, underlined text CTAs) carries the premium feel between
  3D moments — cheap to do, huge craft signal.
- Layered canvases (3D object + 2D grain/cursor layers) — we keep ONE WebGL canvas and do
  grain/scrims in CSS instead (the live site already has the noise overlay pattern).

**motionsites.ai** — the pattern catalogue (the site itself is DOM/CSS + video, no WebGL).
- The curated patterns that map to our chapters: scroll-driven object journeys,
  particle/card condensation into a hero form (our ch3 collapse), chip-morphs-into-card.
- Its own restraint is the meta-lesson: motion only where it narrates; everything else is
  plain, fast, readable DOM. Our ch6 (live demo) and ch7 (waitlist) stay fundamentally HTML.

---

## 2. Storyboard — seven chapters

Copy rule for every chapter: **approved claims only** — lines already shipped on the live
site. No superlatives, no "under 10 seconds", no invented numbers, no new promises.
Real restaurants only (wall/showcase/demo from `/api/public/*`): real names, real Google
ratings with attribution or no score at all, no dishes as picks, no bars/lounges
(server-gated). The `VenueNote` disclaimer renders in every chapter where real venue names
appear outside the demo's own attribution (ch2 tunnel, ch4 cards, ch6 demo).

Scroll grammar (all chapters): the page is one runway (~16–18 viewports total on desktop);
a single progress value drives the scene. **Scroll-driven** = scrubbed to scroll position
(reversible). **Time-based** = a short clip that plays once when its window is reached
(for beats that look broken when scrubbed backwards — the lesson of the live site's wall).

### Ch1 — "Hungry?" (runway ~2 viewports, scroll-driven)
- **Screen**: pure black. The HTML headline **"Hungry?"** with sub **"A food decision
  engine for Dubai."**; nav wordmark above.
- **3D**: the "3" sits dark, barely rim-lit. As scroll begins it IGNITES — emissive red
  (#FE0000) ramps, a red point light warms the scene, an additive glow blooms behind it.
  Slow idle rotation; it never sits perfectly still.
- **Scroll**: ignition is scrubbed (scroll back = lights down). Proven in the spike.
- **iPhone**: same scene; the 3 sits slightly lower so the headline owns the upper half.
  Desktop: the 3 center-right, headline left (thewatch-style asymmetry).
- **Reduced-motion/static**: no canvas; a giant red HTML "3" (Syne 800, CSS glow) over the
  same headline. Shipped in the spike.

### Ch2 — "Too many options." (runway ~3 viewports, scroll-driven)
- **Screen**: headline **"Too many options."**, sub **"All of them open. All of them
  plausible."** + `VenueNote`.
- **3D**: the camera flies down a helix tunnel of REAL restaurant cards (name, cuisine ·
  area, real "★ x.x · Google" or nothing) rushing past; the 3 recedes ahead, dimmed, always
  visible at the tunnel's end — the destination. Exponential black fog sells the depth.
- **Scroll**: fully scrubbed — scroll speed IS flight speed, backwards flies back.
- **iPhone**: ~28 cards, DPR 1.5, no antialias (fog hides it). Desktop: 42+ cards, DPR 2.
- **Fallback**: a static scatter of 6 real-name chips under the headline (shipped in spike).

### Ch3 — "Jou3an decides." (runway ~2.5 viewports, scroll-driven with a time-based burst)
- **Screen**: headline **"Jou3an *decides*."** (decide in red Instrument Serif italic —
  the brand's accent), sub **"Exactly 3 answers."**
- **3D**: the tunnel COLLAPSES — every card is pulled into the 3 (staggered, nearest first,
  shrinking as they go); the 3 brightens with each arrival and fires one light burst
  (additive glow swell — no postprocessing bloom), then settles, bright and slowly turning.
- **Scroll**: the collapse is scrubbed; the burst's flash-and-fade is time-based once its
  threshold is crossed (a backwards-scrubbed explosion reads as broken).
- **iPhone/desktop**: same beat; burst sprite only (never a fullscreen flash — epilepsy-safe
  ramp, ≤0.4 opacity swell over ~600ms).
- **Fallback**: headline + the static red 3.

### Ch4 — "Exactly 3 answers." (runway ~3 viewports, scroll-driven settle)
- **Screen**: headline **"Exactly 3 answers."**, sub **"Where you are. What you feel like.
  What you spend."** (both shipped claims).
- **3D**: the 3 SPLITS — three card planes (the live showcase's real picks) fly out and
  orbit it in 3D, then the orbit decays and the cards settle toward three marked rests.
- **The handoff rule**: at rest each 3D plane fades under a REAL HTML card (same geometry,
  measured with getBoundingClientRect — the technique the live hero's shared-element return
  already proved). Settled cards are DOM: selectable text, real rating badges, reason lines,
  accessible. 3D is never the final resting place of readable content.
- **iPhone**: cards settle stacked vertically; orbit radius tightened. Desktop: row of 3.
- **Fallback**: the three HTML cards, plainly stacked.

### Ch5 — "It learns you." (runway ~2 viewports, time-based micro-scene in a scrubbed window)
- **Screen**: headline **"It learns you."**, sub: the shipped feature line **"Swipe to
  teach it."**
- **3D**: one settled card detaches and swipes away off-screen (the app's left-swipe,
  acted out once); the 3's material RESPONDS — hue warms slightly, roughness drops,
  the glow steadies: "taste" visibly accumulating in the object itself. A replacement
  card arrives. (Material morph on a code-built mesh is a uniform tween — this is a key
  reason the 3 is code, not a baked asset.)
- **Scroll**: the window is scrubbed; the swipe itself plays once per visit.
- **Fallback**: static copy beside the red 3; no card choreography.

### Ch6 — "Try it." (runway: normal document flow — NOT scrubbed)
- **Screen**: the EXISTING live demo (`DemoSection`), logic untouched: area chips →
  3 real in-area picks, real photos with "Google · author" attribution, opens-at chips,
  `VenueNote`. Fully interactive HTML with pointer events; Lenis must not eat its swipe
  gestures (the deck already uses `touch-action: pan-y` — verified compatible).
- **3D**: the scene dims to a backdrop; the 3 parks small in a corner, idling — a glowing
  brand bug watching the demo. No scroll choreography competes with interaction.
- **iPhone/desktop**: as the demo behaves today.
- **Fallback**: the demo as-is (it already has its own reduced-motion path).

### Ch7 — "Be first in Dubai." (runway ~1.5 viewports + normal flow)
- **Screen**: the waitlist — the EXISTING `CTABand` (same Supabase wiring, preview-mocked,
  same `waitlist_join` analytics event) and the footer with the legal links.
- **3D**: the 3 makes its exit: it glides into the headline and settles INTO the wordmark —
  becoming the 3 of an HTML "Jou3an" (DOM-aligned flight, then a swap to type). The canvas
  releases; from here down the page is plain HTML.
- **Scroll**: the glide is scrubbed; past the swap, native document scroll.
- **Fallback**: wordmark + band, static.

---

## 3. Tech plan

**Stack**: React Three Fiber + drei (helpers as needed) on three; GSAP ScrollTrigger for the
scrub; Lenis for smooth scroll. three / R3F / drei / Lenis are MIT. ⚠️ **GSAP is NOT MIT** —
since 3.13 it is free for all use (including commercial) under Webflow's standard license;
acceptable, but recorded here and in ASSET_CREDITS.md when it ships. If a pure-OSI stack is
ever required, the scrub is one `scrollY / runway` calculation and ScrollTrigger drops out.

**Architecture** (validated by the spike):
- ONE persistent `<Canvas>` fixed behind an HTML layer. All text/buttons HTML. The scene
  reads ONE scroll-progress number from a ref (ScrollTrigger scrub → ref; `useFrame` reads).
  Zero React state changes on the scroll path.
- Chapters are 150–300vh HTML sections with sticky inner frames — the same reservation
  pattern the live site's lazy sections use; CLS stays 0 by construction.
- 3D lazy-loads AFTER first paint, gated on first scroll/touch intent (6s timer fallback):
  ch1's resting state is darkness + headline, ignition starts ~24vh in, so the three
  parse/compile (~300ms) happens while the visitor reads. Measured effect: TBT 680ms → 0ms.
- The existing data layer is reused untouched: `useShowcase()` (build-time snapshot first,
  live `/api/public/showcase` replaces), `getDemo()`, the photo proxy. Every 3D surface
  must survive the API answering null — the snapshot IS the floor.

**iPhone strategy**: DPR capped at 1.5 (2 on desktop), `antialias: false` on phones, fewer
tunnel cards (~28 vs 42+), 14 shared canvas-drawn card textures (512×288 — no photo fetches
in the tunnel), one point light + one directional, no shadows, no postprocessing (the bloom
is an additive sprite). `document.hidden` short-circuits the frame loop; the full build adds
an IntersectionObserver to stop the loop when the canvas is off-screen (ch6's demo).

**Fallback matrix** (decided at mount, from the spike):
| condition | experience |
|---|---|
| `prefers-reduced-motion` | static chapter stack, no canvas, no Lenis, native scroll |
| no WebGL context | same static stack |
| WebGL but weak device (first 60 frames avg >40ms) | full build: drop to static after a grace period — spike does not implement this yet |
| JS off / prerender | ch1's HTML (headline + static 3) paints; same approach as the live site |

**Performance targets**: Lighthouse mobile ≥80 (accepted drop from 98), 60fps on a mid-range
iPhone, CLS 0. Spike measurements below — targets currently met in the harnesses we have;
**a real mid-range iPhone run is still owed** before Phase 2 is declared safe.

**SEO/accessibility**: every chapter's copy is real DOM in source order; headings h1→h2
sequence; the canvas is `aria-hidden`; interactive chapters (6–7) are the existing,
already-accessible components. `/v2` (or `/` once promoted) gets the same prerender
treatment as today's landing page.

---

## 4. The 3D "3" — build vs generate

**Recommendation: (a) build it in code. Decided and already proven in the spike.**

| | (a) code: extruded from Syne (OFL) | (b) Higgsfield `generate_3d` |
|---|---|---|
| Brand fidelity | EXACT wordmark glyph (wght 800), can never drift | a model's interpretation of a "3"; needs rounds of review |
| Licence | OFL font, our extrusion — unambiguous | generated asset licence fine under the plan, but one more thing to ledger |
| Size | **2.4 KB** of path JSON + geometry built at runtime | multi-MB GLB to download, parse, retopo-check |
| Ch5's material shift | uniform tween on our own material — trivial | baked materials; re-texturing someone else's topology |
| Pipeline | `scripts/extract-glyph3.mjs` (fontkit → path JSON, committed) → `ExtrudeGeometry` with bevel | import, simplify, compress, host |

The code glyph's ONE weakness: extrusion + bevel is geometric, not sculptural — it won't
look "cast in glass" without material work. That's exactly where Higgsfield helps instead:
**atmosphere clips, not the hero object**.

**Higgsfield video clips — proposed, NOT generated, awaiting approval.** All abstract: no
food, no people, no UI, no logos, no text. Same delivery as the current hero streaks
(AV1/HEVC/H264, masters out of git, job IDs into ASSET_CREDITS.md). Exact prompts:

1. **Ch1 underlay — embers in the dark** (behind the ignition, barely visible):
   *"Abstract macro shot: faint deep-red embers and dust motes drifting slowly upward in pure black darkness, soft volumetric haze, cinematic, minimal, very dark, slow motion, seamless loop, no objects, no text, no people."*
2. **Ch3 burst plate — radial light** (composited under the collapse's flash):
   *"Abstract radial burst of deep red light rays through black haze, streaks bloom outward then fade, pure black background, elegant, high contrast, slow motion, seamless loop, no lens flare branding, no objects, no text, no people."*
3. **Ch7 settle — light ribbons** (behind the wordmark handoff):
   *"Soft abstract ribbons of deep red light settling downward like silk in black space, slow, elegant, minimal, dark, seamless loop, no objects, no text, no people."*

(The existing licensed streak clip from the live hero can also be reused for ch2's tunnel
entry at zero new cost.)

---

## 5. Tech spike — what's built and what it measured

**Built** (`client/src/v2/`, route `/v2`, lazy — zero bytes added to the live page's entry):
chapters 1→3 end to end. The Syne-extruded 3 igniting (scrubbed), a 42-card helix tunnel of
REAL wall restaurants (14 shared canvas textures, real ratings with attribution or none),
the staggered collapse into the 3 with the burst, Lenis + ScrollTrigger scrub, HTML chapter
layer, `VenueNote` in ch2, static fallback for reduced-motion/no-WebGL, FPS meter at `?fps=1`.

**Measured honestly (2026-11-03, local production build):**
- **Frame times, WebKit @393 (Apple-silicon Mac — NOT a phone)**: 59.7 fps avg over a 12s
  scripted full-runway scroll; avg 16.76ms, p95 19ms, worst 22ms, 0 frames >34ms.
  ⚠️ A desktop-class GPU: the number proves the architecture doesn't stutter, not that a
  mid-range iPhone holds 60 — that measurement is still owed on a real device.
- **Lighthouse mobile `/v2`**: **94 perf / 100 a11y / 100 best-practices / 92 SEO**;
  TBT 0ms, CLS 0, LCP 3.0s. (LCP is the lazy route chunk + fonts; if v2 is promoted to `/`,
  the prerender brings it down the same way it did for the live page. Before the
  interaction-gated mount, TBT was 680ms — the gate is what pays for three.)
- **Bundle**: entry **unchanged** (101.5 kB gzip). New lazy chunks: journey page
  (gsap + lenis + chapters) **51.0 kB gzip**; WebGL scene (three + R3F) **245.4 kB gzip**,
  loaded only on `/v2` and only on scroll intent.
- **Console**: zero errors across the full scripted run.
- Reduced-motion, no-WebGL and API-down (snapshot) paths all render.

**Spike shortcuts to revisit in Phase 2**: no off-screen frame-loop stop (only
`document.hidden`); no weak-device auto-downgrade; headline/3 overlap composition is
unrefined; the burst is scrubbed rather than fire-once; `/v2` is not prerendered.

---

## Polish backlog (after first draft)

Owner-reviewed on iPhone after the chapters 1–5 checkpoint (2026-11-03).
**To be done AFTER all 7 chapters exist** — none of these block the first
full draft, and several (1, 5) want the whole page in place first.

1. **Scroll regulation.** Fast swipes can rip through the story. Plan
   CHAPTER SNAPPING — a fast swipe advances to the next chapter boundary,
   and key beats (the collapse, the split, the handoff) play at their own
   pace rather than at flick speed — plus tuned Lenis smoothing
   (`lerp`/`duration` per input type). Must feel controlled at ANY swipe
   speed on iPhone. Chapters 6–7 were deliberately built OUTSIDE the main
   scrub (rect-driven, no ScrollTrigger of their own) so a snapping system
   over the ch1–5 runway can be added without reworking them.
2. **Ch4 card sharpness.** The 3D answer cards look blurry before they
   hand off to the HTML cards. Raise the canvas texture resolution /
   render the card textures at device DPR (they are 512px-wide canvases
   today, stretched to the DOM rect at settle) so they are crisp
   throughout the orbit and settle.
3. **Ch3 burst quality.** The radial-burst clip reads low-quality/blurry
   at full bloom. Re-encode at higher resolution (the master is 1280×720,
   shipped at 960 crf 30), regenerate at a higher quality tier, or replace
   it with a particles-in-scene burst.
4. **Ch5 swipe legibility.** The swipe isn't natural or noticeable yet.
   Rework it so it clearly reads as the app's swipe gesture — bigger, more
   physical (drag arc + rotation like the deck), and with a clearer
   cause → effect on the 3's colour shift (the taste ramp should visibly
   ANSWER the swipe, not merely coincide with it).
5. **Ch4 general refinement pass** — orbit choreography, card spacing,
   the 3's parked pose, the headline/cards vertical rhythm on phones.

## 2026-11-04 — stepped chapters + ch4 rebuild (owner's iPhone review)

Backlog items 1 and 2 above are RESOLVED, by replacement rather than
tuning:

- **Stepped chapters replaced scroll entirely on ch1–5.** Lenis,
  ScrollTrigger and the snap pass are GONE from the journey. The stage is
  ONE 100svh section; while the story plays the page does not scroll at
  all — one swipe / wheel flick / keypress advances exactly one beat
  (`timeline.ts` BEATS), each a time-based gsap tween on the scene's
  progress number (~1–2s, the same for everyone). Input during a
  transition queues at most one step; back-gestures step back one beat.
  After the last beat the page unlocks and the tail (demo → FAQ → join →
  footer) scrolls natively; an upward gesture at the very top re-enters
  the story one beat back. "Skip to the live demo" + the header Join pill
  work at any beat. Reduced motion / no WebGL: the static fallback under
  normal scrolling, unchanged.
- **Ch4 is rebuilt as pure DOM** ("From all the options, exactly 3"): a
  dense field of REAL wall restaurants is narrowed by four labelled beats
  — Area → Budget → Open now → Your taste (choreography of the engine's
  real stages; no per-venue claims, same rule as the live page's problem
  wall) — until the 3 survivors rise (FLIP-lite onto live rects) into the
  readable HTML answer cards. The 3D pick planes and `makePickTexture`
  are DELETED — nothing readable is rasterised into the canvas any more,
  which is what fixes the blurriness at device DPR.
- **Refresh under the 3**: `GET /api/public/refresh?exclude=…` (new,
  read-only, no DB writes, engine `excludeIds` + `cycled` — the app's own
  Refresh mechanism). Client accumulates shown ids, animates the swap,
  falls back to cycling un-shown wall rows offline, and resets with a
  quiet "Back to our top picks" when the pool runs dry. ⚠️ The endpoint
  must be deployed to Railway (it lives in `server/src/routes/public.ts`)
  — until then production falls back to wall-row cycling.
- **iPhone zoom-out bug fixed at the cause**: ch5's card swipe
  (`translateX(130%)`) had nothing clipping it, so the document grew
  wider than the viewport and Safari zoomed out to fit. The stage now
  clips (`overflow: clip`) and `.j-root` carries `overflow-x: clip` as
  the page-wide safety net. Verified in WebKit at 375/393/430:
  `document.scrollWidth === innerWidth` at every beat, mid-transition,
  and through the whole tail.
- "Chapter N" kickers removed everywhere.
- QA (2026-11-04, production-shape build): Lighthouse mobile /v2 **84
  perf, CLS 0**, FCP 0.8s; zero console errors; full beat walk + refresh
  + skip + re-entry verified in WebKit at all three phone widths.

Backlog items 3 (burst clip quality), 4 (ch5 swipe legibility) and 5
(general ch4/ch5 polish) remain, and ch5 is explicitly awaiting its own
rework pass.
