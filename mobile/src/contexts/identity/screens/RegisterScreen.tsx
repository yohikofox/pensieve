import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useToast } from '../../../design-system/components';
import { Button } from '../../../design-system/components/Button';
import { Input } from '../../../design-system/components/Input';
import { authClient } from '../../../infrastructure/auth/auth-client';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StandardLayout } from '../../../components/layouts';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

export const RegisterScreen = ({ navigation }: RegisterScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const response = await authClient.signUp.email({
      email: email.toLowerCase().trim(),
      password,
      name: email.split('@')[0],
    });
    setLoading(false);

    if (response.error) {
      toast.error(response.error.message ?? 'Registration failed');
      return;
    }

    toast.success('Account created! Please check your email to confirm.');
    navigation.navigate('Login');
  };

  return (
    <StandardLayout>
      <View className="flex-1 px-6 justify-center">

        {/* Header */}
        <Text className="text-3xl font-bold text-center text-text-primary mb-2">
          Create Account
        </Text>
        <Text className="text-base text-center text-text-secondary mb-8">
          Start capturing your thoughts today
        </Text>

        {/* Email Input */}
        <View className="mb-4">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="username"
            editable={!loading}
          />
        </View>

        {/* Password Input */}
        <View className="mb-4">
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Confirm Password Input */}
        <View className="mb-4">
          <Input
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Password requirements */}
        <Text className="text-sm text-text-tertiary mb-6 leading-5">
          Password must contain:{'\n'}
          {'  '}• At least 8 characters{'\n'}
          {'  '}• At least 1 uppercase letter{'\n'}
          {'  '}• At least 1 number
        </Text>

        {/* Sign Up Button */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleRegister}
          className="mb-3"
        >
          Sign Up
        </Button>

        {/* Login Link */}
        <View className="flex-row justify-center">
          <Text className="text-sm text-text-secondary">Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-sm font-semibold text-text-link">Sign In</Text>
          </TouchableOpacity>
        </View>

      </View>
    </StandardLayout>
  );
};
