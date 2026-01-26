/**
 * TranscriptionEngineSettingsScreen - Choose transcription engine
 *
 * Allows user to select between:
 * - Whisper: Offline, high accuracy, requires model download
 * - Native: Hardware-accelerated, works offline on modern devices, real-time
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { container } from 'tsyringe';
import {
  TranscriptionEngineService,
  TranscriptionEngineInfo,
} from '../../contexts/Normalization/services/TranscriptionEngineService';
import { TranscriptionEngineType } from '../../contexts/Normalization/services/ITranscriptionEngine';

export function TranscriptionEngineSettingsScreen() {
  const [engines, setEngines] = useState<TranscriptionEngineInfo[]>([]);
  const [selectedType, setSelectedType] = useState<TranscriptionEngineType>('whisper');
  const [isLoading, setIsLoading] = useState(true);

  const engineService = container.resolve(TranscriptionEngineService);

  useEffect(() => {
    const loadEngines = async () => {
      try {
        const [availableEngines, currentType] = await Promise.all([
          engineService.getAvailableEngines(),
          engineService.getSelectedEngineType(),
        ]);
        setEngines(availableEngines);
        setSelectedType(currentType);
      } catch (error) {
        console.error('[TranscriptionEngineSettings] Failed to load engines:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEngines();
  }, []);

  const handleSelectEngine = useCallback(async (type: TranscriptionEngineType) => {
    try {
      await engineService.setSelectedEngineType(type);
      setSelectedType(type);
    } catch (error) {
      console.error('[TranscriptionEngineSettings] Failed to set engine:', error);
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moteur de transcription</Text>
        <Text style={styles.headerDescription}>
          Choisissez le moteur utilisé pour convertir vos enregistrements audio en texte.
        </Text>
      </View>

      {engines.map((engine) => (
        <TouchableOpacity
          key={engine.type}
          style={[
            styles.engineCard,
            selectedType === engine.type && styles.engineCardSelected,
            !engine.isAvailable && styles.engineCardDisabled,
          ]}
          onPress={() => engine.isAvailable && handleSelectEngine(engine.type)}
          disabled={!engine.isAvailable}
        >
          <View style={styles.engineHeader}>
            <View style={styles.engineTitleRow}>
              <Text style={[
                styles.engineName,
                !engine.isAvailable && styles.engineNameDisabled,
              ]}>
                {engine.displayName}
              </Text>
              {selectedType === engine.type && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Actif</Text>
                </View>
              )}
            </View>
            {!engine.isAvailable && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableBadgeText}>Non disponible</Text>
              </View>
            )}
          </View>

          <Text style={[
            styles.engineDescription,
            !engine.isAvailable && styles.engineDescriptionDisabled,
          ]}>
            {engine.description}
          </Text>

          <View style={styles.featuresRow}>
            {engine.supportsOffline && (
              <View style={styles.featureBadge}>
                <Text style={styles.featureBadgeText}>Hors-ligne</Text>
              </View>
            )}
            {engine.supportsRealTime && (
              <View style={[styles.featureBadge, styles.featureBadgeRealTime]}>
                <Text style={styles.featureBadgeText}>Temps réel</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>A propos des moteurs</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Whisper (OpenAI)</Text>
          <Text style={styles.infoCardText}>
            Modèle d'IA performant qui fonctionne entièrement sur votre appareil.
            Nécessite le téléchargement du modèle (75 MB - 3 GB selon la taille).
            Transcription après l'enregistrement.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Reconnaissance native</Text>
          <Text style={styles.infoCardText}>
            Utilise le moteur de reconnaissance vocale intégré à votre appareil.
            Sur les appareils récents (iPhone avec Neural Engine, Pixel 6+),
            fonctionne hors-ligne avec accélération matérielle.
            Permet la transcription en temps réel.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Quel que soit le moteur choisi, vos enregistrements restent sur votre appareil.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  engineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  engineCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  engineCardDisabled: {
    opacity: 0.6,
  },
  engineHeader: {
    marginBottom: 8,
  },
  engineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  engineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  engineNameDisabled: {
    color: '#8E8E93',
  },
  selectedBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  unavailableBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  unavailableBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  engineDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  engineDescriptionDisabled: {
    color: '#AEAEB2',
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  featureBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featureBadgeRealTime: {
    backgroundColor: '#E3F2FD',
  },
  featureBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2E7D32',
  },
  infoSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  infoCardText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
    textAlign: 'center',
  },
});
