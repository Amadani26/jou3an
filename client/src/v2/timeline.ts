/**
 * The journey's ONE timeline — now a list of STEPPED BEATS, not scroll
 * geometry. The ch1–5 story no longer scrubs: one swipe / wheel flick /
 * keypress advances exactly one beat, and each beat plays as a TIME-BASED
 * tween (same speed for everyone) from the previous beat's progress value
 * to its own. The scene still reads one normalized progress number (0..1),
 * so every scalar in JourneyCanvas keeps working — only the thing DRIVING
 * that number changed (a gsap tween instead of a ScrollTrigger scrub).
 *
 * The P* constants below are the scene's chapter boundaries in that same
 * progress space; BEATS park on and travel between them. Both live here so
 * the HTML story and the WebGL scene can never drift apart.
 */

/** ch1 → ch2 (ignition ends, tunnel begins). */
export const P1 = 0.16
/** ch2 → ch3 (tunnel ends, collapse begins). */
export const P2 = 0.4

/** ch1: the ignition ramp. */
export const IGNITE_START = 0.02
export const IGNITE_DUR = 0.11

/** ch3: collapse is eased over [P2, P2+COLLAPSE_DUR]; the burst is a
 *  ONE-SHOT fired when p crosses BURST_AT moving forward (a backwards-
 *  played explosion reads as broken), re-armed only after stepping back
 *  past the collapse. */
export const COLLAPSE_DUR = 0.13
export const BURST_AT = P2 + COLLAPSE_DUR + 0.005
export const BURST_REARM_BELOW = BURST_AT - 0.06
export const BURST_SECONDS = 0.75

/** ch4: the lacquer 3 steps up and back while the options field takes the
 *  stage (the field itself is pure DOM — crisp at device DPR, nothing of
 *  it lives in the canvas any more). */
export const P3 = 0.6
export const RECEDE_END = 0.68

/** ch5: the lacquer hue/glow shift as "taste" builds. */
export const TASTE_START = 0.88
export const TASTE_END = 1

/** Which headline block a beat shows (j-copy-N). */
export type CopyId = 1 | 2 | 3 | 4 | 5

/**
 * ch4's field stage: 0 = field not yet on stage, 1 = field in,
 * 2..5 = Area / Budget / Open now / Your taste applied, 6 = handoff —
 * the three survivors have risen into the readable HTML answer cards.
 */
export type FieldStage = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Beat {
  /** Scene progress this beat RESTS at. */
  p: number
  /** Seconds the transition INTO this beat takes (forward). */
  dur: number
  copy: CopyId
  field: FieldStage
}

/**
 * The stepped story. One user gesture = one index step; input during a
 * transition is queued (max 1), never skipped through. Durations are the
 * same for every visitor — the story plays at ITS pace, not flick speed.
 */
export const BEATS: Beat[] = [
  { p: 0, dur: 0.9, copy: 1, field: 0 }, // rest: "Hungry?" — the lit 3
  { p: P2, dur: 2.4, copy: 2, field: 0 }, // ignite + the tunnel flythrough
  { p: 0.56, dur: 1.6, copy: 3, field: 0 }, // collapse + the one-shot burst
  { p: 0.66, dur: 1.2, copy: 4, field: 1 }, // the 3 recedes; the options field fills the stage
  { p: 0.7, dur: 1.0, copy: 4, field: 2 }, // filter: Area
  { p: 0.74, dur: 1.0, copy: 4, field: 3 }, // filter: Budget
  { p: 0.78, dur: 1.0, copy: 4, field: 4 }, // filter: Open now
  { p: 0.82, dur: 1.0, copy: 4, field: 5 }, // filter: Your taste → exactly 3 left
  { p: TASTE_START, dur: 1.3, copy: 4, field: 6 }, // the 3 rise into the answer cards (+ Refresh)
  { p: 1, dur: 1.7, copy: 5, field: 6 }, // ch5: It learns you — swipe + taste shift
]

export const LAST_BEAT = BEATS.length - 1
