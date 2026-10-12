import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

/**
 * Google's rating as a compact badge — one gold star, the score to one decimal,
 * and the review count when we have it.
 *
 * ⚠️ `googleRating` is the ONLY rating the app ever displays (the seeded 0–10
 * `ratingScore` is ranking-only), and a null rating is a REAL state: ~every
 * unsynced row has one. This renders NOTHING in that case rather than showing a
 * dash or a zero — the same rule RestaurantDetailSheet and SelectionReward
 * already follow for the full rating row.
 *
 * One star, not five. Five 9pt stars on a 132pt card image is noise, and the
 * number is what people actually read; the app's existing rating rows already
 * use a single gold star, so this stays consistent with them.
 */

export const RATING_GOLD = '#FFB547'

/**
 * "2.1k" / "12k" / "840" — a four-digit count in a pill this small reads as a
 * price, so anything over a thousand is abbreviated.
 */
export function formatReviewCount(count: number): string {
  if (count >= 10_000) return `${Math.round(count / 1000)}k`
  if (count >= 1_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(count))
}

export interface RatingBadgeProps {
  rating?: number | null
  /** Google's review count. Omitted or null simply hides the "(2.1k)" half. */
  count?: number | null
  /**
   * `glass` sits ON a photo (translucent ink + hairline, so it reads at any
   * brightness); `plain` sits on a card surface.
   */
  tone?: 'glass' | 'plain'
  size?: 'sm' | 'md'
}

export default function RatingBadge({
  rating,
  count,
  tone = 'glass',
  size = 'md',
}: RatingBadgeProps) {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null

  const md = size === 'md'
  const starSize = md ? 12 : 10
  const scoreSize = md ? 13 : 12
  const countSize = md ? 11 : 10

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: md ? 8 : 7,
        paddingRight: md ? 9 : 8,
        paddingVertical: md ? 4 : 3,
        borderRadius: 999,
        backgroundColor: tone === 'glass' ? 'rgba(8,8,8,0.68)' : '#1A1A1A',
        borderWidth: 1,
        borderColor: tone === 'glass' ? 'rgba(255,255,255,0.14)' : '#242424',
      }}
    >
      <Ionicons name="star" size={starSize} color={RATING_GOLD} />
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: scoreSize,
          color: '#F2EDE8',
          letterSpacing: -0.1,
        }}
      >
        {rating.toFixed(1)}
      </Text>
      {typeof count === 'number' && count > 0 ? (
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: countSize,
            color: '#8A847E',
          }}
        >
          ({formatReviewCount(count)})
        </Text>
      ) : null}
    </View>
  )
}
