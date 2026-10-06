/**
 * The results screen's state transitions, as pure functions.
 *
 * Extracted so the navigation hierarchy can be TESTED rather than asserted in
 * a commit message. The screen holds these fields in `useState`; every
 * transition that has a rule worth protecting goes through here.
 *
 * The rule being protected: **dismissing the detail returns to the three
 * results and changes nothing else.** `results`, their ORDER, the accumulated
 * `shownIds` and the `cycled` flag all survive, because the next Refresh is
 * built from them — a dismissal that quietly reset any of those would re-roll
 * the deck behind the user's back.
 */

/** Minimum a result needs for these transitions; the screen passes Restaurant. */
export interface Identified {
  id: string
}

export interface ResultsState<R extends Identified> {
  /** The three picks, in the order the engine returned them. */
  results: R[]
  /** Everything shown for this brief so far — the Refresh exclusion set. */
  shownIds: string[]
  /** True when the brief ran dry and the server cycled back to the top. */
  cycled: boolean
  /** The restaurant whose detail is open, or null. */
  chosen: R | null
  /** Whether the full-screen detail is showing. */
  detailVisible: boolean
}

/**
 * Tapping a card: the detail opens over the results.
 *
 * ⚠️ Returns the state UNCHANGED when a detail is already open. That is the
 * double-tap guard — one open detail at a time — and it is why `chosen` is not
 * simply overwritten.
 */
export function openDetail<R extends Identified>(
  state: ResultsState<R>,
  restaurant: R,
): ResultsState<R> {
  if (state.detailVisible) return state
  return { ...state, chosen: restaurant, detailVisible: true }
}

/**
 * Dismissing the detail: back to the three results, one level.
 *
 * ⚠️ `chosen` is CLEARED, and that is load-bearing. It used to stay set because
 * the flow ended here — the screen navigated home and never came back. Now that
 * the user lands back on the cards, leaving it set would make `openDetail`'s
 * guard reject every subsequent tap and the cards would silently stop
 * responding.
 *
 * ⚠️ Nothing else is touched. Returning `{ ...state }` with only these two
 * fields changed is the whole contract: no refetch, no reshuffle, exclusions
 * and cycled carried through untouched.
 */
export function dismissDetail<R extends Identified>(
  state: ResultsState<R>,
): ResultsState<R> {
  return { ...state, chosen: null, detailVisible: false }
}

/** Server's cap on the exclusion list, mirrored so the request can't be rejected. */
export const MAX_EXCLUDE_IDS = 300

/**
 * Folds a freshly-returned set of results into the exclusion list.
 *
 * On a normal load the new ids are appended. On a `cycled` response the brief
 * is spent and the server has already ignored the exclusions, so the set
 * RESTARTS from what was just shown — otherwise every later Refresh would hand
 * back the same cycled trio for ever.
 */
export function accumulateShown<R extends Identified>(
  shownIds: string[],
  results: R[],
  cycled: boolean,
): string[] {
  const ids = results.map((r) => r.id)
  if (cycled) return ids
  return [...shownIds, ...ids].slice(-MAX_EXCLUDE_IDS)
}
