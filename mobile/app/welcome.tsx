import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import RedButton from '../components/RedButton'
import GhostButton from '../components/GhostButton'
import Wordmark from '../components/Wordmark'
import { usePressed } from '../lib/usePressed'

/**
 * The first thing a logged-out launch shows.
 *
 * ⚠️ It is a DOOR, not a wall. "Continue as guest" is a real, visible choice
 * with the same weight as the other two in everything but colour — the whole
 * app works signed out, and an account only buys History and a taste profile.
 * A welcome screen that hides the way past it is a signup wall, and this is
 * not one: the hierarchy here (red / outlined / plain text) says which path we
 * would prefer without ever removing the third.
 *
 * Shown once per launch, by the gate in app/_layout.tsx — see WELCOME_ROUTE
 * there for why it is per-launch and not persisted.
 */
export default function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const guest = usePressed()

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* The same red bloom the Home hero opens with, so arriving at the tabs
          feels like the next room rather than a different app. */}
      <LinearGradient
        colors={['rgba(232,57,70,0.17)', 'rgba(232,57,70,0.06)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 440 }}
        pointerEvents="none"
      />

      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 20,
          justifyContent: 'center',
        }}
      >
        {/* Brand + tagline */}
        <Animated.View entering={FadeInDown.duration(500)} style={{ gap: 16 }}>
          <Wordmark size={44} />
          <Text
            style={{
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 30,
              lineHeight: 36,
              letterSpacing: -1,
              color: '#F2EDE8',
            }}
          >
            Hungry? We{' '}
            <Text style={{ color: '#E63946', fontStyle: 'italic' }}>decide</Text> for you.
          </Text>
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              lineHeight: 22,
              color: '#8A847E',
            }}
          >
            Three Dubai restaurants, chosen for you in seconds. No lists, no
            scrolling, no second-guessing.
          </Text>
        </Animated.View>

        <View style={{ height: 40 }} />

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(140).duration(500)} style={{ gap: 12 }}>
          {/* replace(), not push(): welcome must never sit UNDER the app
              waiting to be swiped back into. Every exit from here — an account,
              a sign-in, or guest — leaves it behind for the rest of the
              session, which is the rule the launch gate encodes. The auth
              screens' own X already lands on the tabs. */}
          <RedButton
            label="Create Account"
            onPress={() => router.replace('/(auth)/signup')}
          />
          <GhostButton label="Sign In" onPress={() => router.replace('/(auth)/login')} />
        </Animated.View>

        {/* The way past. Plain text, centred, and unmistakably a control. */}
        <Animated.View entering={FadeIn.delay(320).duration(400)}>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            {...guest.pressHandlers}
            hitSlop={12}
            accessibilityRole="button"
            // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
            style={{
              alignSelf: 'center',
              paddingVertical: 14,
              paddingHorizontal: 16,
              marginTop: 22,
              opacity: guest.pressed ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: 'DMSans_600SemiBold',
                fontSize: 14,
                color: '#8A847E',
                textDecorationLine: 'underline',
              }}
            >
              Continue as guest
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  )
}
