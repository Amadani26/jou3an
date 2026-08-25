import { useState } from 'react'

/**
 * Press-feedback state for `Pressable`.
 *
 * WHY THIS EXISTS: the `style={({ pressed }) => [...]}` function form is DROPPED
 * on `Pressable` in this project (NativeWind v4 interop) — the element silently
 * loses its fill/border/radius/padding and collapses to content size. So press
 * feedback has to come from state instead:
 *
 *   const { pressed, pressHandlers } = usePressed()
 *   <Pressable {...pressHandlers} style={{ ...styles, opacity: pressed ? 0.75 : 1 }} />
 *
 * 0.75 is the standard pressed opacity across the app; icon-only / secondary
 * rows use 0.6.
 */
export function usePressed() {
  const [pressed, setPressed] = useState(false)

  const pressHandlers = {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
  }

  return { pressed, pressHandlers }
}
