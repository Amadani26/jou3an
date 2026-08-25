import { useEffect } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import DailyCard from '../../components/DailyCard'
import { getDailyPicks, prettyArea, photoUrls } from '../../lib/api'

/** Shown when the daily picks fail to load — keeps the section populated, never crashes. */
const FALLBACK_PICKS = [
  { name: 'Reif Japanese Kushiyaki', cuisine: 'Japanese', area: 'Dar Wasl', priceMin: 45, priceMax: 90 },
  { name: 'Allo Beirut', cuisine: 'Lebanese', area: 'JLT', priceMin: 35, priceMax: 70 },
  { name: 'Pickl', cuisine: 'Smash Burgers', area: 'City Walk', priceMin: 40, priceMax: 65 },
]

/** The three-second explanation of the whole product. */
const STEPS = [
  { n: '01', label: 'Tell us your vibe', sub: 'Four quick taps' },
  { n: '02', label: 'Get exactly 3', sub: 'Never a long list' },
  { n: '03', label: 'Eat', sub: 'Directions in a tap' },
]

function StepCard({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#111111',
        borderWidth: 1,
        borderColor: '#1C1C1C',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 10,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 16,
          color: '#E63946',
          letterSpacing: -0.5,
          marginBottom: 4,
        }}
      >
        {n}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 12,
          color: '#F2EDE8',
          lineHeight: 15,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 10,
          color: '#504B47',
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {sub}
      </Text>
    </View>
  )
}

function PulsingDot({ size = 6 }: { size?: number }) {
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 1200 }), -1, true)
  }, [opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: '#E8272A' },
        style,
      ]}
    />
  )
}

function SkeletonCard() {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true)
  }, [progress])
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#141414', '#1A1A1A'],
    ),
  }))
  return (
    <Animated.View
      style={[
        {
          borderRadius: 20,
          height: 178,
          borderWidth: 1,
          borderColor: '#242424',
        },
        style,
      ]}
    />
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { data: daily, isLoading } = useQuery({
    queryKey: ['daily', 'today'],
    queryFn: getDailyPicks,
    retry: false,
  })

  const startDeciding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.navigate('/(tabs)/decide')
  }

  // Gentle looping bounce on the CTA — a soft spring that rises to -6px and
  // scales to 1.03, reversing back every ~1.5s to feel inviting, not aggressive.
  const bounce = useSharedValue(0)
  useEffect(() => {
    bounce.value = withRepeat(
      withSpring(1, { damping: 12, stiffness: 55, mass: 1 }),
      -1,
      true,
    )
  }, [bounce])
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * bounce.value },
      { scale: 1 + 0.03 * bounce.value },
    ],
  }))

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const picks = daily?.results?.slice(0, 3) ?? []

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Atmospheric red glow behind the hero */}
      <LinearGradient
        colors={['rgba(232,39,42,0.08)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 360,
        }}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero — logo mark + a single line. Deliberately tight: the steps
            below are the actual explanation. */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 8,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: '#E8272A',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 24,
                fontWeight: '800',
                fontFamily: 'DMSans_800ExtraBold',
              }}
            >
              ج
            </Text>
          </View>

          <Text
            style={{
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 24,
              color: '#F2EDE8',
              letterSpacing: -0.8,
              textAlign: 'center',
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Hungry? We{' '}
            <Text style={{ color: '#E8272A', fontStyle: 'italic' }}>decide</Text> for you.
          </Text>
        </View>

        {/* How it works — three steps, readable at a glance */}
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 20,
            marginTop: 12,
          }}
        >
          {STEPS.map((s) => (
            <StepCard key={s.n} n={s.n} label={s.label} sub={s.sub} />
          ))}
        </View>

        {/* CTA — the payoff of reading the steps */}
        <View style={{ paddingHorizontal: 20, marginTop: 14, marginBottom: 18 }}>
          <Animated.View style={ctaStyle}>
            <RedButton
              label="Decide for me →"
              onPress={startDeciding}
              style={{
                paddingVertical: 16,
                shadowColor: '#E8272A',
                shadowOpacity: 0.3,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
              }}
            />
          </Animated.View>
        </View>

        {/* Daily Top 3 */}
        <View style={{ paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <PulsingDot />
            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 2,
                color: '#504B47',
              }}
            >
              TODAY&apos;S TOP 3
            </Text>
            <View style={{ flex: 1 }} />
            <Text
              style={{ fontFamily: 'DMSans_400Regular', fontSize: 10, color: '#504B47' }}
            >
              {dateStr}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 13,
              color: '#8A847E',
              marginBottom: 10,
            }}
          >
            {daily?.themeLabel ?? 'What Dubai is eating right now'}
          </Text>

          <View style={{ gap: 8 }}>
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : picks.length > 0 ? (
              picks.map((r, i) => (
                <DailyCard
                  key={r.id}
                  rank={i + 1}
                  name={r.name}
                  cuisine={r.cuisineType}
                  area={prettyArea(r.area)}
                  priceMin={r.priceMin}
                  priceMax={r.priceMax}
                  imageUrl={photoUrls(r)[0]}
                  compact
                  onPress={() => router.push(`/restaurant/${r.id}`)}
                />
              ))
            ) : (
              // Fetch failed or returned nothing — fall back to static picks.
              FALLBACK_PICKS.map((r, i) => (
                <DailyCard
                  key={r.name}
                  rank={i + 1}
                  name={r.name}
                  cuisine={r.cuisine}
                  area={r.area}
                  priceMin={r.priceMin}
                  priceMax={r.priceMax}
                  compact
                  onPress={() =>
                    router.push({
                      pathname: '/results',
                      params: { prompt: r.name, chips: '[]' },
                    })
                  }
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
