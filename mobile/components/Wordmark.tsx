import { Text, View } from 'react-native'

/**
 * The brand name as TEXT — "Jou3an", with the 3 in the brand red.
 *
 * ⚠️ Deliberately not an image. The old red `ج` mark was placeholder art and is
 * gone; the official PNG wordmark is a WEB asset and a new mark is still being
 * designed. Until it lands, type is the honest thing to render: it can never be
 * the wrong resolution, it inherits the design system's font, and it says the
 * brand name in the alphabet the rest of the app is written in.
 *
 * The "3" is the whole brand conceit (jou3an / جوعان), so it is the one glyph
 * that carries the accent colour — the same treatment the real wordmark gives
 * it, and the same one the web landing page's headline uses.
 */
export default function Wordmark({
  size = 34,
  color = '#F2EDE8',
  accent = '#E8272A',
}: {
  /** Font size in points; everything else is derived from it. */
  size?: number
  color?: string
  accent?: string
}) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Jou3an">
      <Text
        style={{
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: size,
          // Tight tracking is what makes a plain text string read as a
          // wordmark rather than as a word.
          letterSpacing: size * -0.03,
          color,
          includeFontPadding: false,
        }}
      >
        Jou<Text style={{ color: accent }}>3</Text>an
      </Text>
    </View>
  )
}
