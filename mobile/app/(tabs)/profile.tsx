import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Switch, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import RedButton from '../../components/RedButton'
import GhostButton from '../../components/GhostButton'
import BudgetSheet from '../../components/BudgetSheet'
import { useAuth } from '../../contexts/AuthContext'
import {
  getDecisionHistory,
  prettyTag,
  updatePreferences,
  type Adventurousness,
  type DietaryNeed,
  type User,
} from '../../lib/api'
import {
  budgetChoiceOf,
  budgetLabel,
  budgetRangeOf,
  type BudgetChoice,
} from '../../lib/budget'
import { usePressed } from '../../lib/usePressed'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * The dietary needs offered here.
 *
 * ⚠️ Profile is now the ONLY place these are set — the taste quiz is three
 * questions (skip / budget / adventurousness) and no longer asks. They are a
 * real Stage-1 exclusion, so losing the UI would have quietly lost the feature.
 *
 * ⚠️ `no-pork` is deliberately NOT offered. The server stores it and enforces
 * nothing (nothing in the catalogue marks pork, and excluding whole cuisines by
 * stereotype is the only way to "implement" it), so offering a toggle that does
 * nothing is worse than not offering it. The slug stays supported for anyone
 * who already saved it — see server/src/lib/dietary.ts.
 */
const DIETARY_OPTIONS: { value: DietaryNeed; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten-free' },
]

/** The taste quiz's last step, as a one-word summary. */
const ADVENTUROUSNESS_LABELS: Record<Adventurousness, string> = {
  SAFE: 'My favorites',
  BALANCED: 'Mix it up',
  ADVENTUROUS: 'Surprise me',
}

/** Up to two initials from the user's name (falls back to the email). */
function initialsFor(user: User): string {
  const source = (user.name || user.email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

function Avatar({ user }: { user: User }) {
  return (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1a0a0a',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 30,
          fontWeight: '700',
          color: '#FFFFFF',
          letterSpacing: 1,
        }}
      >
        {initialsFor(user)}
      </Text>
    </View>
  )
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#111111',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 20,
          fontWeight: '700',
          color: '#FFFFFF',
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 11,
          color: '#666',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.5,
          color: '#555',
          textTransform: 'uppercase',
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: '#111111',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  )
}

function Row({
  label,
  value,
  onPress,
  danger,
  muted,
  right,
  last,
}: {
  label: string
  value?: string
  onPress?: () => void
  danger?: boolean
  muted?: boolean
  right?: React.ReactNode
  last?: boolean
}) {
  const labelColor = danger ? (muted ? '#7A2A2C' : '#E8272A') : '#F2EDE8'
  const { pressed, pressHandlers } = usePressed()

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      {...pressHandlers}
      // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#1A1A1A',
        opacity: pressed && onPress ? 0.6 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_500Medium',
          fontSize: 15,
          color: labelColor,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 14,
            color: '#666',
            marginRight: onPress ? 6 : 0,
            maxWidth: 180,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? (
        <Ionicons name="chevron-forward" size={18} color="#3a3a3a" />
      ) : null}
    </Pressable>
  )
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isAuthenticated, user, logout, applyUser } = useAuth()
  const [notifications, setNotifications] = useState(true)

  /* --- Live preference editing -----------------------------------
   *
   * Budget and dietary are edited HERE rather than by routing to the quiz: the
   * quiz no longer asks about either, and a setting you change in one tap
   * should not cost a three-screen wizard.
   *
   * ⚠️ Optimistic, then reconciled. The row shows the new value immediately and
   * the PATCH follows; the server's reply replaces the cached user (applyUser)
   * so nothing can drift, and a failure reverts the row and says so. The engine
   * reads the SAVED value on the next decision, which is why a silent failure
   * here would be a lie about what the app will do.
   */
  const [budgetSheet, setBudgetSheet] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState<BudgetChoice | null>(null)
  const [dietaryOpen, setDietaryOpen] = useState(false)
  const [dietaryDraft, setDietaryDraft] = useState<DietaryNeed[] | null>(null)
  const [savingPref, setSavingPref] = useState(false)

  // A fresh user (a quiz save, a re-login) invalidates any local draft.
  useEffect(() => {
    setBudgetDraft(null)
    setDietaryDraft(null)
  }, [user?.updatedAt])

  const savePref = async (
    patch: Parameters<typeof updatePreferences>[0],
    revert: () => void,
  ) => {
    if (savingPref) return
    setSavingPref(true)
    try {
      applyUser(await updatePreferences(patch))
    } catch {
      revert()
      Alert.alert(
        'Could not save',
        'That change did not reach us. Check your connection and try again.',
      )
    } finally {
      setSavingPref(false)
    }
  }

  // Stats are derived from the signed-in user's decision history.
  const { data: history } = useQuery({
    queryKey: ['decision-history'],
    queryFn: getDecisionHistory,
    enabled: isAuthenticated,
    retry: false,
  })

  const decisionsMade = history?.length ?? 0
  const restaurantsTried = history
    ? new Set(history.map((h) => h.restaurantId)).size
    : 0
  const favouriteCuisine = (() => {
    if (!history || history.length === 0) return '—'
    const counts = new Map<string, number>()
    for (const h of history) counts.set(h.cuisine, (counts.get(h.cuisine) ?? 0) + 1)
    let best = '—'
    let bestN = 0
    for (const [cuisine, n] of counts) {
      if (n > bestN) {
        best = cuisine
        bestN = n
      }
    }
    return best
  })()

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This will permanently remove your account and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => logout() },
      ],
    )
  }

  /* ---------- Logged out ---------- */
  if (!isAuthenticated || !user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#080808',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 16,
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
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontFamily: 'DMSans_800ExtraBold',
            }}
          >
            ج
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 18,
            color: '#F2EDE8',
            textAlign: 'center',
          }}
        >
          Sign in to view your profile
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 14,
            color: '#666',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Track your decisions, save preferences, and pick up where you left off.
        </Text>
        <View style={{ width: '100%', gap: 12 }}>
          <RedButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
          <GhostButton
            label="Create Account"
            onPress={() => router.push('/(auth)/signup')}
          />
        </View>
      </View>
    )
  }

  /* ---------- Logged in ---------- */
  // The draft wins while a save is in flight, so the row shows what the user
  // just tapped rather than snapping back for a moment.
  const budgetChoice = budgetDraft ?? budgetChoiceOf(user.budgetRange)
  const dietary = dietaryDraft ?? (user.dietary as DietaryNeed[])
  const dietaryValue = dietary.length > 0 ? dietary.map(prettyTag).join(', ') : 'None'
  const skipValue =
    user.dislikedCuisines.length > 0
      ? user.dislikedCuisines.map(prettyTag).join(', ')
      : 'None'

  const chooseBudget = (choice: BudgetChoice) => {
    const previous = budgetChoiceOf(user.budgetRange)
    setBudgetSheet(false)
    if (choice === previous) return
    setBudgetDraft(choice)
    void savePref({ budgetRange: budgetRangeOf(choice) }, () => setBudgetDraft(null))
  }

  const toggleDietary = (need: DietaryNeed) => {
    const previous = dietary
    const next = previous.includes(need)
      ? previous.filter((d) => d !== need)
      : [...previous, need]
    setDietaryDraft(next)
    void savePref({ dietary: next }, () => setDietaryDraft(previous))
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 24,
      }}
    >
      {/* Header */}
      <View style={{ gap: 10 }}>
        <Avatar user={user} />
        <Text
          style={{
            fontFamily: 'DMSans_700Bold',
            fontSize: 20,
            fontWeight: '700',
            color: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          {user.name || 'Your Profile'}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 13,
            color: '#666',
            textAlign: 'center',
            marginTop: -4,
          }}
        >
          {user.email}
        </Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile value={decisionsMade} label="Decisions Made" />
        <StatTile value={restaurantsTried} label="Restaurants Tried" />
        <StatTile value={favouriteCuisine} label="Favourite Cuisine" />
      </View>

      {/* Preferences
          Budget and dietary are edited in place (one tap, saved immediately);
          the two the quiz owns route into it. */}
      <SectionCard title="Preferences">
        <Row
          label="Usual spend"
          value={budgetLabel(budgetChoice)}
          onPress={() => setBudgetSheet(true)}
        />
        <Row
          label="Cuisines to skip"
          value={skipValue}
          onPress={() => router.push('/onboarding')}
        />
        <Row
          label="Dietary needs"
          value={dietaryValue}
          onPress={() => setDietaryOpen((o) => !o)}
          right={
            <Ionicons
              name={dietaryOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#504B47"
            />
          }
        />
        {/* Expands in place rather than opening a screen: three toggles do not
            justify a destination, and seeing them next to the saved value is
            what makes it obvious they ARE the saved value. */}
        {dietaryOpen ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderBottomColor: '#1A1A1A',
            }}
          >
            {DIETARY_OPTIONS.map((o) => (
              <DietaryChip
                key={o.value}
                label={o.label}
                selected={dietary.includes(o.value)}
                onPress={() => toggleDietary(o.value)}
              />
            ))}
          </View>
        ) : null}
        <Row
          label="How we pick"
          value={ADVENTUROUSNESS_LABELS[user.adventurousness]}
          onPress={() => router.push('/onboarding')}
        />
        {/* The quiz is skippable, so this is the nudge for anyone who skipped
            it — and the same screens handle an edit, so there is one route. */}
        <Row
          label={user.tasteQuizCompletedAt ? 'Retake taste quiz' : 'Take the taste quiz'}
          value={user.tasteQuizCompletedAt ? undefined : '20 seconds'}
          onPress={() => router.push('/onboarding')}
          last
        />
      </SectionCard>

      {/* Account */}
      <SectionCard title="Account">
        <Row label="Edit profile" onPress={() => router.push('/onboarding')} />
        <Row
          label="Change password"
          onPress={() =>
            Alert.alert('Change password', 'Password changes are coming soon.')
          }
        />
        <Row
          label="Upgrade to Pro"
          onPress={() => router.push('/pro')}
        />
        <Row
          label="Notifications"
          last
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#242424', true: '#E8272A' }}
              thumbColor="#F2EDE8"
            />
          }
        />
      </SectionCard>

      {/* Danger zone */}
      <SectionCard title="Danger zone">
        <Row label="Log out" danger onPress={() => logout()} />
        <Row label="Delete account" danger muted onPress={confirmDelete} last />
      </SectionCard>

      {/* The same selector the Decide flow's budget pill opens. */}
      <BudgetSheet
        visible={budgetSheet}
        value={budgetChoice}
        onSelect={chooseBudget}
        onClose={() => setBudgetSheet(false)}
        note="Per person, everyday meals. Applies from your next decision — it nudges our picks, it never caps them."
      />
    </ScrollView>
  )
}

/**
 * One dietary need. Its own component because it holds press state, and hooks
 * cannot run inside a `.map()`.
 */
function DietaryChip({
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
    <Pressable onPress={onPress} {...pressHandlers}>
      {/* Unstyled Pressable, styled inner View — see lib/usePressed. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 13,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? '#E63946' : '#242424',
          backgroundColor: selected ? '#1a0d0d' : '#141414',
          opacity: pressed ? 0.75 : 1,
        }}
      >
        {selected ? <Ionicons name="checkmark" size={13} color="#E63946" /> : null}
        <Text
          style={{
            fontFamily: selected ? 'DMSans_700Bold' : 'DMSans_500Medium',
            fontSize: 13,
            color: selected ? '#E63946' : '#8A847E',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
