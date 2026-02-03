/**
 * LottieGalleryScreen - Preview all Lottie animations
 *
 * Debug-only screen accessible from Settings when debugMode is enabled.
 * Displays all available Lottie animations in the project for testing and preview.
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { colors } from '../../design-system/tokens';

interface LottieAnimation {
  id: string;
  name: string;
  description: string;
  source: any;
  defaultSpeed?: number;
}

// Catalog of all Lottie animations in the project
const LOTTIE_ANIMATIONS: LottieAnimation[] = [
  {
    id: 'breeze',
    name: 'Breeze',
    description: 'Fond subtil avec effet de brise légère',
    source: require('../../../assets/animations/breeze.json'),
    defaultSpeed: 0.5,
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    description: 'Papillon flottant décoratif',
    source: require('../../../assets/animations/butterfly.json'),
    defaultSpeed: 0.8,
  },
  {
    id: 'pensieve-basin',
    name: 'Pensieve Basin',
    description: 'Bassin de mémoire avec spirale liquide',
    source: require('../../../assets/animations/pensieve-basin.json'),
    defaultSpeed: 1.0,
  },
];

export function LottieGalleryScreen() {
  const { isDark } = useTheme();
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({});
  const [speed, setSpeed] = useState<{ [key: string]: number }>({});

  const togglePlayPause = (id: string) => {
    setIsPlaying((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSpeed = (id: string, defaultSpeed: number = 1.0): number => {
    return speed[id] ?? defaultSpeed;
  };

  const adjustSpeed = (id: string, delta: number) => {
    const currentSpeed = speed[id] ?? 1.0;
    const newSpeed = Math.max(0.1, Math.min(2.0, currentSpeed + delta));
    setSpeed((prev) => ({ ...prev, [id]: newSpeed }));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50] }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Feather
          name="film"
          size={24}
          color={isDark ? colors.neutral[100] : colors.neutral[900]}
          style={styles.headerIcon}
        />
        <Text style={[styles.title, { color: isDark ? colors.neutral[100] : colors.neutral[900] }]}>
          Lottie Animations Gallery
        </Text>
      </View>

      <Text style={[styles.subtitle, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
        {LOTTIE_ANIMATIONS.length} animation(s) disponible(s)
      </Text>

      {LOTTIE_ANIMATIONS.map((animation) => (
        <View
          key={animation.id}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.neutral[800] : colors.white,
              borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Text style={[styles.cardTitle, { color: isDark ? colors.neutral[100] : colors.neutral[900] }]}>
                {animation.name}
              </Text>
              <Text style={[styles.cardDescription, { color: isDark ? colors.neutral[400] : colors.neutral[600] }]}>
                {animation.description}
              </Text>
            </View>
          </View>

          {/* Animation Preview */}
          <View
            style={[
              styles.previewContainer,
              { backgroundColor: isDark ? colors.neutral[900] : colors.neutral[100] },
            ]}
          >
            <LottieView
              source={animation.source}
              autoPlay={isPlaying[animation.id] ?? true}
              loop
              style={styles.lottie}
              speed={getSpeed(animation.id, animation.defaultSpeed)}
            />
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Play/Pause */}
            <TouchableOpacity
              onPress={() => togglePlayPause(animation.id)}
              style={[
                styles.controlButton,
                { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
              ]}
            >
              <Feather
                name={isPlaying[animation.id] ?? true ? 'pause' : 'play'}
                size={20}
                color={isDark ? colors.neutral[100] : colors.neutral[900]}
              />
            </TouchableOpacity>

            {/* Speed Controls */}
            <View style={styles.speedControls}>
              <TouchableOpacity
                onPress={() => adjustSpeed(animation.id, -0.1)}
                style={[
                  styles.speedButton,
                  { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                ]}
              >
                <Feather name="minus" size={16} color={isDark ? colors.neutral[100] : colors.neutral[900]} />
              </TouchableOpacity>

              <Text style={[styles.speedText, { color: isDark ? colors.neutral[300] : colors.neutral[700] }]}>
                {getSpeed(animation.id, animation.defaultSpeed).toFixed(1)}x
              </Text>

              <TouchableOpacity
                onPress={() => adjustSpeed(animation.id, 0.1)}
                style={[
                  styles.speedButton,
                  { backgroundColor: isDark ? colors.neutral[700] : colors.neutral[200] },
                ]}
              >
                <Feather name="plus" size={16} color={isDark ? colors.neutral[100] : colors.neutral[900]} />
              </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={styles.info}>
              <Text style={[styles.infoText, { color: isDark ? colors.neutral[500] : colors.neutral[500] }]}>
                ID: {animation.id}
              </Text>
            </View>
          </View>
        </View>
      ))}

      {/* Footer Info */}
      <View style={styles.footer}>
        <Feather name="info" size={16} color={isDark ? colors.neutral[500] : colors.neutral[500]} />
        <Text style={[styles.footerText, { color: isDark ? colors.neutral[500] : colors.neutral[500] }]}>
          Cet écran est accessible uniquement en mode debug
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIcon: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
  },
  previewContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  controls: {
    padding: 16,
    paddingTop: 0,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  speedButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 16,
    minWidth: 50,
    textAlign: 'center',
  },
  info: {
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
