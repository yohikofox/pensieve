import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useToast } from '../../../design-system/components';
import { Button } from '../../../design-system/components/Button';
import { Input } from '../../../design-system/components/Input';
import { supabase } from '../../../lib/supabase';
import { useAuthRecoveryStore } from '../../../stores/authRecoveryStore';
import { StandardLayout } from '../../../components/layouts';

export const ResetPasswordScreen = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const setPasswordRecovery = useAuthRecoveryStore((s) => s.setPasswordRecovery);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    return null;
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Sign out the recovery session — user must re-authenticate with new password
      await supabase.auth.signOut();
      setPasswordRecovery(false);

      toast.success('Password reset successfully. Please sign in with your new password.');
      // Navigation is handled by auth state: signOut → user=null → AuthNavigator(Login)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StandardLayout>
      <View className="flex-1 px-6 justify-center">

        {/* Header */}
        <Text className="text-3xl font-bold text-text-primary mb-2">
          Reset Password
        </Text>
        <Text className="text-base text-text-secondary mb-8">
          Choose a strong new password for your account.
        </Text>

        {/* New Password */}
        <View className="mb-4">
          <Input
            label="New Password"
            placeholder="••••••••"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Confirm Password */}
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

        {/* Requirements */}
        <Text className="text-sm text-text-tertiary mb-6 leading-5">
          Password must contain:{'\n'}
          {'  '}• At least 8 characters{'\n'}
          {'  '}• At least 1 uppercase letter{'\n'}
          {'  '}• At least 1 number
        </Text>

        {/* Reset Button */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleResetPassword}
        >
          Reset Password
        </Button>

      </View>
    </StandardLayout>
  );
};
