/**
 * The onboarding taste quiz.
 *
 * Shown straight after signup, and reachable again from Profile → Preferences.
 * THREE questions, then a closing screen:
 *
 *   1. Any cuisines you'd rather skip?   -> taste weights -2 each (SOFT)
 *   2. What do you usually spend?        -> the default price-fit context
 *   3. How adventurous are you?          -> this user's base wildcard ε
 *
 * ⚠️ SKIPPABLE AT EVERY STEP, and the skip has to be real: "Skip for now" saves
 * whatever has been answered so far and leaves. A user who answers one of three
 * questions gets that one applied — the server treats every field as optional
 * precisely so this works. Nothing here blocks the way into the app.
 *
 * ⚠️ NOTHING THE QUIZ COLLECTS IS A HARD FILTER. A skipped cuisine is a lean
 * (−2 of a [−5,10] weight), so a brilliant restaurant in a skipped cuisine can
 * still win a slot, and the ε-wildcard ignores taste entirely. A budget band
 * moves the price term and caps nothing. The copy on these screens must keep
 * promising only that much — "we'll go easy on these", never "you'll never see
 * these".
 *
 * Visually it is the Decide flow's wizard: tap cards, progress dots, DM Sans,
 * no emojis. Step 1 renders the Decide step's own `CuisineTile`, in its
 * `tone="exclude"` form so a tick unmistakably means "not this one".
 */
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated'
import RedButton from '../components/RedButton'
import CuisineTile from '../components/CuisineTile'
import { CUISINE_ROWS } from '../lib/cuisines'
import { BUDGET_OPTIONS, budgetChoiceOf, budgetRangeOf, type BudgetChoice } from '../lib/budget'
import { usePressed } from '../lib/usePressed'
import { useAuth } from '../contexts/AuthContext'
import {
  submitTasteQuiz,
  type Adventurousness,
  type TasteQuizAnswers,
} from '../lib/api'

const STEPS = ['SKIP', 'BUDGET', 'ADVENTURE'] as const
const STEP_COUNT = STEPS.length

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

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

/** A full-width option row — used for budget and adventurousness. */
function OptionRow({
  title,
  sub,
  icon,
  selected,
  onPress,
}: {
  title: string
  sub?: string
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

        {selected ? (
          <Ionicons name="checkmark-circle" size={20} color="#E63946" />
        ) : null}
      </View>
    </Pressable>
  )
}

/**
 * A slim utility pill — the "None — I eat everything" answer on step 1.
 *
 * Deliberately a different WEIGHT from the grid tiles rather than a ninth tile:
 * it is an answer to the whole question, not another cuisine, and three
 * identically-sized boxes read as a flat stack (the same lesson as the Decide
 * flow's utility rows).
 */
function QuickRow({
  label,
  sub,
  icon,
  onPress,
}: {
  label: string
  sub?: string
  icon: keyof typeof Ionicons.glyphMap
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
      style={{ alignSelf: 'stretch' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#242424',
          backgroundColor: '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        <Ionicons name={icon} size={18} color="#8A847E" />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#F2EDE8' }}
          >
            {label}
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
        <Ionicons name="chevron-forward" size={16} color="#504B47" />
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

/**
 * Everything the quiz can answer, in the shape the screen holds it.
 *
 * Exists so a step can hand `saveAndFinish` the value it has just chosen
 * instead of relying on state React has not applied yet — see saveAndFinish.
 */
interface Answered {
  skipped: string[]
  /** null = not answered this run; 'ANY' = answered "No budget". */
  budget: BudgetChoice | null
  adventure: Adventurousness | null
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
  const [skipped, setSkipped] = useState<string[]>(user?.dislikedCuisines ?? [])
  /**
   * null means "not answered in this run", which is NOT the same as 'ANY'
   * ("No budget") — only an answered question is submitted.
   *
   * ⚠️ A stored null is ambiguous on its own: it is both "No budget" and "never
   * asked". `tasteQuizCompletedAt` is what disambiguates — once the quiz has
   * been finished, a null band is a real answer worth showing as selected.
   */
  const [budget, setBudget] = useState<BudgetChoice | null>(
    user?.tasteQuizCompletedAt ? budgetChoiceOf(user.budgetRange) : null,
  )
  const [adventure, setAdventure] = useState<Adventurousness | null>(
    user?.adventurousness ?? null,
  )

  /**
   * Only fields this run actually answered are sent; everything else keeps its
   * stored value, which is what makes a skip lossless.
   *
   * ⚠️ `lovedCuisines` and `dietary` are deliberately NEVER sent from here: the
   * quiz does not ask about them any more, and sending an empty array would
   * CLEAR what Profile → Preferences has saved.
   */
  const answers = (over: Partial<Answered> = {}): TasteQuizAnswers => {
    const current: Answered = { skipped, budget, adventure, ...over }
    return {
      dislikedCuisines: current.skipped,
      // `budgetRangeOf('ANY')` is null — an explicit "no band", not a no-op.
      ...(current.budget !== null ? { budgetRange: budgetRangeOf(current.budget) } : {}),
      ...(current.adventure ? { adventurousness: current.adventure } : {}),
    }
  }

  /**
   * Saves and leaves. Used by both "Skip for now" and the final step, because
   * skipping is not discarding: whatever is answered is worth keeping.
   *
   * ⚠️ A failed save must not trap the user in the quiz. The answers are a
   * nice-to-have, the way into the app is not — so a network error still lets
   * them through, and Profile → Preferences can try again later.
   *
   * ⚠️ `over` is not a convenience — it is REQUIRED for the answer that
   * triggers the save. The last step sets its state and submits in the same
   * tick, so the closure here still holds the PREVIOUS render's value and the
   * final answer would be dropped from the payload. (It was: adventurousness
   * never reached the server from step 3.) Pass the value, don't trust the
   * state you just set.
   */
  const saveAndFinish = async (showDone: boolean, over: Partial<Answered> = {}) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await submitTasteQuiz(answers(over))
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

  const toggleSkipped = (name: string) =>
    setSkipped((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name],
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
        {/* --- Step 1: cuisines to skip ----------------------------- */}
        {step === 0 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 1 · YOUR TASTE"
              title="Any cuisines you'd rather skip?"
              // ⚠️ Two jobs, both load-bearing. It states the DIRECTION of a
              // tap ("tap what you don't want"), because a highlighted tile
              // cannot say on its own whether it means want or avoid. And it
              // states the STRENGTH honestly — these are deprioritised, not
              // banned, which is exactly what a -2 taste weight does.
              sub="20 seconds. Every answer makes our picks smarter for you. Tap anything you don't want sent your way — we'll go easy on it, not ban it."
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
                    // fit two utility pills and a button, this one has one pill.
                    maxHeight: 118,
                  }}
                >
                  {row.map((c) => (
                    <CuisineTile
                      key={c.name}
                      name={c.name}
                      descriptor={c.descriptor}
                      icon={c.icon}
                      selected={skipped.includes(c.name)}
                      // A tick here means "not this one" — struck-through name,
                      // ✕ in the corner. No cap: skipping everything is a
                      // legitimate (if unhelpful) answer, and the engine still
                      // returns 3 because this never filters.
                      tone="exclude"
                      onPress={() => toggleSkipped(c.name)}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={{ paddingTop: 12, gap: 10 }}>
              <QuickRow
                label="None — I eat everything"
                sub="Nothing held back"
                icon="checkmark-done-outline"
                onPress={() => {
                  setSkipped([])
                  goNext()
                }}
              />
              <RedButton
                label={
                  skipped.length ? `Continue, skipping ${skipped.length} →` : 'Continue →'
                }
                onPress={goNext}
              />
              <SkipLink onPress={() => saveAndFinish(false)} />
            </View>
          </View>
        )}

        {/* --- Step 2: usual spend ---------------------------------- */}
        {step === 1 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 2 · YOUR BUDGET"
              title="What do you usually spend on a meal out?"
              // ⚠️ Says what the answer DOES, because the honest answer to "will
              // this cap my results forever?" is no: it is a lean on the price
              // term, changeable from the Decide screen on any single query.
              sub="Per person, everyday meals. It nudges our picks — it doesn't cap them, and you can change it any time."
            />

            <View style={{ gap: 10 }}>
              {BUDGET_OPTIONS.map((b) => (
                <OptionRow
                  key={b.value}
                  title={b.label}
                  sub={b.sub}
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

        {/* --- Step 3: adventurousness ------------------------------ */}
        {step === 2 && (
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 10 }}>
            <StepHeading
              eyebrow="STEP 3 · HOW WE PICK"
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
                    // Last question — save and show the closing screen. The
                    // value goes in explicitly: `adventure` is still null in
                    // this closure. See saveAndFinish.
                    void saveAndFinish(true, { adventure: a.value })
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
