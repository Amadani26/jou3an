import type { ReactNode } from 'react'
import { Tabs } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type TabButtonProps = {
  children?: ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPress?: ((e: any) => void) | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLongPress?: ((e: any) => void) | null
  accessibilityState?: { selected?: boolean }
}

/** Custom tab button that renders a small red dot above the active icon. */
function TabButton({
  children,
  onPress,
  onLongPress,
  accessibilityState,
}: TabButtonProps) {
  const focused = accessibilityState?.selected
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: 'transparent', borderless: true }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {focused ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#E8272A',
          }}
        />
      ) : null}
      {children}
    </Pressable>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E8272A',
        tabBarInactiveTintColor: '#504B47',
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarStyle: {
          backgroundColor: '#080808',
          borderTopColor: '#1C1C1C',
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 0,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: 'transparent',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          marginTop: 3,
        },
        tabBarIconStyle: { marginTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="decide"
        options={{
          title: 'Decide',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'flash' : 'flash-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tinder"
        options={{
          title: 'Swipe',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'flame' : 'flame-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}
