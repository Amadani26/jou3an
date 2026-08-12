/** Lightweight haptic feedback helpers (no-ops where unsupported). */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore */
    }
  }
}

/** Short tick — e.g. selecting a chip. */
export const hapticTap = () => vibrate(10)

/** Success pattern — e.g. submitting a decision. */
export const hapticSuccess = () => vibrate([10, 50, 10])
