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
  ForgotPassword: undefined;
};

type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

interface ForgotPasswordScreenProps {
  navigation: ForgotPasswordScreenNavigationProp;
}

export const ForgotPasswordScreen = ({ navigation }: ForgotPasswordScreenProps) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    const response = await authClient.forgetPassword({
      email: email.toLowerCase().trim(),
      redirectTo: 'pensine://reset-password',
    });
    setLoading(false);

    if (response.error) {
      toast.error(response.error.message ?? 'Failed to send reset email');
      return;
    }

    toast.success('Password reset instructions sent to your email');
    navigation.goBack();
  };

  return (
    <StandardLayout>
      <View className="flex-1 px-6 justify-center">

        {/* Header */}
        <Text className="text-3xl font-bold text-text-primary mb-3">
          Forgot Password
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        {/* Email Input */}
        <View className="mb-6">
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

        {/* Send Reset Link Button */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleResetPassword}
          className="mb-4"
        >
          Send Reset Link
        </Button>

        {/* Back to Login */}
        <TouchableOpacity
          className="items-center"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-base text-text-link">Back to Login</Text>
        </TouchableOpacity>

      </View>
    </StandardLayout>
  );
};
