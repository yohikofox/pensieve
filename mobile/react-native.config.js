module.exports = {
  dependencies: {
    // Exclude expo-llm-mediapipe on iOS (Android-only for Gemma models)
    'expo-llm-mediapipe': {
      platforms: {
        ios: null, // Disable autolinking on iOS
        android: {}, // Keep it on Android
      },
    },
  },
};
