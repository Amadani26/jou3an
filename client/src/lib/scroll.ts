/** Smoothly scroll to the waitlist section. */
export function scrollToWaitlist() {
  const el = document.getElementById('waitlist')
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // Hand focus to the email field once the scroll settles so the CTA lands the
  // user on a keyboard-ready input rather than just near it.
  window.setTimeout(() => {
    document.getElementById('waitlist-email')?.focus({ preventScroll: true })
  }, 650)
}
