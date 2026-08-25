import { useState } from 'react'
import { View, Text, TextInput, Pressable, Linking } from 'react-native'
import type { TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import RedButton from '../../components/RedButton'
import { useAuth } from '../../contexts/AuthContext'
import { usePressed } from '../../lib/usePressed'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

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
  const [error, setError] = useState<string | null>(null)
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
    setError(null)
    // All fields are mandatory.
    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirm) {
      setShowErrors(true)
      setError('Please fill in all fields.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), phone.trim(), password)
      router.replace('/onboarding')
    } catch {
      setError('Unable to create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const onGoogle = () => {
    Linking.openURL(`${API_URL}/api/auth/google`).catch(() => {
      setError('Google sign-in is unavailable right now.')
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

      {/* Logo mark */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: '#E8272A',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontWeight: '800',
            fontFamily: 'DMSans_800ExtraBold',
          }}
        >
          ج
        </Text>
      </View>

      <Text
        style={{
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

      <RedButton
        label={loading ? 'Creating…' : 'Create Account'}
        onPress={onSubmit}
        disabled={loading}
        style={{ marginTop: 16 }}
      />
      {error ? (
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 13,
            color: '#E8272A',
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          {error}
        </Text>
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
