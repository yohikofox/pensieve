import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthListener } from './src/contexts/identity/hooks/useAuthListener';
import { useDeepLinkAuth } from './src/contexts/identity/hooks/useDeepLinkAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MainNavigator } from './src/navigation/MainNavigator';
import { ActivityIndicator, View } from 'react-native';

export default function App() {
  const { user, loading } = useAuthListener();
  useDeepLinkAuth(); // Handle deep link authentication

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
