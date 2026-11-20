import './src/i18n';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './src/auth';
import { LoginScreen } from './src/screens/LoginScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { LogScreen } from './src/screens/LogScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ChildScreen } from './src/screens/ChildScreen';
import { GalleryScreen } from './src/screens/GalleryScreen';
import { AdminScreen } from './src/screens/AdminScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { colors } from './src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeTabIcon } from './src/navigation/tabIcons';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabOptions(title: string, routeName: string) {
  return { title, tabBarIcon: makeTabIcon(routeName) };
}

function RoleTabs() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = user?.role;
  const screenOpts = {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      paddingTop: 6,
      height: 56 + Math.max(insets.bottom, 8),
      paddingBottom: Math.max(insets.bottom, 8),
    },
  };

  if (role === 'Admin') {
    return (
      <Tabs.Navigator screenOptions={screenOpts}>
        <Tabs.Screen name="Dash" component={AdminScreen} options={tabOptions(t('dashboard'), 'Dash')} />
        <Tabs.Screen name="Photos" component={GalleryScreen} options={tabOptions(t('photos'), 'Photos')} />
        <Tabs.Screen name="Chat" component={ChatScreen} options={tabOptions(t('chat'), 'Chat')} />
        <Tabs.Screen name="More" component={MoreScreen} options={tabOptions(t('more'), 'More')} />
      </Tabs.Navigator>
    );
  }
  if (role === 'Educator') {
    return (
      <Tabs.Navigator screenOptions={screenOpts}>
        <Tabs.Screen name="Attendance" component={AttendanceScreen} options={tabOptions(t('attendance'), 'Attendance')} />
        <Tabs.Screen name="Log" component={LogScreen} options={tabOptions(t('log'), 'Log')} />
        <Tabs.Screen name="Photos" component={GalleryScreen} options={tabOptions(t('photos'), 'Photos')} />
        <Tabs.Screen name="Chat" component={ChatScreen} options={tabOptions(t('chat'), 'Chat')} />
        <Tabs.Screen name="More" component={MoreScreen} options={tabOptions(t('more'), 'More')} />
      </Tabs.Navigator>
    );
  }
  return (
    <Tabs.Navigator screenOptions={screenOpts}>
      <Tabs.Screen name="Today" component={TodayScreen} options={tabOptions(t('today'), 'Today')} />
      <Tabs.Screen name="Photos" component={GalleryScreen} options={tabOptions(t('photos'), 'Photos')} />
      <Tabs.Screen name="Chat" component={ChatScreen} options={tabOptions(t('chat'), 'Chat')} />
      <Tabs.Screen name="Child" component={ChildScreen} options={tabOptions(t('child'), 'Child')} />
      <Tabs.Screen name="More" component={MoreScreen} options={tabOptions(t('more'), 'More')} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? <Stack.Screen name="App" component={RoleTabs} /> : <Stack.Screen name="Login" component={LoginScreen} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
