import { useState } from 'react'
import { View, Text, TextInput, Pressable, Linking } from 'react-native'
import type { TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import RedButton from '../../components/RedButton'
import Wordmark from '../../components/Wordmark'
import { useAuth } from '../../contexts/AuthContext'
import { usePressed } from '../../lib/usePressed'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { API_BASE_URL, signupFailureOf, type SignupFailure } from '../../lib/api'
import { PRIVACY_URL, TERMS_URL, openLegal } from '../../lib/legal'


const fieldStyle = {
  paddingHorizontal: 18,
  paddingVertical: 16,
  fontSize: 16,
  color: '#F2EDE8',
  fontFamily: 'DMSans_400Regular' as const,
  backgroundColor: 'transparent' as const,
}

const divider = { height: 1, backgroundColor: '#242424' }

/** A grouped-card input row that flags a red asterisk + tint when empty on submit. */
function Field({ error, ...props }: TextInputProps & { error?: boolean }) {
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput
        {...props}
        placeholderTextColor="#504B47"
        style={[fieldStyle, error ? { backgroundColor: 'rgba(232,39,42,0.06)' } : null]}
      />
      {error ? (
        <Text
          style={{
            position: 'absolute',
            right: 16,
            color: '#E8272A',
            fontSize: 18,
            fontFamily: 'DMSans_700Bold',
          }}
        >
          *
        </Text>
      ) : null}
    </View>
  )
}

export default function SignupScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // The failure KIND, not just a string: a duplicate email earns a link to
  // Sign In, and nothing else does.
  const [failure, setFailure] = useState<SignupFailure | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [loading, setLoading] = useState(false)
  const googlePress = usePressed()

  // Per-field "empty on submit" flags — drive the red asterisk + tint.
  const emptyName = showErrors && !name.trim()
  const emptyEmail = showErrors && !email.trim()
  const emptyPhone = showErrors && !phone.trim()
  const emptyPassword = showErrors && !password
  const emptyConfirm = showErrors && !confirm

  const onSubmit = async () => {
    setFailure(null)
    // All fields are mandatory.
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirm) {
      setShowErrors(true)
      setFailure({ kind: 'validation', message: 'Please fill in all fields.' })
      return
    }
    if (password !== confirm) {
      setFailure({ kind: 'validation', message: 'Passwords do not match.' })
      return
    }
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), phone.trim(), password)
      router.replace('/onboarding')
    } catch (err) {
      // The server says WHY; repeating "please try again" at someone whose
      // email is already registered sends them round a loop that cannot end.
      setFailure(signupFailureOf(err))
    } finally {
      setLoading(false)
    }
  }

  const onGoogle = () => {
    Linking.openURL(`${API_BASE_URL}/api/auth/google`).catch(() => {
      setFailure({
        kind: 'unknown',
        message: 'Google sign-in is unavailable right now.',
      })
    })
  }

  // Leave auth without completing it — always go straight back to the app.
  // replace() (not back()) so login/signup never chain through each other.
  const goBack = () => {
    router.replace('/(tabs)')
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#080808',
        paddingHorizontal: 24,
        paddingTop: insets.top,
        justifyContent: 'center',
      }}
    >
      {/* Close / back */}
      <Pressable
        onPress={goBack}
        hitSlop={12}
        accessibilityLabel="Close"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 20,
          zIndex: 10,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={26} color="#8A847E" />
      </Pressable>

      {/* Text wordmark — the `ج` mark is gone and a new one is being drawn;
          type is the honest placeholder. See components/Wordmark. */}
      <Wordmark size={26} />

      <Text
        style={{
          marginTop: 14,
          fontFamily: 'DMSans_800ExtraBold',
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: -1,
          color: '#F2EDE8',
        }}
      >
        Create Account
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 14,
          color: '#8A847E',
          marginTop: 6,
          marginBottom: 32,
        }}
      >
        Join Dubai&apos;s food decision engine.
      </Text>

      {/* Grouped input fields */}
      <View
        style={{
          backgroundColor: '#141414',
          borderWidth: 1,
          borderColor: '#242424',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <Field
          placeholder="Name"
          value={name}
          onChangeText={setName}
          error={emptyName}
        />
        <View style={divider} />
        <Field
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={emptyEmail}
        />
        <View style={divider} />
        <Field
          placeholder="Phone number"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
          error={emptyPhone}
        />
        <View style={divider} />
        <Field
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={emptyPassword}
        />
        <View style={divider} />
        <Field
          placeholder="Confirm Password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          error={emptyConfirm}
        />
      </View>

      {/* ⚠️ The consent line sits ABOVE the button, not below it. Below, it is
          something you read after agreeing; above, it is part of what you are
          agreeing to. Both documents are hosted on the website — see
          lib/legal. */}
      <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            lineHeight: 18,
            color: '#8A847E',
            textAlign: 'center',
          }}
        >
          By creating an account you agree to our{' '}
          <Text
            onPress={() => openLegal(TERMS_URL)}
            suppressHighlighting
            accessibilityRole="link"
            style={{
              fontFamily: 'DMSans_600SemiBold',
              color: '#F2EDE8',
              textDecorationLine: 'underline',
            }}
          >
            Terms
          </Text>{' '}
          and{' '}
          <Text
            onPress={() => openLegal(PRIVACY_URL)}
            suppressHighlighting
            accessibilityRole="link"
            style={{
              fontFamily: 'DMSans_600SemiBold',
              color: '#F2EDE8',
              textDecorationLine: 'underline',
            }}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>

      <RedButton
        label={loading ? 'Creating…' : 'Create Account'}
        onPress={onSubmit}
        disabled={loading}
        style={{ marginTop: 14 }}
      />
      {failure ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={{ marginTop: 12, alignItems: 'center', gap: 6 }}
        >
          <Text
            style={{
              fontFamily: 'DMSans_500Medium',
              fontSize: 13,
              color: failure.kind === 'network' ? '#8A847E' : '#E8272A',
              textAlign: 'center',
            }}
          >
            {failure.message}
          </Text>

          {/* The only actionable failure: the account exists, so offer the
              door it is behind rather than making them find it. */}
          {failure.kind === 'duplicate' ? (
            <Link href="/(auth)/login" replace asChild>
              <Pressable hitSlop={10} accessibilityRole="link">
                <Text
                  style={{
                    fontFamily: 'DMSans_700Bold',
                    fontSize: 13,
                    color: '#F2EDE8',
                    textDecorationLine: 'underline',
                  }}
                >
                  Sign in instead
                </Text>
              </Pressable>
            </Link>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Divider */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginVertical: 20,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: '#242424' }} />
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 12,
            color: '#504B47',
            marginHorizontal: 12,
          }}
        >
          or
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: '#242424' }} />
      </View>

      {/* Google button */}
      <Pressable
        onPress={onGoogle}
        {...googlePress.pressHandlers}
        // Plain style, NOT ({ pressed }) => [...] — see lib/usePressed.
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#141414',
          borderWidth: 1,
          borderColor: '#242424',
          borderRadius: 100,
          paddingVertical: 14,
          opacity: googlePress.pressed ? 0.75 : 1,
        }}
      >
        <Text
          style={{
            fontFamily: 'DMSans_800ExtraBold',
            fontWeight: '800',
            fontSize: 16,
            color: '#E8272A',
          }}
        >
          G
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_600SemiBold',
            fontSize: 15,
            color: '#F2EDE8',
          }}
        >
          Continue with Google
        </Text>
      </Pressable>

      {/* Bottom link */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 28,
        }}
      >
        <Text
          style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8A847E' }}
        >
          Already have an account?{' '}
        </Text>
        <Link href="/(auth)/login" replace asChild>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 13,
              fontWeight: '700',
              color: '#E8272A',
            }}
          >
            Sign in
          </Text>
        </Link>
      </View>
    </View>
  )
}
