import AICallLogo from '@/components/icons/AICallLogo';
import ScanLogo from '@/components/icons/ScanLogo';
import { Colors, FontSizes } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, focused }: { name: IoniconsName; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons name={name} size={26} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        headerStyle: styles.header,
        headerTintColor: Colors.textOnPrimary,
        headerTitleStyle: styles.headerTitle,
        headerTitleAlign: 'left',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.headerProfileButton}
            accessibilityLabel="Open profile"
            activeOpacity={0.75}
          >
            <Ionicons name="person-circle-outline" size={29} color={Colors.textOnPrimary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: '🌿 ElderEase',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: 'Medicines',
          headerTitle: '💊 Medications',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'medical' : 'medical-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{
          title: 'Routine',
          headerTitle: '✅ Daily Routine',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <ScanLogo size={28} bgColor="transparent" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai-call"
        options={{
          title: 'AI Call',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <AICallLogo size={28} bgColor="transparent" color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
          headerTitle: 'Profile Settings',
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: 'Emergency',
          headerTitle: '🚨 Emergency',
          headerStyle: { backgroundColor: Colors.emergency },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'alert-circle' : 'alert-circle-outline'} color={color} focused={focused} />
          ),
          tabBarActiveTintColor: Colors.emergency,
        }}
      />
      <Tabs.Screen name="scan-prescription" options={{ href: null }} />
      <Tabs.Screen name="upload-report" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    backgroundColor: Colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  iconWrapper: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapperActive: {
    backgroundColor: Colors.primaryLight,
  },
  header: {
    backgroundColor: Colors.primary,
    shadowColor: 'transparent',
    elevation: 0,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  headerProfileButton: {
    marginRight: 12,
  },
});