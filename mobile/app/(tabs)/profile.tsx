import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Switch, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import RedButton from '../../components/RedButton'
import GhostButton from '../../components/GhostButton'
import { useAuth } from '../../contexts/AuthContext'
import { getDecisionHistory, prettyTag, type User, type BudgetRange } from '../../lib/api'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const BUDGET_LABELS: Record<BudgetRange, string> = {
  LOW: 'Budget',
  MID: 'Mid-range',
  HIGH: 'Premium',
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 15,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: '#1A1A1A',
        },
        pressed && onPress ? { opacity: 0.6 } : null,
      ]}
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
  const { isAuthenticated, user, logout } = useAuth()
  const [notifications, setNotifications] = useState(true)

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
  const cuisineValue =
    user.cuisinePreferences.length > 0
      ? user.cuisinePreferences.map(prettyTag).join(', ')
      : 'Not set'
  const dietaryValue =
    user.dietary.length > 0 ? user.dietary.map(prettyTag).join(', ') : 'None'

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

      {/* Preferences */}
      <SectionCard title="Preferences">
        <Row
          label="Cuisine preferences"
          value={cuisineValue}
          onPress={() => router.push('/onboarding')}
        />
        <Row
          label="Budget range"
          value={BUDGET_LABELS[user.budgetRange]}
          onPress={() => router.push('/onboarding')}
        />
        <Row
          label="Dietary"
          value={dietaryValue}
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
    </ScrollView>
  )
}
