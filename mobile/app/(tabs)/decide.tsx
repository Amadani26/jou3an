import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import { searchAreas, updatePreferences, type AreaSuggestion } from '../../lib/api'
import AreaRow from '../../components/AreaRow'
import BudgetSheet from '../../components/BudgetSheet'
import CuisineTile from '../../components/CuisineTile'
import { CUISINE_ROWS, type Cuisine } from '../../lib/cuisines'
import { budgetChoiceOf, budgetLabel, budgetRangeOf, type BudgetChoice } from '../../lib/budget'
import { useAuth } from '../../contexts/AuthContext'
import { usePressed } from '../../lib/usePressed'

type LocationChoice = 'Nearby' | 'Anywhere in Dubai' | `Near ${string}`
type Format = 'Delivery' | 'Dine In'
type Vibe = 'Casual' | 'Fancy'

const SURPRISE: Cuisine = {
  name: 'Surprise me',
  descriptor: 'Let us decide',
  icon: 'shuffle-outline',
}

const NO_PREFERENCE: Cuisine = {
  name: 'No preference',
  descriptor: 'Show me anything',
  icon: 'help-circle-outline',
}

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

/** Shared look for the area search's "nothing to show" messages. */
const emptyStateStyle = {
  fontFamily: 'DMSans_400Regular',
  fontSize: 13,
  color: '#504B47',
  paddingTop: 18,
  lineHeight: 19,
} as const

/* ---------------------------------------------------------------- */

function ProgressDots({ active, count = 4 }: { active: number; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 18 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? '#E8272A' : '#242424',
          }}
        />
      ))}
    </View>
  )
}

function BigCard({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  selected?: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      {...pressHandlers}
      // Plain style, NOT the ({ pressed }) => ... function form — that form is
      // dropped on Pressable here, which left these cards with no fill/border.
      style={{
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: selected ? '#E8272A' : '#242424',
        borderRadius: 24,
        paddingVertical: 26,
        paddingHorizontal: 22,
        gap: 10,
        opacity: pressed ? 0.75 : 1,
      }}
    >
      <Ionicons name={icon} size={28} color={selected ? '#E8272A' : '#F2EDE8'} />
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 22,
          color: '#F2EDE8',
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8A847E' }}>
        {subtitle}
      </Text>
    </Pressable>
  )
}

/**
 * A slim full-width option above or below the grid.
 *
 * Both of these used to be grid-sized cards, which made three different kinds
 * of choice look like one kind. They are utilities: shorter, hairline-bordered,
 * single-line, and visibly not part of the grid.
 */
function UtilityRow({
  icon,
  title,
  height,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  height: number
  /** Red-tinted treatment ("Surprise me"); quiet and secondary otherwise. */
  accent?: boolean
  onPress: () => void
}) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{ alignSelf: 'stretch', height }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: accent ? '#E6394666' : '#1C1C1C',
          backgroundColor: accent ? 'rgba(230,57,70,0.06)' : 'transparent',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <Ionicons name={icon} size={17} color={accent ? '#E63946' : '#8A847E'} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: accent ? 'DMSans_700Bold' : 'DMSans_500Medium',
            fontSize: 14,
            color: accent ? '#E63946' : '#8A847E',
          }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  )
}

/**
 * One search hit in the area picker. Its own component so it can hold press
 * state — hooks can't run inside the results `.map`.
 */
function StepHeading({
  eyebrow,
  title,
  compact,
}: {
  eyebrow: string
  title: string
  /** Tighter heading for a step whose content has to fight for height. */
  compact?: boolean
}) {
  return (
    <View style={{ marginBottom: compact ? 14 : 24 }}>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 2,
          color: '#504B47',
          marginBottom: compact ? 8 : 10,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: compact ? 28 : 32,
          color: '#F2EDE8',
          letterSpacing: -1,
        }}
      >
        {title}
      </Text>
    </View>
  )
}

/* ---------------------------------------------------------------- */

export default function DecideScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // The saved budget band is the default the pill on step 4 starts from.
  const { user, applyUser } = useAuth()

  const [step, setStep] = useState(0)
  const [back, setBack] = useState(false)

  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(null)
  // Captured when the user picks "Nearby" or an area; forwarded to the query.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  // "Pick an area" — inline search that replaces the three location cards.
  const [areaMode, setAreaMode] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)

  // Debounced search. The `cancelled` flag drops responses from superseded
  // keystrokes so a slow early request can't overwrite a newer result.
  useEffect(() => {
    const q = query.trim()
    if (!areaMode || q.length < 2) {
      setSuggestions([])
      setSearching(false)
      setSearchFailed(false)
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchFailed(false)

    const id = setTimeout(async () => {
      try {
        const results = await searchAreas(q)
        if (!cancelled) setSuggestions(results)
      } catch {
        if (!cancelled) {
          setSuggestions([])
          setSearchFailed(true)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query, areaMode])

  const openAreaSearch = () => {
    tap()
    setAreaMode(true)
  }

  const closeAreaSearch = () => {
    setAreaMode(false)
    setQuery('')
    setSuggestions([])
    setSearchFailed(false)
  }

  // Picking an area behaves exactly like "Nearby" downstream: its coordinates
  // feed the 5 → 10 → city ladder and the distance display.
  const chooseArea = (s: AreaSuggestion) => {
    setCoords({ lat: s.lat, lng: s.lng })
    setLocationChoice(`Near ${s.name}`)
    closeAreaSearch()
    goNext()
  }
  // Cuisine is MULTI-select: tapping toggles, "Continue →" advances.
  const [cuisines, setCuisines] = useState<string[]>([])
  // "Surprise me" is mutually exclusive with any picked cuisine.

  const [format, setFormat] = useState<Format | null>(null)

  /* --- Budget, live on the last step -----------------------------
   *
   * The saved band is the default and the pill is how it is changed WITHOUT a
   * trip to Profile — a budget is the one filter that changes meal to meal
   * ("payday" vs "end of the month"), and burying it in a settings screen is
   * what made it feel like a cage set once at signup.
   *
   * ⚠️ The change is SAVED, not just applied to this query (that is the spec,
   * and it is the honest reading of a tap: the user is telling us what they
   * usually spend, not annotating one search). It also travels with the query
   * as `budget`, which is what makes it work at all for a signed-out user and
   * what makes it take effect immediately rather than next time.
   */
  const [budgetOverride, setBudgetOverride] = useState<BudgetChoice | null>(null)
  const [budgetSheet, setBudgetSheet] = useState(false)
  const budget = budgetOverride ?? budgetChoiceOf(user?.budgetRange)

  const chooseBudget = (choice: BudgetChoice) => {
    setBudgetSheet(false)
    setBudgetOverride(choice)
    if (!user) return
    // Fire-and-forget: the query carries the choice regardless, so a failed
    // save costs the user nothing right now — it just won't be remembered.
    updatePreferences({ budgetRange: budgetRangeOf(choice) })
      .then(applyUser)
      .catch(() => {
        /* The per-query budget still applies; Profile can save it later. */
      })
  }

  const goNext = () => {
    setBack(false)
    setStep((s) => Math.min(3, s + 1))
  }

  const goBack = () => {
    // The area search is a sub-view of step 1 — back closes it first.
    if (areaMode) {
      closeAreaSearch()
      return
    }
    if (step === 0) {
      // First step — leave the flow back to Home.
      router.navigate('/(tabs)')
      return
    }
    setBack(true)
    setStep((s) => Math.max(0, s - 1))
  }

  // Step 1 — Location. "Nearby" asks for GPS and captures the coordinates that
  // get sent with the decision query; any failure degrades silently to a
  // city-wide search rather than blocking the flow.
  const chooseLocation = async (choice: LocationChoice) => {
    if (choice === 'Nearby') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setCoords(null)
          setLocationChoice('Anywhere in Dubai')
          goNext()
          return
        }

        // Last known is instant; only pay for a fresh fix if there isn't one.
        let pos = await Location.getLastKnownPositionAsync()
        if (!pos) {
          pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
        }

        if (pos) {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setLocationChoice('Nearby')
        } else {
          setCoords(null)
          setLocationChoice('Anywhere in Dubai')
        }
      } catch {
        setCoords(null)
        setLocationChoice('Anywhere in Dubai')
      }
    } else {
      setCoords(null)
      setLocationChoice('Anywhere in Dubai')
    }
    goNext()
  }

  // Step 2 — tapping a cuisine toggles it; the flow waits for "Continue".
  const toggleCuisine = (name: string) => {
    setCuisines((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )
  }

  // "Surprise me" and "No preference" both advance immediately and clear any
  // picks — neither contributes a cuisine to the prompt.
  // Neither has a selected state to render: both advance on the tap, so the
  // flag the old card needed for its highlight had no reader left.
  const chooseSurprise = () => {
    setCuisines([])
    goNext()
  }

  const chooseNoPreference = () => {
    setCuisines([])
    goNext()
  }

  const chooseFormat = (f: Format) => {
    setFormat(f)
    goNext()
  }

  // Step 4 — Vibe is the final choice: build the brief and go to results.
  const chooseVibe = (vibe: Vibe) => {
    // Every selected cuisine goes into the prompt; "Surprise me" / Skip add none.
    const parts = [
      locationChoice ?? 'Anywhere in Dubai',
      ...cuisines,
      format ?? 'Dine In',
      vibe,
    ]
    const prompt = parts.join(', ')

    // "Near JBR" -> "JBR". Display only: the coords are what actually filter.
    const areaName = locationChoice?.startsWith('Near ')
      ? locationChoice.slice('Near '.length)
      : undefined

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({
      pathname: '/results',
      params: {
        // The prompt survives for DISPLAY and history only — DecisionEngine v2
        // ranks off the structured fields below, not off this string.
        prompt,
        chips: '[]',
        // Only sent for "Nearby" — "Anywhere in Dubai" stays city-wide.
        ...(coords ? { lat: String(coords.lat), lng: String(coords.lng) } : {}),
        // --- structured filters for the engine ---
        // Router params are strings, so the array is JSON-encoded here and
        // parsed back in results.tsx.
        cuisines: JSON.stringify(cuisines),
        format: format ?? 'Dine In',
        vibe,
        // The band in force when the brief was built — 'ANY' included, so the
        // server never has to guess whether an absent value means "no budget".
        budget,
        ...(areaName ? { areaName } : {}),
      },
    })
  }

  const entering = back ? SlideInLeft : SlideInRight

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header: back arrow + progress dots */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityLabel="Back"
          style={{ width: 40, height: 40, justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={22} color="#8A847E" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <ProgressDots active={step} />
        </View>
        {/* Spacer to keep the dots centred */}
        <View style={{ width: 40 }} />
      </View>

      <Animated.View key={step} entering={entering.duration(260)} style={{ flex: 1 }}>
        {step === 0 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading
              eyebrow="STEP 1 · LOCATION"
              title={areaMode ? 'Which area?' : 'Where to?'}
            />

            {areaMode ? (
              // Slides in the same direction as a forward step, so the inline
              // search reads as part of the wizard rather than a modal.
              <Animated.View entering={SlideInRight.duration(220)} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => {
                    tap()
                    closeAreaSearch()
                  }}
                  hitSlop={10}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color="#8A847E" />
                  <Text
                    style={{
                      fontFamily: 'DMSans_600SemiBold',
                      fontSize: 13,
                      color: '#8A847E',
                    }}
                  >
                    Location options
                  </Text>
                </Pressable>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#141414',
                    borderWidth: 1,
                    borderColor: '#242424',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                  }}
                >
                  <Ionicons name="search-outline" size={18} color="#504B47" />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    autoCorrect={false}
                    returnKeyType="search"
                    placeholder="JBR, Deira, Business Bay…"
                    placeholderTextColor="#504B47"
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      fontFamily: 'DMSans_500Medium',
                      fontSize: 16,
                      color: '#F2EDE8',
                    }}
                  />
                  {searching ? <ActivityIndicator size="small" color="#504B47" /> : null}
                </View>

                <View style={{ flex: 1, marginTop: 8 }}>
                  {suggestions.length > 0 ? (
                    <Animated.View entering={FadeIn.duration(180)}>
                      {suggestions.map((s) => (
                        <AreaRow
                          key={`${s.name}-${s.lat}-${s.lng}`}
                          suggestion={s}
                          onPress={() => chooseArea(s)}
                        />
                      ))}
                    </Animated.View>
                  ) : searchFailed ? (
                    <Text style={emptyStateStyle}>
                      Couldn&apos;t search just now — check your connection and try again.
                    </Text>
                  ) : query.trim().length >= 2 && !searching ? (
                    <Text style={emptyStateStyle}>No places found in Dubai.</Text>
                  ) : null}
                </View>
              </Animated.View>
            ) : (
              <View style={{ gap: 12 }}>
                <BigCard
                  icon="location-outline"
                  title="Nearby"
                  subtitle="Uses your location · within 5km"
                  selected={locationChoice === 'Nearby'}
                  onPress={() => chooseLocation('Nearby')}
                />
                <BigCard
                  icon="map-outline"
                  title="Anywhere in Dubai"
                  subtitle="Search across the whole city"
                  selected={locationChoice === 'Anywhere in Dubai'}
                  onPress={() => chooseLocation('Anywhere in Dubai')}
                />
                <BigCard
                  icon="search-outline"
                  title="Pick an area"
                  subtitle="Search any spot in Dubai"
                  selected={locationChoice?.startsWith('Near ') ?? false}
                  onPress={openAreaSearch}
                />
              </View>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14 }}>
            {/* `compact` only here: this is the one step with eight cards plus
                two utility rows plus a button to fit above the tab bar. */}
            <StepHeading compact eyebrow="STEP 2 · CUISINE" title="Any cuisine?" />

            {/* Utility row + 2-col grid + utility row + Continue, all without
                scrolling. The GRID takes the leftover height (rows flex between
                80 and 96); the utility rows and the button are fixed, so the
                grid is what absorbs a shorter screen.
                Multi-select: tapping a grid card toggles, "Continue" advances. */}
            <View style={{ flex: 1, gap: 12, paddingBottom: 8 }}>
              {/* Escape hatch for "I don't know" — advances with no cuisine.
                  Deliberately the quietest thing on the step. */}
              <UtilityRow
                icon={NO_PREFERENCE.icon}
                title={`${NO_PREFERENCE.name} · ${NO_PREFERENCE.descriptor}`}
                height={52}
                onPress={chooseNoPreference}
              />

              <View style={{ flex: 1, gap: 12 }}>
                {CUISINE_ROWS.map((row, ri) => (
                  <View
                    key={ri}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'stretch',
                      gap: 12,
                      flexGrow: 1,
                      flexShrink: 1,
                      flexBasis: 0,
                      minHeight: 80,
                      maxHeight: 96,
                    }}
                  >
                    {row.map((c) => (
                      <CuisineTile
                        key={c.name}
                        name={c.name}
                        descriptor={c.descriptor}
                        icon={c.icon}
                        selected={cuisines.includes(c.name)}
                        onPress={() => toggleCuisine(c.name)}
                      />
                    ))}
                  </View>
                ))}
              </View>

              {/* "Surprise me" — advances immediately and clears any selection. */}
              <UtilityRow
                accent
                icon={SURPRISE.icon}
                title="Surprise me — let us decide"
                height={56}
                onPress={chooseSurprise}
              />

              {/* Primary advance — dimmed until at least one cuisine is picked.
                  The count is the only confirmation that multi-select took. */}
              <RedButton
                label={
                  cuisines.length > 0 ? `Continue with ${cuisines.length} →` : 'Continue →'
                }
                disabled={cuisines.length === 0}
                onPress={goNext}
                style={{ paddingVertical: 14 }}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 3 · FORMAT" title="How are you eating?" />
            <View style={{ gap: 12 }}>
              <BigCard
                icon="bicycle-outline"
                title="Delivery"
                subtitle="Bring it to me"
                selected={format === 'Delivery'}
                onPress={() => chooseFormat('Delivery')}
              />
              <BigCard
                icon="restaurant-outline"
                title="Dine In"
                subtitle="I'm heading out"
                selected={format === 'Dine In'}
                onPress={() => chooseFormat('Dine In')}
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
            <StepHeading eyebrow="STEP 4 · VIBE" title="What's the vibe?" />
            <View style={{ gap: 12 }}>
              <BigCard
                icon="cafe-outline"
                title="Casual"
                subtitle="Easy and relaxed"
                onPress={() => chooseVibe('Casual')}
              />
              <BigCard
                icon="wine-outline"
                title="Fancy"
                subtitle="Make it special"
                onPress={() => chooseVibe('Fancy')}
              />
            </View>

            {/* The budget pill — the last thing before the brief is sent, which
                is exactly where "actually, not tonight" happens. Small and
                quiet: it is a correction to a saved setting, not a 5th step. */}
            <View style={{ alignItems: 'center', paddingTop: 22 }}>
              <BudgetPill label={budgetLabel(budget)} onPress={() => setBudgetSheet(true)} />
            </View>
          </View>
        )}
      </Animated.View>

      {/* Same selector as Profile → Preferences; selecting saves AND rides along
          with this query. */}
      <BudgetSheet
        visible={budgetSheet}
        value={budget}
        onSelect={chooseBudget}
        onClose={() => setBudgetSheet(false)}
        note={
          user
            ? 'Per person, everyday meals. Applies to this decision and sticks for the next ones.'
            : 'Per person, everyday meals. Applies to this decision — sign in to have it remembered.'
        }
      />
    </View>
  )
}

/**
 * The budget, as a tappable pill on the Vibe step.
 *
 * A pill rather than a row: it is showing a value already in force, not asking
 * a question — the step's two cards are the question.
 */
function BudgetPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable onPress={onPress} {...pressHandlers} hitSlop={8}>
      {/* Unstyled Pressable, styled inner View — see lib/usePressed. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#242424',
          backgroundColor: '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <Ionicons name="wallet-outline" size={14} color="#8A847E" />
        <Text
          style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#F2EDE8' }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={13} color="#8A847E" />
      </View>
    </Pressable>
  )
}
