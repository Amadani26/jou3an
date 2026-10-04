import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * The on-screen keyboard's height, or 0 when it is down.
 *
 * Used instead of `KeyboardAvoidingView` by surfaces that are already pinned to
 * the bottom of the screen — a bottom sheet inside a `Modal`. KAV works by
 * padding ITS OWN box, so it has to be the flex parent; wrapping a sheet held
 * down by `justifyContent: 'flex-end'` makes the two fight over the same edge.
 * Reading the height and moving the sheet is one number and one offset, and it
 * behaves the same on both platforms.
 *
 * iOS fires `keyboardWillShow` early enough to move with the keyboard rather
 * than after it; Android only has `keyboardDidShow`.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates.height),
    )
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return height
}
