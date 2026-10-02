/**
 * The onboarding taste quiz.
 *
 * Shown straight after signup, and reachable again from Profile → Preferences.
 * Four questions, then a closing screen.
 *
 * ⚠️ SKIPPABLE AT EVERY STEP, and the skip has to be real: "Skip for now" saves
 * whatever has been answered so far and leaves. A user who answers two of four
 * questions gets those two applied — the server treats every field as optional
 * precisely so this works. Nothing here blocks the way into the app.
 *
 * ⚠️ ENCOURAGED, NOT DEMANDED. The intro line says what the user gets for the
 * 30 seconds, because the honest pitch ("our picks get smarter") is a better
 * reason to answer than a progress bar guilting them into it.
 *
 * Every answer lands somewhere in DecisionEngine v2 — see
 * server/src/services/tasteQuiz.ts for the translation:
 *   love    -> taste weights +2        avoid (cuisine) -> taste weights -2
 *   avoid (dietary) -> a Stage-1 exclusion
 *   budget  -> the default budget context
 *   adventurousness -> this user's base wildcard ε
 *
 * Visually it is the Decide flow's wizard: tap cards, progress dots, DM Sans,
 * no emojis. The cuisine grid is literally the Decide step's `CuisineTile`.
 */
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated'
import RedButton from '../components/RedButton'
import CuisineTile from '../components/CuisineTile'
import { CUISINES, CUISINE_ROWS } from '../lib/cuisines'
import { usePressed } from '../lib/usePressed'
import { useAuth } from '../contexts/AuthContext'
import {
  submitTasteQuiz,
  type Adventurousness,
  type BudgetRange,
  type DietaryNeed,
  type TasteQuizAnswers,
} from '../lib/api'

/** Matches the server's MAX_LOVED_CUISINES. Too many picks says nothing. */
const MAX_LOVED = 5

const STEPS = ['LOVE', 'AVOID', 'BUDGET', 'ADVENTURE'] as const
const STEP_COUNT = STEPS.length

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

interface DietaryOption {
  value: DietaryNeed
  label: string
  /**
   * Shown under the label. ⚠️ For `no-pork` this says so explicitly: the
   * server stores it but enforces nothing, and the one thing worse than not
   * filtering is implying that we do.
   */
  note?: string
}

const DIETARY: DietaryOption[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'no-pork', label: 'No pork', note: 'Saved to your profile' },
  { value: 'gluten-free', label: 'Gluten-free' },
]

interface BudgetOption {
  value: BudgetRange
  label: string
  range: string
  sub: string
}

/** Mirrors BUDGET_BANDS in server/src/services/engine/filter.ts. */
const BUDGETS: BudgetOption[] = [
  {
    value: 'LOW',
    label: 'Keeping it cheap',
    range: 'Under AED 60',
    sub: 'Street food, quick bites',
  },
  {
    value: 'MID',
    label: 'Somewhere in the middle',
    range: 'AED 40–120',
    sub: 'Most sit-down places',
  },
  {
    value: 'HIGH',
    label: 'Happy to spend',
    range: 'AED 90+',
    sub: 'The nicer end of the scale',
  },
]

interface AdventureOption {
  value: Adventurousness
  label: string
  sub: string
  icon: keyof typeof Ionicons.glyphMap
}

const ADVENTURE: AdventureOption[] = [
  {
    value: 'SAFE',
    label: 'Stick to my favorites',
    sub: 'Mostly what I already like',
    icon: 'heart-outline',
  },
  {
    value: 'BALANCED',
    label: 'Mix it up sometimes',
    sub: 'Familiar, with the odd surprise',
    icon: 'shuffle-outline',
  },
  {
    value: 'ADVENTUROUS',
    label: 'Surprise me often',
    sub: 'Show me places I would not pick',
    icon: 'compass-outline',
  },
]

/* ---------------------------------------------------------------- */

function ProgressDots({ active, count }: { active: number; count: number }) {
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

function StepHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string
  title: string
  sub?: string
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          letterSpacing: 2,
          color: '#504B47',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 28,
          color: '#F2EDE8',
          letterSpacing: -1,
        }}
      >
        {title}
      </Text>
      {sub ? (
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 13,
            lineHeight: 19,
            color: '#8A847E',
            marginTop: 8,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  )
}

/** A full-width option row — used for dietary, budget and adventurousness. */
function OptionRow({
  title,
  sub,
  trailing,
  icon,
  selected,
  onPress,
}: {
  title: string
  sub?: string
  /** Right-aligned secondary text (the AED band). */
  trailing?: string
  icon?: keyof typeof Ionicons.glyphMap
  selected: boolean
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
      // The Pressable stays UNSTYLED and the inner View carries the
      // fill/border/radius/padding, matching CuisineTile. Pressable drops
      // backgroundColor on some RN versions in this project (see the note in
      // components/CuisineTile.tsx), so visual styling belongs on a child.
      style={{ alignSelf: 'stretch' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 15,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? '#E63946' : '#242424',
          backgroundColor: selected ? '#1a0d0d' : '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: selected ? '#E6394622' : '#1F1F1F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={selected ? '#E63946' : '#8A847E'} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 15,
            color: selected ? '#E63946' : '#F2EDE8',
          }}
        >
          {title}
        </Text>
        {sub ? (
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#8A847E',
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>

      {trailing ? (
        <Text
          style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#FFB547' }}
        >
          {trailing}
        </Text>
      ) : null}

      {selected && !trailing ? (
        <Ionicons name="checkmark-circle" size={20} color="#E63946" />
      ) : null}
      </View>
    </Pressable>
  )
}

/** The escape hatch, on every step. Quiet, but never hidden. */
function SkipLink({ onPress, label = 'Skip for now' }: { onPress: () => void; label?: string }) {
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      {...pressHandlers}
      hitSlop={10}
      // Unstyled Pressable, styled inner View — see the note on OptionRow.
      style={{ alignSelf: 'center' }}
    >
      <View
        style={{
          paddingVertical: 12,
          paddingHorizontal: 20,
          opacity: pressed ? 0.6 : 1,
        }}
      >
        <Text
          style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#504B47' }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

/* ---------------------------------------------------------------- */

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { user, applyUser } = useAuth()

  const [step, setStep] = useState(0)
  const [back, setBack] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  // Prefilled from the saved profile so re-opening from Profile → Preferences
  // is an EDIT rather than a blank slate. A quiz that forgets what you told it
  // reads as broken the second time you see it.
  const [loved, setLoved] = useState<string[]>(user?.cuisinePreferences ?? [])
  const [disliked, setDisliked] = useState<string[]>(user?.dislikedCuisines ?? [])
  const [dietary, setDietary] = useState<DietaryNeed[]>(
    (user?.dietary ?? []).filter((d): d is DietaryNeed =>
      DIETARY.some((o) => o.value === d),
    ),
  )
  const [budget, setBudget] = useState<BudgetRange | null>(user?.budgetRange ?? null)
  const [adventure, setAdventure] = useState<Adventurousness | null>(
    user?.adventurousness ?? null,
  )

  /** Only fields the user actually touched are sent; the rest keep their value. */
  const answers = (): TasteQuizAnswers => ({
    lovedCuisines: loved,
    dislikedCuisines: disliked,
    dietary,
    ...(budget ? { budgetRange: budget } : {}),
    ...(adventure ? { adventurousness: adventure } : {}),
  })

  /**
   * Saves and leaves. Used by both "Skip for now" and the final step, because
   * skipping is not discarding: whatever is answered is worth keeping.
   *
   * ⚠️ A failed save must not trap the user in the quiz. The answers are a
   * nice-to-have, the way into the app is not — so a network error still lets
   * them through, and Profile → Preferences can try again later.
   */
  const saveAndFinish = async (showDone: boolean) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await submitTasteQuiz(answers())
      applyUser(res.user)
    } catch {
      /* Keep going — see above. */
    } finally {
      setSaving(false)
    }

    if (showDone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setBack(false)
      setDone(true)
    } else {
      router.replace('/(tabs)')
    }
  }

  const goNext = () => {
    setBack(false)
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1))
  }

  const goBack = () => {
    if (step === 0) {
      router.replace('/(tabs)')
      return
    }
    setBack(true)
    setStep((s) => Math.max(0, s - 1))
  }

  const toggleLoved = (name: string) =>
    setLoved((prev) =>
      prev.includes(name)
        ? prev.filter((c) => c !== name)
        : prev.length >= MAX_LOVED
          ? prev
          : [...prev, name],
    )

  const toggleDisliked = (name: string) =>
    setDisliked((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
    )

  const toggleDietary = (need: DietaryNeed) =>
    setDietary((prev) =>
      prev.includes(need) ? prev.filter((d) => d !== need) : [...prev, need],
    )

  const entering = back ? SlideInLeft : SlideInRight

  /* --- The closing screen ---------------------------------------- */
  if (done) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#080808',
          paddingTop: insets.top + 40,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View
          entering={FadeIn.duration(400)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#1a0d0d',
              borderWidth: 1,
              borderColor: 'rgba(230,57,70,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={30} color="#E63946" />
          </View>

          <Text
            style={{
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 30,
              lineHeight: 34,
              letterSpacing: -1,
              color: '#F2EDE8',
              textAlign: 'center',
            }}
          >
            Done — your picks just got personal
          </Text>

          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 14,
              lineHeight: 21,
              color: '#8A847E',
              textAlign: 'center',
            }}
          >
            Every swipe and every choice from here keeps sharpening it. Change any of
            this any time from your profile.
          </Text>
        </Animated.View>

        {/* One CTA, as specified — the quiz is over, Home is the only way on. */}
        <RedButton label="Start deciding →" onPress={() => router.replace('/(tabs)')} />
      </View>
    )
  }

  /* --- The wizard ------------------------------------------------ */
  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header: back arrow + progress dots — the Decide flow's exact pattern */}
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
          <ProgressDots active={step} count={STEP_COUNT} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <Animated.View key={step} entering={entering.duration(260)} style={{ flex: 1 }}>
        {/* --- Step 1: cuisines you love ---------------------------- */}
        {step === 0 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 1 · YOUR TASTE"
              title="What do you love?"
              // The pitch, stated once, where it earns the next 30 seconds.
              sub="30 seconds of questions. Every answer makes our picks smarter for you."
            />

            <View style={{ flex: 1, gap: 10 }}>
              {CUISINE_ROWS.map((row, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    flexGrow: 1,
                    flexBasis: 0,
                    minHeight: 64,
                    // Taller than the Decide step's 94: that screen also has to
                    // fit two utility pills and a button, this one does not, and
                    // at 94 the grid left an obvious void above the footer.
                    maxHeight: 128,
                  }}
                >
                  {row.map((c) => (
                    <CuisineTile
                      key={c.name}
                      name={c.name}
                      descriptor={c.descriptor}
                      icon={c.icon}
                      selected={loved.includes(c.name)}
                      // At the cap, unpicked tiles dim rather than silently
                      // ignoring the tap.
                      disabled={!loved.includes(c.name) && loved.length >= MAX_LOVED}
                      onPress={() => toggleLoved(c.name)}
                    />
                  ))}
                </View>
              ))}
            </View>

            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                color: '#504B47',
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              {loved.length >= MAX_LOVED
                ? `That's the ${MAX_LOVED} — tap one to swap it out`
                : `Pick up to ${MAX_LOVED}`}
            </Text>

            <View style={{ paddingTop: 10 }}>
              <RedButton
                label={loved.length ? `Continue with ${loved.length} →` : 'Continue →'}
                disabled={!loved.length}
                onPress={goNext}
              />
              <SkipLink onPress={() => saveAndFinish(false)} />
            </View>
          </View>
        )}

        {/* --- Step 2: anything you avoid --------------------------- */}
        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 2 · WHAT TO SKIP"
              title="Anything you avoid?"
              sub="Both are optional. We will keep these out of your picks where we can."
            />

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 10,
                  letterSpacing: 1.6,
                  color: '#504B47',
                  marginBottom: 10,
                }}
              >
                CUISINES
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CUISINES.filter((c) => !loved.includes(c.name)).map((c) => (
                  <AvoidChip
                    key={c.name}
                    label={c.name}
                    selected={disliked.includes(c.name)}
                    onPress={() => toggleDisliked(c.name)}
                  />
                ))}
              </View>

              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 10,
                  letterSpacing: 1.6,
                  color: '#504B47',
                  marginTop: 24,
                  marginBottom: 10,
                }}
              >
                DIETARY
              </Text>
              <View style={{ gap: 8 }}>
                {DIETARY.map((o) => (
                  <OptionRow
                    key={o.value}
                    title={o.label}
                    sub={o.note}
                    selected={dietary.includes(o.value)}
                    onPress={() => toggleDietary(o.value)}
                  />
                ))}
              </View>
              <View style={{ height: 12 }} />
            </ScrollView>

            <View style={{ paddingTop: 10 }}>
              <RedButton label="Continue →" onPress={goNext} />
              <SkipLink onPress={() => saveAndFinish(false)} />
            </View>
          </View>
        )}

        {/* --- Step 3: usual budget --------------------------------- */}
        {step === 2 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 3 · YOUR BUDGET"
              title="Your usual spend?"
              // Named explicitly: a band chosen for anniversaries would make
              // every ordinary Tuesday pick too expensive.
              sub="Think day-to-day, not special occasions. Per person."
            />

            <View style={{ gap: 10 }}>
              {BUDGETS.map((b) => (
                <OptionRow
                  key={b.value}
                  title={b.label}
                  sub={b.sub}
                  trailing={b.range}
                  selected={budget === b.value}
                  onPress={() => {
                    setBudget(b.value)
                    goNext()
                  }}
                />
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <View style={{ paddingBottom: 10 }}>
              <SkipLink onPress={() => saveAndFinish(false)} />
            </View>
          </View>
        )}

        {/* --- Step 4: adventurousness ------------------------------ */}
        {step === 3 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 4 · HOW WE PICK"
              title="How adventurous are you?"
              sub="This sets how often we slip in something you would not have chosen."
            />

            <View style={{ gap: 10 }}>
              {ADVENTURE.map((a) => (
                <OptionRow
                  key={a.value}
                  title={a.label}
                  sub={a.sub}
                  icon={a.icon}
                  selected={adventure === a.value}
                  onPress={() => {
                    setAdventure(a.value)
                    // Last question — save and show the closing screen.
                    void saveAndFinish(true)
                  }}
                />
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <View style={{ paddingBottom: 10 }}>
              <SkipLink
                onPress={() => saveAndFinish(false)}
                label={saving ? 'Saving…' : 'Skip for now'}
              />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

/**
 * A cuisine on the avoid step. Its own component because it holds press state,
 * and hooks cannot run inside a `.map()`.
 *
 * Deliberately a chip rather than a `CuisineTile`: this step is a quick "not
 * this, not that", and giving avoidance the same visual weight as the love step
 * would make the quiz feel twice as long as it is.
 */
function AvoidChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
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
      // Unstyled Pressable, styled inner View — see the note on OptionRow.
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? '#E63946' : '#242424',
          backgroundColor: selected ? '#1a0d0d' : '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        {selected ? <Ionicons name="close" size={13} color="#E63946" /> : null}
        <Text
          style={{
            fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium',
            fontSize: 14,
            color: selected ? '#E63946' : '#8A847E',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
