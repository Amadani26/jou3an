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
  {
    n: '01',
    title: 'Tell us your vibe',
    sub: 'Four quick taps — where, what, how and the mood',
  },
  {
    n: '02',
    title: 'Get exactly 3 picks',
    sub: 'Never a long list, never a scroll hole',
  },
  {
    n: '03',
    title: 'Eat',
    sub: 'Directions, a table or delivery in one tap',
  },
]

/**
 * One row of the how-it-works timeline: a big red number on a rail, the copy
 * beside it. The rail's 1px line stretches to the next number (the row is
 * stretch-aligned, so it fills whatever height the copy takes), which is what
 * makes the three read as a flow rather than a list.
 */
function StepRow({
  n,
  title,
  sub,
  last,
}: {
  n: string
  title: string
  sub: string
  last?: boolean
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 46, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: 'DMSans_800ExtraBold',
            fontSize: 28,
            color: '#E63946',
            letterSpacing: -1,
            lineHeight: 32,
          }}
        >
          {n}
        </Text>
        {last ? null : (
          <View
            style={{
              flex: 1,
              width: 1,
              backgroundColor: '#242424',
              marginTop: 8,
              marginBottom: 2,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1, paddingLeft: 14, paddingBottom: last ? 0 : 26 }}>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 16,
            color: '#FFFFFF',
            lineHeight: 22,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 13,
            color: '#8A847E',
            lineHeight: 19,
            marginTop: 3,
          }}
        >
          {sub}
        </Text>
      </View>
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
          height: 250,
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
      {/* Atmospheric red glow behind the hero — three stops so the falloff
          reads as a soft bloom rather than a visible band. */}
      <LinearGradient
        colors={[
          'rgba(232,39,42,0.17)',
          'rgba(232,39,42,0.06)',
          'transparent',
        ]}
        locations={[0, 0.45, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 440,
        }}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — logo mark + headline, with room to breathe */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 28,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: '#E8272A',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 28,
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
              fontSize: 30,
              lineHeight: 38,
              color: '#F2EDE8',
              letterSpacing: -1.2,
              textAlign: 'center',
            }}
          >
            Hungry? We{' '}
            <Text style={{ color: '#E8272A', fontStyle: 'italic' }}>decide</Text> for you.
          </Text>
        </View>

        {/* How it works — a vertical timeline, not a grid of boxes */}
        <View style={{ paddingHorizontal: 24, marginTop: 36 }}>
          {STEPS.map((s, i) => (
            <StepRow
              key={s.n}
              n={s.n}
              title={s.title}
              sub={s.sub}
              last={i === STEPS.length - 1}
            />
          ))}
        </View>

        {/* CTA — the payoff of reading the steps */}
        <View style={{ paddingHorizontal: 20, marginTop: 36 }}>
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
        <View style={{ paddingHorizontal: 20, marginTop: 44 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
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
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 22,
              color: '#F2EDE8',
              letterSpacing: -0.8,
              marginBottom: 16,
            }}
          >
            {daily?.themeLabel ?? 'What Dubai is eating right now'}
          </Text>

          <View style={{ gap: 12 }}>
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
