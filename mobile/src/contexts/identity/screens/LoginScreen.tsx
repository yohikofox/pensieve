import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useToast } from "../../../design-system/components";
import { Button } from "../../../design-system/components/Button";
import { Input } from "../../../design-system/components/Input";
import { supabase } from "../../../lib/supabase";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StandardLayout } from '../../../components/layouts';

WebBrowser.maybeCompleteAuthSession();

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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectUrl = makeRedirectUri({ path: "auth/callback" });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === "success") {
        const { url } = result;
        try {
          const fragment = url.split("#")[1];
          if (!fragment) throw new Error("No tokens in callback URL");

          const params = new URLSearchParams(fragment);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          } else {
            throw new Error("Missing tokens in callback");
          }
        } catch (parseError: any) {
          console.error("Failed to parse OAuth callback:", parseError);
          toast.error("Failed to process Google sign-in response");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Google Sign-In Failed");
    } finally {
      setLoading(false);
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

        {/* Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-border-default" />
          <Text className="mx-4 text-sm text-text-tertiary">OR</Text>
          <View className="flex-1 h-px bg-border-default" />
        </View>

        {/* Google Sign-In */}
        <Button
          variant="secondary"
          size="lg"
          onPress={handleGoogleSignIn}
          disabled={loading}
          className="mb-6"
        >
          Continue with Google
        </Button>

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
