import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthListener } from '../contexts/identity/hooks/useAuthListener';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { CaptureScreen } from '../screens/capture/CaptureScreen';

const Tab = createBottomTabNavigator();

const HomeScreen = () => {
  const { user } = useAuthListener();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Pensine!</Text>
      <Text style={styles.subtitle}>You are logged in</Text>

      {user?.email && <Text style={styles.email}>{user.email}</Text>}

      <Text style={styles.infoText}>
        Main app features will be implemented in upcoming stories.
      </Text>
    </View>
  );
};

export const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Accueil',
          tabBarLabel: 'Accueil',
        }}
      />
      <Tab.Screen
        name="Capture"
        component={CaptureScreen}
        options={{
          title: 'Capturer',
          tabBarLabel: 'Capturer',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Paramètres',
          tabBarLabel: 'Paramètres',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 32,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
