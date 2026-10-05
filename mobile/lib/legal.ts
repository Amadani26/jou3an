import { Linking } from 'react-native'

/**
 * Where the legal documents live.
 *
 * ⚠️ They are hosted on the WEBSITE, not bundled into the app, and that is
 * deliberate: a policy shipped inside a binary can only be corrected by
 * shipping another binary and waiting for review, which is the opposite of
 * what you want from a document people rely on. One copy, on the web, is also
 * the copy Apple and a regulator will read.
 *
 * ⚠️ This means the links are DEAD until jou3an.me is deployed. The site is
 * built and ready; it has not shipped yet. Deploy before the first TestFlight
 * build goes to anyone outside the team — a signup screen that promises terms
 * and 404s is worse than one that never mentioned them.
 */
export const WEB_BASE_URL = 'https://www.jou3an.me'

export const PRIVACY_URL = `${WEB_BASE_URL}/privacy`
export const TERMS_URL = `${WEB_BASE_URL}/terms`

/**
 * Opens a legal page in the system browser.
 *
 * Swallows its own failure: there is nothing useful to tell someone whose
 * device has no browser, and an unhandled rejection from a link tap is a red
 * screen in development over an edge case that barely exists.
 */
export function openLegal(url: string): void {
  Linking.openURL(url).catch(() => {
    /* no browser, or the URL was rejected — nothing worth interrupting for */
  })
}
