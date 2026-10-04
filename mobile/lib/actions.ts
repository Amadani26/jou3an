import { Linking } from 'react-native'
import {
  TALABAT_SCHEME,
  callablePhone,
  displayArea,
  orderUrl,
  telUrl,
  type Restaurant,
} from './api'

/**
 * The three action buttons, in one place.
 *
 * ⚠️ They are opened from FOUR screens (results, Food Tinder, History, the
 * restaurant detail screen) and every one of them used to build its own URL.
 * That is how all three buttons ended up opening Google Maps: each surface had
 * its own `if (phone) ... else maps` fallback, and with no phone numbers in the
 * catalogue the else branch was the only one that ever ran. One module means
 * "what does Order do" has exactly one answer.
 */

/** What we hand Google Maps — name plus neighbourhood beats coordinates for a search. */
function mapsQuery(r: Pick<Restaurant, 'name'> & Parameters<typeof displayArea>[0]): string {
  return `https://maps.google.com/?q=${encodeURIComponent(
    `${r.name} ${displayArea(r)} Dubai`,
  )}`
}

/** Directions — unchanged. Maps is genuinely the right destination here. */
export function openDirectionsFor(
  r: Pick<Restaurant, 'name'> & Parameters<typeof displayArea>[0],
): Promise<unknown> {
  return Linking.openURL(mapsQuery(r))
}

/**
 * Call — the native dial prompt.
 *
 * ⚠️ NO FALLBACK. If there is no number this returns false and opens nothing,
 * because the button that triggers it is not rendered without one. The old
 * behaviour — falling through to Maps — is exactly the bug: a control labelled
 * "call" that opens a map teaches people the buttons are decorative.
 *
 * iOS answers a `tel:` URL with its own confirm-call sheet showing the number,
 * so the user always sees what they are about to dial and can back out. That
 * sheet IS the intended behaviour, not an obstacle to route around.
 */
export async function openCallFor(
  r: { phoneNumber?: string | null; phone?: string | null },
): Promise<boolean> {
  const phone = callablePhone(r)
  if (!phone) return false
  try {
    await Linking.openURL(telUrl(phone))
    return true
  } catch {
    // Some targets have no dialer at all — an iPad, and the simulator, which
    // answers a tel: URL with "Unable to open the Phone app". Nothing useful
    // to say to the user, and an unhandled rejection here would be a red
    // screen in dev over a device limitation.
    return false
  }
}

/**
 * Order — Talabat.
 *
 * The app first, the website second. The scheme check is what makes the first
 * step safe to attempt at all: `canOpenURL` returns false when Talabat is not
 * installed, when the scheme is wrong, or when iOS has not been told to allow
 * the query (`LSApplicationQueriesSchemes` in app.json) — and in every one of
 * those cases we fall through to a URL that definitely works.
 *
 * ⚠️ The web fallback lands on Talabat's UAE restaurant list, NOT on a
 * pre-filled search — see `orderUrl()` for the verification behind that. Never
 * word the button or any copy as though it searches for the restaurant.
 */
export async function openOrderFor(r: {
  name: string
  talabatUrl?: string | null
}): Promise<void> {
  const web = orderUrl(r)

  try {
    if (await Linking.canOpenURL(TALABAT_SCHEME)) {
      // The app is there. Hand it the same destination; Talabat's universal
      // links resolve a talabat.com URL inside the app.
      await Linking.openURL(web)
      return
    }
  } catch {
    // canOpenURL throws on a malformed scheme on some platforms. Not a reason
    // to deny someone the website.
  }

  await Linking.openURL(web)
}
