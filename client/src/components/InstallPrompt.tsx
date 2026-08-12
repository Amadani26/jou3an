import { useEffect, useState } from 'react'
import { Share, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VISITS_KEY = 'jou3an_visits'
const DISMISS_KEY = 'install-dismissed'
const VISIT_COUNTED_KEY = 'jou3an_visit_counted'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const ios = isIOS()

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return

    // Count this visit once per browser session.
    if (!sessionStorage.getItem(VISIT_COUNTED_KEY)) {
      const visits = Number(localStorage.getItem(VISITS_KEY) || '0') + 1
      localStorage.setItem(VISITS_KEY, String(visits))
      sessionStorage.setItem(VISIT_COUNTED_KEY, '1')
    }

    const visits = Number(localStorage.getItem(VISITS_KEY) || '0')

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // Show after the 3rd visit (iOS never fires beforeinstallprompt)
    if (visits >= 3) {
      const t = setTimeout(() => setVisible(true), 1200)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60">
      <div
        className="w-full max-w-[520px] bg-bg-2 border-t border-border sheet-up"
        style={{
          borderRadius: '28px 28px 0 0',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <span className="w-10 h-1 rounded-full bg-bg-4" />
        </div>

        <div className="px-6 pt-3">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Jou3an"
              className="w-12 h-12 rounded-2xl"
            />
            <div className="flex-1">
              <div className="font-display font-bold text-text-primary">
                Add to Home Screen
              </div>
              <div className="text-sm text-text-secondary">
                Get the full app experience — one tap away.
              </div>
            </div>
            <button
              onClick={dismiss}
              className="text-text-secondary hover:text-text-primary"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {ios ? (
            <div className="mt-5 rounded-2xl bg-bg-3 border border-border-soft p-4 text-sm text-text-secondary flex items-center gap-2">
              <Share size={18} className="text-red shrink-0" />
              <span>
                Tap <span className="text-text-primary font-medium">Share</span>{' '}
                → <span className="text-text-primary font-medium">Add to Home Screen</span>
              </span>
            </div>
          ) : (
            <div className="mt-5 flex gap-3">
              <button onClick={dismiss} className="btn-ghost flex-1 py-3">
                Not now
              </button>
              <button
                onClick={install}
                disabled={!deferred}
                className="btn-primary flex-1 py-3 disabled:opacity-60"
              >
                Install
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
