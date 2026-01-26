/**
 * AuthNavigator - Stack navigation for Authentication flow
 *
 * Screens:
 * - Login: Sign in screen
 * - Register: Create account screen
 * - ForgotPassword: Password recovery request
 * - ResetPassword: Set new password
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { LoginScreen } from '../contexts/identity/screens/LoginScreen';
import { RegisterScreen } from '../contexts/identity/screens/RegisterScreen';
import { ForgotPasswordScreen } from '../contexts/identity/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../contexts/identity/screens/ResetPasswordScreen';
import { lightStackScreenOptions, darkStackScreenOptions } from './theme';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email?: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const stackScreenOptions = colorScheme === 'dark' ? darkStackScreenOptions : lightStackScreenOptions;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackScreenOptions,
        headerShown: false,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};
