import { useState } from 'react'
import { View, Text, TextInput, Pressable, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, Link } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import RedButton from '../../components/RedButton'
import { useAuth } from '../../contexts/AuthContext'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch {
      setError('Unable to sign in. Check your credentials.')
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
        Welcome back
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
        Sign in to keep deciding.
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
        <TextInput
          style={{
            paddingHorizontal: 18,
            paddingVertical: 16,
            fontSize: 16,
            color: '#F2EDE8',
            fontFamily: 'DMSans_400Regular',
            backgroundColor: 'transparent',
          }}
          placeholder="Email"
          placeholderTextColor="#504B47"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={{ height: 1, backgroundColor: '#242424' }} />
        <TextInput
          style={{
            paddingHorizontal: 18,
            paddingVertical: 16,
            fontSize: 16,
            color: '#F2EDE8',
            fontFamily: 'DMSans_400Regular',
            backgroundColor: 'transparent',
          }}
          placeholder="Password"
          placeholderTextColor="#504B47"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <RedButton
        label={loading ? 'Signing in…' : 'Sign In'}
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
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#141414',
            borderWidth: 1,
            borderColor: '#242424',
            borderRadius: 100,
            paddingVertical: 14,
          },
          pressed && { opacity: 0.75 },
        ]}
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
          No account?{' '}
        </Text>
        <Link href="/(auth)/signup" replace asChild>
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: 13,
              fontWeight: '700',
              color: '#E8272A',
            }}
          >
            Sign up
          </Text>
        </Link>
      </View>
    </View>
  )
}
