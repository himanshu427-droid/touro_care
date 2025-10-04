import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AppProvider, useAppContext } from './context/AppContext';

function AppNavigator() {
  const { user, loading } = useAppContext();
  const router = useRouter();

useEffect(() => {
  if (!loading) {
    if (!user) {
      // Not logged in → login
      router.replace('/(auth)/login');
    } else if (user.kycStatus !== 'verified') {
      // Logged in but KYC not verified → KYC screen
      router.replace('/(auth)/kyc-verification');
    } else if (user.kycStatus === 'verified' && user.digitalIdStatus !== 'active') {
      // KYC verified but Digital ID not active → Trip Details screen
      router.replace('/(auth)/trip-details');
    } else if (user.kycStatus === 'verified' && user.digitalIdStatus === 'active') {
      // Both verified + active → go to main tabs
      router.replace('/(tabs)');
    }
  }
}, [user, loading]);


  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth Screens */}
      <Stack.Screen name="(auth)" />

      {/* Main Tabs */}
      <Stack.Screen name="(tabs)" />

      {/* Fallback */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AppProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AppProvider>
  );
}
