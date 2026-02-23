const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

const APP_VARIANT = process.env.APP_VARIANT || 'dev'; // default to dev for Expo Dev Client workflow
const IS_DEV = APP_VARIANT === 'dev';

// armeabi-v7a (32-bit ARM, pre-2015) exclu : mmkv-shared 2.x (requis par
// react-native-background-downloader) ne fournit pas de binaire pour cette
// architecture. Ces appareils ne peuvent pas faire tourner Whisper/Llama.
//
// Deux niveaux de filtrage nécessaires :
// 1. withGradleProperties → reactNativeArchitectures empêche le RNGRP de configurer
//    CMake pour armeabi-v7a (cause réelle du CXX1210 au configure step).
// 2. withAppBuildGradle → ndk.abiFilters exclut armeabi-v7a de l'APK final.
// Plugin: injecte splits (APKs par ABI) et bundle (AAB) dans android/app/build.gradle.
// La cible est contrôlée au moment du build via -PdistributionTarget=appcenter|googleplay.
// Ce plugin est idempotent (guard sur 'distributionTarget').
const withAbiSplits = (config) => {
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.contents.includes('distributionTarget')) {
      return c; // Déjà appliqué
    }

    // 1. Exclure les prebuilt .so llama.rn inutilisés du packaging
    //    (les JNI wrappers correspondants ne sont plus compilés via le patch CMakeLists.txt,
    //     mais les .so précompilés dans jniLibs/ seraient packagés automatiquement par Gradle)
    const EXCLUDED_LLAMA_LIBS = [
      '**/librnllama_v8.so',
      '**/librnllama_jni_v8.so',
      '**/librnllama_v8_2.so',
      '**/librnllama_jni_v8_2.so',
      '**/librnllama_v8_2_dotprod.so',
      '**/librnllama_jni_v8_2_dotprod.so',
      '**/librnllama_v8_2_i8mm.so',
      '**/librnllama_jni_v8_2_i8mm.so',
      '**/librnllama_v8_2_dotprod_i8mm_hexagon_opencl.so',
      '**/librnllama_jni_v8_2_dotprod_i8mm_hexagon_opencl.so',
    ];
    const excludesLines = EXCLUDED_LLAMA_LIBS.map(p => `            '${p}',`).join('\n');
    c.modResults.contents = c.modResults.contents.replace(
      'useLegacyPackaging enableLegacyPackaging.toBoolean()',
      `useLegacyPackaging enableLegacyPackaging.toBoolean()\n        excludes += [\n${excludesLines}\n        ]`
    );

    // 2. Injecter splits + bundle à l'intérieur du bloc android {}
    //    Ancre : fermeture du bloc androidResources + fermeture du bloc android
    c.modResults.contents = c.modResults.contents.replace(
      /([ \t]*androidResources\s*\{[^}]+\})\n\}/,
      `$1\n
    // Distribution mode: "appcenter" (multiple APKs) or "googleplay" (single AAB)
    // Usage: ./gradlew assembleRelease -PdistributionTarget=appcenter
    //        ./gradlew bundleRelease   -PdistributionTarget=googleplay
    def distributionTarget = findProperty('distributionTarget') ?: 'appcenter'

    splits {
        abi {
            enable distributionTarget == 'appcenter'
            reset()
            include "arm64-v8a", "x86_64"
            universalApk false
        }
    }

    bundle {
        abi {
            enableSplit = distributionTarget == 'googleplay'
        }
    }
}`
    );

    // 2. Injecter le bloc versionCode override après android {}
    //    Ancre : commentaire stable du template Expo généré
    c.modResults.contents = c.modResults.contents.replace(
      '// Apply static values from `gradle.properties` to the `android.packagingOptions`',
      `// Assign unique versionCode per ABI for App Center multi-APK distribution
// Convention: arm64-v8a = 1xxx, x86_64 = 2xxx
// Not applied in googleplay mode (single AAB, versionCode managed by Play Console)
def distributionTarget = findProperty('distributionTarget') ?: 'appcenter'
if (distributionTarget == 'appcenter') {
    def abiVersionCodes = ["arm64-v8a": 1, "x86_64": 2]
    android.applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abiFilter = output.getFilter(com.android.build.OutputFile.ABI)
            def abiMultiplier = abiVersionCodes.get(abiFilter, 0)
            if (abiMultiplier != 0) {
                output.versionCodeOverride =
                    abiMultiplier * 1000 + variant.versionCode
            }
        }
    }
}

// Apply static values from \`gradle.properties\` to the \`android.packagingOptions\``
    );

    return c;
  });
};

const withAbiFilters = (config) => {
  // Étape 1 : gradle.properties — reactNativeArchitectures
  config = withGradleProperties(config, (c) => {
    const idx = c.modResults.findIndex(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (idx !== -1) {
      c.modResults[idx].value = 'arm64-v8a,x86_64';
    } else {
      c.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a,x86_64' });
    }
    return c;
  });

  // Étape 2 : build.gradle — ndk.abiFilters
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('abiFilters')) {
      c.modResults.contents = c.modResults.contents.replace(
        /defaultConfig\s*\{/,
        'defaultConfig {\n        ndk {\n            abiFilters "arm64-v8a", "x86_64"\n        }'
      );
    }
    return c;
  });
};

module.exports = {
  expo: {
    name: IS_DEV ? 'Pensieve Dev' : 'Pensieve',
    slug: 'pensine',
    version: '1.0.0',
    orientation: 'portrait',
    icon: IS_DEV ? './assets/icon-dev.png' : './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: IS_DEV ? 'pensine-dev' : 'pensine',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'com.pensine.app.dev' : 'com.pensine.app',
      infoPlist: {
        NSMicrophoneUsageDescription:
          'Pensieve a besoin d\'accéder au microphone pour enregistrer vos pensées vocales.',
        NSSpeechRecognitionUsageDescription:
          'Pensieve utilise la reconnaissance vocale pour transcrire vos enregistrements en texte.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_DEV ? './assets/adaptive-icon-dev.png' : './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: IS_DEV ? 'com.pensine.app.dev' : 'com.pensine.app',
      permissions: ['RECORD_AUDIO'],
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: IS_DEV ? 'pensine-dev' : 'pensine',
              host: 'auth',
              pathPrefix: '/callback',
            },
            {
              scheme: IS_DEV ? 'pensine-dev' : 'pensine',
              host: 'auth',
              pathPrefix: '/huggingface',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        // Debug SQL deeplink — dev build only
        ...(IS_DEV ? [{
          action: 'VIEW',
          data: [{
            scheme: 'pensine-dev',
            host: 'debug',
            pathPrefix: '/sql',
          }],
          category: ['BROWSABLE', 'DEFAULT'],
        }] : []),
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-dev-client',
      'expo-system-ui',
      'expo-web-browser',
      'expo-audio',
      'expo-asset',
      'expo-font',
      'expo-task-manager',
      'expo-background-fetch',
      [
        'expo-notifications',
        {
          sounds: [],
        },
      ],
      'react-native-audio-api',
      '@react-native-community/datetimepicker',
      'expo-speech-recognition',
      '@kesha-antonov/react-native-background-downloader',
      [
        'expo-build-properties',
        {
          ios: {
            excludedPods: ['ExpoLlmMediapipe', 'MediaPipeTasksGenAI', 'MediaPipeTasksGenAIC'],
          },
        },
      ],
      withAbiFilters,
      withAbiSplits,
    ],
  },
};
