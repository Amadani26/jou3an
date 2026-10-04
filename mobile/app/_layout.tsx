import '../global.css'
import { useEffect, useState } from 'react'
import { Stack, useRootNavigationState, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans'
import { AuthProvider, useAuth } from '../contexts/AuthContext'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient()

const WELCOME_ROUTE = '/welcome'

/**
 * Whether this LAUNCH has already shown the welcome screen.
 *
 * ⚠️ Module-level, deliberately not persisted. The rule is "a guest sees it
 * again on the next launch, never twice in one session", and module scope says
 * exactly that: it survives every navigation and dies with the process. Writing
 * it to storage would turn "not signed in" into "dismissed once, forever", and
 * the screen would stop being the thing that offers an account at all.
 */
let welcomeShownThisLaunch = false

/**
 * Sends a logged-out launch to the welcome screen, once.
 *
 * ⚠️ Renders nothing and navigates from an effect, because expo-router has no
 * way to pick an initial route from async state: the token lives in SecureStore
 * and `(tabs)` is already mounting by the time we know whether there is one.
 * Redirecting is the only honest option, so the SPLASH IS HELD until this has
 * decided — otherwise the tabs paint for a frame and the welcome screen looks
 * like an interruption rather than the first screen.
 *
 * `useRootNavigationState()` is the guard for "the navigator exists yet";
 * calling router.replace before it does is a no-op that silently loses the
 * redirect.
 */
function LaunchGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const navState = useRootNavigationState()
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    if (decided || isLoading || !fontsLoaded || !navState?.key) return

    // A valid token goes straight to the app — the welcome screen has nothing
    // to offer someone who already has an account.
    if (!isAuthenticated && !welcomeShownThisLaunch) {
      welcomeShownThisLaunch = true
      router.replace(WELCOME_ROUTE)
    }
    setDecided(true)
  }, [decided, isLoading, isAuthenticated, fontsLoaded, navState?.key, router])

  useEffect(() => {
    if (decided) SplashScreen.hideAsync()
  }, [decided])

  return null
}

export default function RootLayout() {
  const [loaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
  })

  // ⚠️ The splash is NOT hidden here any more — LaunchGate hides it once it
  // knows whether this is a guest launch. Hiding on fonts alone showed the
  // tabs before the welcome redirect had run.
  if (!loaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <LaunchGate fontsLoaded={loaded} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#080808' },
                animation: 'slide_from_right',
              }}
            />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
