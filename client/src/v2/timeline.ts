/**
 * The journey's ONE timeline: chapter runway heights (svh) and the derived
 * normalized progress boundaries. The HTML layer sizes its sections from
 * CHAPTER_VH and the scene reads the P* constants — they can never drift
 * apart because both come from here.
 *
 * ch4+ch5 share ONE section ("answers") with one sticky frame: the three
 * result cards must stay on screen from the split (ch4) through the swipe
 * and taste-shift (ch5), and a sticky frame per chapter would scroll them
 * away between the two.
 */
export const CHAPTER_VH = {
  ch1: 200, // Hungry? — ignition
  ch2: 300, // Too many options — the tunnel
  ch3: 250, // Jou3an decides — collapse + burst
  answers: 500, // ch4 Exactly 3 answers + ch5 It learns you
} as const

export const TOTAL_VH = 1250

/** Chapter boundaries in normalized scroll progress (0..1 over the runway). */
export const P1 = CHAPTER_VH.ch1 / TOTAL_VH // 0.16  — ch1 → ch2
export const P2 = (CHAPTER_VH.ch1 + CHAPTER_VH.ch2) / TOTAL_VH // 0.40 — ch2 → ch3
export const P3 = (CHAPTER_VH.ch1 + CHAPTER_VH.ch2 + CHAPTER_VH.ch3) / TOTAL_VH // 0.60 — ch3 → answers

/** ch1: the ignition ramp (scrubbed). */
export const IGNITE_START = 0.02
export const IGNITE_DUR = 0.11

/** ch3: collapse is scrubbed over [P2, P2+COLLAPSE_DUR]; the burst is a
 *  ONE-SHOT fired when p crosses BURST_AT scrolling forward (a backwards-
 *  scrubbed explosion reads as broken), re-armed only after scrolling back
 *  past the collapse. */
export const COLLAPSE_DUR = 0.13
export const BURST_AT = P2 + COLLAPSE_DUR + 0.005
export const BURST_REARM_BELOW = BURST_AT - 0.06
export const BURST_SECONDS = 0.75

/** The answers section's inner beats (all in page progress). The sticky
 *  frame stays pinned until ~p 0.92, so everything interactive-looking is
 *  finished well before the frame starts scrolling away. */
export const SPLIT_END = P3 + 0.072 // 3 splits, cards fly to orbit
export const SETTLE_END = SPLIT_END + 0.056 // orbit decays onto the DOM rects
export const HANDOFF_END = SETTLE_END + 0.024 // 3D planes fade under the HTML cards
export const CH5_COPY_AT = HANDOFF_END + 0.016 // headline crossfades to "It learns you."
export const SWIPE_AT = CH5_COPY_AT + 0.02 // one card swipes away (one-shot, CSS)
export const TASTE_START = SWIPE_AT + 0.012
export const TASTE_END = 0.92 // lacquer hue/glow shift fully in

/** Scroll regulation: the runway's rest points, as progress values. A
 *  settling scroll is eased to the nearest one IN ITS DIRECTION, so a fast
 *  swipe advances to the next beat and the beat plays at the snap tween's
 *  pace, not at flick speed. Chosen at each chapter's readable pose:
 *  0 top · lit 3 · tunnel's end · just past the burst trigger (so the
 *  one-shot fires on the way in) · answers handed off · taste settled ·
 *  runway end. Only the runway snaps — the tail (demo/FAQ/join) scrolls
 *  free. */
export const SNAP_POINTS = [0, 0.14, 0.4, 0.56, 0.75, 0.93, 1]
