import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useToast } from "../../../design-system/components";
import { Button } from "../../../design-system/components/Button";
import { Input } from "../../../design-system/components/Input";
import { container } from "../../../infrastructure/di/container";
import type { IAuthService } from "../domain/IAuthService";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StandardLayout } from '../../../components/layouts';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "Login"
>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    // Résolution lazy via DI container — conforme ADR-021 (jamais au niveau module)
    const authService = container.resolve<IAuthService>('IAuthService');
    const result = await authService.signIn(email.toLowerCase().trim(), password);
    setLoading(false);

    if (result.type !== 'success') {
      toast.error(result.error ?? "Login failed");
    }
  };

  return (
    <StandardLayout>
      <View className="flex-1 px-6 justify-center">

        {/* Header */}
        <Text className="text-3xl font-bold text-center text-text-primary mb-2">
          Welcome to Pensine
        </Text>
        <Text className="text-base text-center text-text-secondary mb-8">
          Capture your thoughts, incubate your ideas
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
        <View className="mb-6">
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

        {/* Sign In Button */}
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleEmailLogin}
          className="mb-3"
        >
          Sign In
        </Button>

        {/* Forgot Password */}
        <TouchableOpacity
          className="items-center mb-6"
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          <Text className="text-sm text-text-link">Forgot Password?</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <View className="flex-row justify-center">
          <Text className="text-sm text-text-secondary">Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text className="text-sm font-semibold text-text-link">Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
    </StandardLayout>
  );
};
