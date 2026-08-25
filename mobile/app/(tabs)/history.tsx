import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import RedButton from '../../components/RedButton'
import GhostButton from '../../components/GhostButton'
import RestaurantDetailSheet from '../../components/RestaurantDetailSheet'
import { useAuth } from '../../contexts/AuthContext'
import { getDecisionHistory, prettyArea, type HistoryItem } from '../../lib/api'

const ACTION_META: Record<string, { label: string; color: string }> = {
  DIRECTIONS: { label: 'Directions', color: '#2DCE89' },
  ORDER: { label: 'Ordered', color: '#E8272A' },
  CALL: { label: 'Reserved', color: '#FFB547' },
  SELECT: { label: 'Selected', color: '#8A847E' },
}

/** "Today" / "Yesterday" / "Mon 4 Aug". */
function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const mo = d.toLocaleDateString('en-US', { month: 'short' })
  return `${wd} ${d.getDate()} ${mo}`
}

function Header() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 40 }}>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 40,
          color: '#F2EDE8',
          letterSpacing: -1,
        }}
      >
        Your
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 40,
          color: '#E8272A',
          letterSpacing: -1,
          fontStyle: 'italic',
          marginBottom: 24,
        }}
      >
        Decisions
      </Text>
    </View>
  )
}

function SkeletonRow() {
  const o = useSharedValue(0.4)
  useEffect(() => {
    o.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true)
  }, [o])
  const style = useAnimatedStyle(() => ({ opacity: o.value }))
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#1C1C1C',
      }}
    >
      <Animated.View
        style={[
          { width: 42, height: 42, borderRadius: 12, backgroundColor: '#1A1A1A' },
          style,
        ]}
      />
      <View style={{ flex: 1, gap: 8 }}>
        <Animated.View
          style={[{ width: '55%', height: 12, borderRadius: 6, backgroundColor: '#1A1A1A' }, style]}
        />
        <Animated.View
          style={[{ width: '35%', height: 10, borderRadius: 5, backgroundColor: '#141414' }, style]}
        />
      </View>
      <Animated.View
        style={[{ width: 62, height: 20, borderRadius: 10, backgroundColor: '#141414' }, style]}
      />
    </View>
  )
}

function HistoryRow({
  item,
  onPress,
}: {
  item: HistoryItem
  onPress: () => void
}) {
  const action = item.actionTaken ? ACTION_META[item.actionTaken] : null
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 20,
          paddingVertical: 18,
          borderBottomWidth: 1,
          borderBottomColor: '#1C1C1C',
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: 'rgba(232,39,42,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(232,39,42,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="restaurant-outline" size={18} color="#E8272A" />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#F2EDE8' }}
          numberOfLines={1}
        >
          {item.restaurantName}
        </Text>
        <Text
          style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8A847E' }}
          numberOfLines={1}
        >
          {item.cuisine} · {prettyArea(item.area)} · {item.priceRange}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {action ? (
          <View
            style={{
              borderRadius: 100,
              paddingHorizontal: 10,
              paddingVertical: 4,
              backgroundColor: `${action.color}1A`,
              borderWidth: 1,
              borderColor: `${action.color}44`,
            }}
          >
            <Text
              style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.5,
                color: action.color,
              }}
            >
              {action.label}
            </Text>
          </View>
        ) : null}
        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#504B47' }}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  )
}

export default function HistoryScreen() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [selected, setSelected] = useState<HistoryItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['history'],
    queryFn: getDecisionHistory,
    enabled: isAuthenticated,
    retry: false,
  })

  const openSheet = (item: HistoryItem) => {
    setSelected(item)
    setSheetOpen(true)
  }

  // History rows carry no phone / delivery URLs, so all actions fall back to Maps.
  const openMaps = (item: HistoryItem) =>
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(
        `${item.restaurantName} ${prettyArea(item.area)} Dubai`,
      )}`,
    )

  // Not signed in
  if (!isAuthenticated) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#080808' }}>
        <Header />
        <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 60, gap: 16 }}>
          <Ionicons name="lock-closed-outline" size={40} color="#242424" />
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              color: '#8A847E',
              textAlign: 'center',
            }}
          >
            Sign in to see your history
          </Text>
          <View style={{ width: '100%' }}>
            <RedButton label="Sign In" onPress={() => router.push('/(auth)/login')} />
          </View>
        </View>
      </ScrollView>
    )
  }

  const items = data ?? []

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <Header />

      {isLoading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : items.length === 0 || isError ? (
        <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 60, gap: 16 }}>
          <Ionicons name="time-outline" size={48} color="#242424" />
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              color: '#8A847E',
              textAlign: 'center',
            }}
          >
            No decisions yet — start with the Decide tab
          </Text>
          <View style={{ width: '100%' }}>
            <GhostButton
              label="Go to Decide"
              onPress={() => router.navigate('/(tabs)/decide')}
              style={{ alignSelf: 'center' }}
            />
          </View>
        </View>
      ) : (
        <View>
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} onPress={() => openSheet(item)} />
          ))}
        </View>
      )}

      {selected ? (
        <RestaurantDetailSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          name={selected.restaurantName}
          cuisine={selected.cuisine}
          priceRange={selected.priceRange}
          area={prettyArea(selected.area)}
          tags={selected.tags}
          ratingScore={selected.ratingScore}
          calories={selected.calories}
          onDirections={() => openMaps(selected)}
          onCall={() => openMaps(selected)}
          onOrder={() => openMaps(selected)}
        />
      ) : null}
    </ScrollView>
  )
}
