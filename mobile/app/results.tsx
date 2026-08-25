import { useCallback, useEffect, useState } from 'react'
import { ScrollView, View, Text, Pressable, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import ProcessingState from '../components/ProcessingState'
import ResultCard from '../components/ResultCard'
import GhostButton from '../components/GhostButton'
import SelectionConfirmCard from '../components/SelectionConfirmCard'
import RestaurantDetailSheet from '../components/RestaurantDetailSheet'
import {
  getDecision,
  tinderSuggest,
  saveDecisionSelection,
  prettyArea,
  deliveryUrl,
  type Restaurant,
} from '../lib/api'

export default function ResultsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    prompt?: string
    chips?: string
    mode?: string
    likedIds?: string
    title?: string
  }>()

  const prompt = params.prompt ?? ''
  let chips: string[] = []
  try {
    chips = params.chips ? (JSON.parse(params.chips) as string[]) : []
  } catch {
    chips = []
  }

  // "Food Tinder" origin: fetch via tinderSuggest(likedIds) instead of a prompt query.
  const isTinder = params.mode === 'tinder'
  let likedIds: string[] = []
  try {
    likedIds = params.likedIds ? (JSON.parse(params.likedIds) as string[]) : []
  } catch {
    likedIds = []
  }

  const effectivePrompt = prompt || chips.join(' ') || 'surprise me'
  const displayQuery =
    params.title || prompt || chips.join(', ') || 'Your pick'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [results, setResults] = useState<Restaurant[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flashVisible, setFlashVisible] = useState(false)
  // Long-press opens the read-only detail sheet (view, not select).
  const [detailRestaurant, setDetailRestaurant] = useState<Restaurant | null>(null)

  // Tapping a card expands it into the inline confirmation overlay.
  const selectedRestaurant = results.find((r) => r.id === selectedId) ?? null
  const selectedRank =
    selectedId != null ? results.findIndex((r) => r.id === selectedId) + 1 : 1

  // "This is it →": record the final pick (await), flash "Enjoy your meal",
  // then replace to the home tab — the decision is final, no going back.
  const confirmSelection = async () => {
    if (selectedRestaurant && sessionId) {
      try {
        await saveDecisionSelection(sessionId, selectedRestaurant.id, 'SELECT')
      } catch {
        /* best-effort — don't block the confirmation on a network hiccup */
      }
    }
    setFlashVisible(true)
    setTimeout(() => {
      router.replace('/(tabs)')
    }, 1200)
  }

  const run = useCallback(async () => {
    setLoading(true)
    setError(false)
    setSelectedId(null)
    const started = Date.now()
    try {
      const res = isTinder
        ? await tinderSuggest(likedIds)
        : await getDecision(effectivePrompt, chips)
      const elapsed = Date.now() - started
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed))
      }
      setResults(res.results)
      setSessionId(res.sessionId)
    } catch {
      const elapsed = Date.now() - started
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed))
      }
      setError(true)
      setResults([])
      setSessionId(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrompt])

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Record the action in the background — never awaited, never blocks the UI.
  const recordSelection = (r: Restaurant, action: 'DIRECTIONS' | 'CALL' | 'ORDER') => {
    if (!sessionId) return
    saveDecisionSelection(sessionId, r.id, action).catch(() => {
      /* silent — selection tracking is best-effort */
    })
  }

  const openDirections = (r: Restaurant) => {
    recordSelection(r, 'DIRECTIONS')
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(
        `${r.name} ${prettyArea(r.area)} Dubai`,
      )}`,
    )
  }
  const call = (r: Restaurant) => {
    recordSelection(r, 'CALL')
    if (r.phone) Linking.openURL(`tel:${r.phone}`)
    else
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(
          `${r.name} ${prettyArea(r.area)} Dubai`,
        )}`,
      )
  }
  const order = (r: Restaurant) => {
    recordSelection(r, 'ORDER')
    const url = deliveryUrl(r)
    if (url) Linking.openURL(url)
    else
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(
          `${r.name} ${prettyArea(r.area)} Dubai`,
        )}`,
      )
  }

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 14,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ minHeight: 40, minWidth: 40, justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color="#504B47" />
          </Pressable>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 2,
              color: '#504B47',
            }}
          >
            DECIDED FOR YOU
          </Text>
        </View>

        <Text
          style={{
            fontFamily: 'DMSans_800ExtraBold',
            fontSize: 22,
            color: '#F2EDE8',
            letterSpacing: -1,
            marginTop: 6,
          }}
          numberOfLines={1}
        >
          {displayQuery}
        </Text>

        {chips.length > 0 ? (
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}
          >
            {chips.map((c) => (
              <View
                key={c}
                style={{
                  backgroundColor: '#141414',
                  borderWidth: 1,
                  borderColor: '#242424',
                  borderRadius: 100,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#8A847E' }}
                >
                  {c}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 80 }}>
          <ProcessingState />
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center', gap: 12 }}>
          <Ionicons name="cloud-offline-outline" size={40} color="#242424" />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#504B47' }}>
            Couldn&apos;t reach the kitchen. Try again.
          </Text>
          <GhostButton label="Retry" onPress={run} />
        </View>
      ) : (
        <>
          {results.map((r, i) => (
            <Animated.View
              key={r.id}
              entering={FadeInDown.delay(i * 150).duration(400)}
            >
              <ResultCard
                rank={i + 1}
                name={r.name}
                cuisine={r.cuisineType}
                priceRange={`AED ${r.priceMin}–${r.priceMax}`}
                area={prettyArea(r.area)}
                onSelect={() => setSelectedId(r.id)}
                onLongPress={() => setDetailRestaurant(r)}
                onDirections={() => openDirections(r)}
                onCall={() => call(r)}
                onOrder={() => order(r)}
              />
            </Animated.View>
          ))}

          {/* Interaction hint (shown before a selection is made) */}
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#444',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            Tap to select · Hold for details
          </Text>

          <View style={{ alignItems: 'center', marginTop: 10, gap: 8, paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#504B47' }}>
              Not what you&apos;re looking for?
            </Text>
            <GhostButton label="Refresh" onPress={run} />
          </View>
        </>
      )}
    </ScrollView>

    <SelectionConfirmCard
      visible={selectedId != null}
      restaurant={selectedRestaurant}
      rank={selectedRank}
      flashVisible={flashVisible}
      onClose={() => setSelectedId(null)}
      onConfirm={confirmSelection}
    />

    {/* Read-only detail sheet — long-press on a card */}
    <RestaurantDetailSheet
      visible={detailRestaurant != null}
      onClose={() => setDetailRestaurant(null)}
      name={detailRestaurant?.name ?? ''}
      cuisine={detailRestaurant?.cuisineType ?? ''}
      priceRange={
        detailRestaurant
          ? `AED ${detailRestaurant.priceMin}–${detailRestaurant.priceMax}`
          : ''
      }
      area={detailRestaurant ? prettyArea(detailRestaurant.area) : ''}
      tags={detailRestaurant?.tags}
      ratingScore={detailRestaurant?.ratingScore}
      calories={detailRestaurant?.averageCalories}
      onDirections={() => detailRestaurant && openDirections(detailRestaurant)}
      onCall={() => detailRestaurant && call(detailRestaurant)}
      onOrder={() => detailRestaurant && order(detailRestaurant)}
    />
    </>
  )
}
