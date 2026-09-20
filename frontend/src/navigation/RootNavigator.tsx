import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, Image, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { color, font, space, radius } from '../theme/tokens';
import { OfficerUser } from '../types';

import HomeScreen from '../screens/HomeScreen';
import CaptureScreen from '../screens/CaptureScreen';
import ProcessingScreen from '../screens/ProcessingScreen';
import ResultScreen from '../screens/ResultScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ChatScreen from '../screens/ChatScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RulesScreen from '../screens/RulesScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';

export type RootStackParamList = {
  Home: undefined;
  Capture: undefined;
  Processing: { imageUri?: string };
  Result: { scanData?: any; scanId?: string };
  History: undefined;
  Assistant: { scanData?: any; scanId?: string; initialQuery?: string } | undefined;
  Dashboard: undefined;
  Rules: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

/* Refined Brand Logo Icon */
function ScalesLogoMark({ size = 20, color = '#4F46E5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="3" x2="12" y2="21" />
      <Path d="M4 7h16" />
      <Path d="M4 7l-2 6a4 4 0 0 0 8 0L8 7" />
      <Path d="M16 7l-2 6a4 4 0 0 0 8 0L20 7" />
      <Line x1="9" y1="21" x2="15" y2="21" />
    </Svg>
  );
}

/* Shield Check Icon for verified compliance */
function ShieldCheckIcon({ size = 13, color = '#64748B' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

/* Clean Crisp SVG Icons for Navigation */
function HomeIcon({ color: strokeColor }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

function AuditsIcon({ color: strokeColor }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <Path d="M9 12h6" />
      <Path d="M9 16h6" />
    </Svg>
  );
}

function HelpIcon({ color: strokeColor }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Svg>
  );
}

function AnalyticsIcon({ color: strokeColor }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </Svg>
  );
}

function RulesIcon({ color: strokeColor }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}

function MainTabNavigator() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6C5CE7',
        tabBarInactiveTintColor: '#9498AC',
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E4E5F0',
          borderTopWidth: 1,
          height: isMobile ? 56 : 60,
          paddingBottom: 4,
          paddingTop: 4,
          elevation: 8,
          maxWidth: isMobile ? '100%' : 520,
          alignSelf: 'center',
          width: '100%',
          borderTopLeftRadius: isMobile ? 0 : 16,
          borderTopRightRadius: isMobile ? 0 : 16,
          zIndex: 100,
        },
        tabBarItemStyle: {
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          paddingVertical: 2,
        },
        tabBarIconStyle: {
          marginBottom: 1,
        },
        tabBarLabelStyle: {
          fontSize: isMobile ? 9.5 : 10.5,
          fontWeight: '500',
          marginTop: 1,
          textAlign: 'center',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Inspect',
          tabBarIcon: ({ focused }) => <HomeIcon color={focused ? '#6C5CE7' : '#9498AC'} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{
          title: 'Audits',
          tabBarIcon: ({ focused }) => <AuditsIcon color={focused ? '#6C5CE7' : '#9498AC'} />,
        }}
      />
      <Tab.Screen
        name="AssistantTab"
        component={ChatScreen}
        options={{
          title: 'Ask',
          tabBarIcon: ({ focused }) => <HelpIcon color={focused ? '#6C5CE7' : '#9498AC'} />,
        }}
      />
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused }) => <AnalyticsIcon color={focused ? '#6C5CE7' : '#9498AC'} />,
        }}
      />
      <Tab.Screen
        name="RulesTab"
        component={RulesScreen}
        options={{
          title: 'Rules DB',
          tabBarIcon: ({ focused }) => <RulesIcon color={focused ? '#6C5CE7' : '#9498AC'} />,
        }}
      />
    </Tab.Navigator>
  );
}

import { useAuth } from '../context/AuthContext';
import { ActivityIndicator } from 'react-native';

export default function RootNavigator() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { currentUser, setUser, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!currentUser) {
    if (authMode === 'signup') {
      return (
        <SignupScreen
          onSignup={(user) => setUser(user)}
          onNavigateToLogin={() => setAuthMode('login')}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={(user) => setUser(user)}
        onNavigateToSignup={() => setAuthMode('signup')}
      />
    );
  }

  return (
    <NavigationContainer
      documentTitle={{
        enabled: true,
        formatter: () => 'Inspection Portal — Legal Metrology',
      }}
    >
      <View style={styles.container}>
        {/* Main Stack Navigation */}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={MainTabNavigator} />
          <Stack.Screen name="Capture" component={MainTabNavigator} />
          <Stack.Screen name="Processing" component={ProcessingScreen} />
          <Stack.Screen name="Result" component={ResultScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Assistant" component={ChatScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Rules" component={RulesScreen} />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.background,
  },
  topNavbar: {
    height: 58,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  topNavbarInner: {
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  pillBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  pillBadgeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  vDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  deptLabel: {
    color: '#64748B',
    fontSize: 12.5,
    fontWeight: '500',
  },
  topNavbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusPillText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '600',
  },
  portalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 20,
  },
  portalPillText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '500',
  },
  mobileHeader: {
    height: 52,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileBrandTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mobilePillBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  mobilePillBadgeText: {
    color: '#475569',
    fontSize: 9.5,
    fontWeight: '700',
  },
  mobileStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  mobileStatusPillText: {
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: '600',
  },
});
