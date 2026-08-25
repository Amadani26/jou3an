import { View, Text, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native'
import type { ComponentProps } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import RedButton from '../../components/RedButton'
import {
  getRestaurant,
  prettyArea,
  prettyTag,
  deliveryUrl,
  type Restaurant,
} from '../../lib/api'

type IconName = ComponentProps<typeof Ionicons>['name']

function GhostAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName
  label: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: '#242424',
          borderRadius: 100,
          paddingVertical: 14,
          minHeight: 44,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={18} color="#8A847E" />
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 12,
          letterSpacing: 1.5,
          color: '#8A847E',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SmallPill({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#242424',
        borderRadius: 100,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#8A847E' }}>
        {text}
      </Text>
    </View>
  )
}

export default function RestaurantScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => getRestaurant(id as string),
    enabled: Boolean(id),
    retry: false,
  })

  const openDirections = (rest: Restaurant) =>
    Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(
        `${rest.name} ${prettyArea(rest.area)} Dubai`,
      )}`,
    )

  const platforms = r
    ? [
        { name: 'Talabat', url: r.talabatUrl },
        { name: 'Noon', url: r.noonUrl },
        { name: 'Deliveroo', url: r.deliverooUrl },
      ].filter((p) => p.url)
    : []

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#080808' }}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      {/* Back */}
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 20 }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={20} color="#504B47" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ paddingTop: 80 }}>
          <ActivityIndicator color="#E8272A" />
        </View>
      ) : isError || !r ? (
        <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 12 }}>
          <Ionicons name="alert-circle-outline" size={40} color="#242424" />
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#504B47' }}>
            Restaurant not found.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 16 }}>
          <Text
            style={{
              fontFamily: 'DMSans_800ExtraBold',
              fontSize: 28,
              color: '#F2EDE8',
              letterSpacing: -0.5,
            }}
          >
            {r.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
              {r.cuisineType}
            </Text>
            <Ionicons name="location-outline" size={13} color="#8A847E" />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8A847E' }}>
              {prettyArea(r.area)}
            </Text>
          </View>

          <Text style={{ fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: '#FFB547' }}>
            AED {r.priceMin}–{r.priceMax}
          </Text>

          {/* Rating stars */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons
                key={i}
                name={i <= Math.round(r.ratingScore) ? 'star' : 'star-outline'}
                size={14}
                color="#FFB547"
              />
            ))}
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#8A847E', marginLeft: 4 }}>
              {r.ratingScore.toFixed(1)}
            </Text>
          </View>

          {/* Tags */}
          {r.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {r.tags.map((t) => (
                <SmallPill key={t} text={prettyTag(t)} />
              ))}
            </View>
          ) : null}

          {/* Delivery platforms */}
          {platforms.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: 10,
                  letterSpacing: 2,
                  color: '#504B47',
                }}
              >
                AVAILABLE ON
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {platforms.map((p) => (
                  <SmallPill key={p.name} text={p.name} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Actions */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <GhostAction
              icon="navigate-outline"
              label="Directions"
              onPress={() => openDirections(r)}
            />
            <GhostAction
              icon="call-outline"
              label="Reserve"
              onPress={() =>
                r.phone ? Linking.openURL(`tel:${r.phone}`) : openDirections(r)
              }
            />
            <RedButton
              label="Order Delivery"
              onPress={() => {
                const url = deliveryUrl(r)
                if (url) Linking.openURL(url)
                else openDirections(r)
              }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  )
}
