import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiConfig } from '../../config/api';
import { WhisperModelService } from '../../contexts/Normalization/services/WhisperModelService';
import { LLMModelService } from '../../contexts/Normalization/services/LLMModelService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { SettingsStackParamList } from '../../navigation/SettingsStackNavigator';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

export const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedModelLabel, setSelectedModelLabel] = useState<string>('Non configuré');
  const [llmStatusLabel, setLlmStatusLabel] = useState<string>('Désactivé');

  // Debug mode from global settings store
  const debugMode = useSettingsStore((state) => state.debugMode);
  const toggleDebugMode = useSettingsStore((state) => state.toggleDebugMode);

  const modelService = new WhisperModelService();
  const llmModelService = new LLMModelService();

  // Load selected model label on mount and when returning to screen
  useEffect(() => {
    const loadSelectedModel = async () => {
      const selected = await modelService.getBestAvailableModel();
      if (selected) {
        const labels: Record<string, string> = {
          tiny: 'Tiny',
          base: 'Base',
          small: 'Small',
          medium: 'Medium',
        };
        setSelectedModelLabel(labels[selected] || selected);
      } else {
        setSelectedModelLabel('Non configuré');
      }
    };

    loadSelectedModel();

    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', loadSelectedModel);
    return unsubscribe;
  }, [navigation]);

  // Load LLM status on mount and when returning to screen
  useEffect(() => {
    const loadLlmStatus = async () => {
      const enabled = await llmModelService.isPostProcessingEnabled();
      if (!enabled) {
        setLlmStatusLabel('Désactivé');
        return;
      }

      const selected = await llmModelService.getSelectedModel();
      if (selected) {
        const config = llmModelService.getModelConfig(selected);
        setLlmStatusLabel(config.name);
      } else {
        setLlmStatusLabel('Activé');
      }
    };

    loadLlmStatus();

    const unsubscribe = navigation.addListener('focus', loadLlmStatus);
    return unsubscribe;
  }, [navigation]);

  /**
   * Handle Data Export
   */
  const handleExportData = async () => {
    Alert.alert(
      'Exporter mes données',
      'Toutes vos données seront téléchargées dans un fichier ZIP. Cela peut prendre quelques minutes.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Exporter',
          onPress: async () => {
            setExportLoading(true);

            try {
              // Get auth token
              const {
                data: { session },
              } = await supabase.auth.getSession();

              if (!session) {
                throw new Error('Non authentifié');
              }

              // Call export API (POST request)
              const response = await fetch(apiConfig.endpoints.rgpd.export, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });

              if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = 'Erreur inconnue';
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.message || errorJson.error || errorMessage;
                } catch (e) {
                  errorMessage = errorText.substring(0, 100);
                }
                throw new Error(`Erreur HTTP ${response.status}: ${errorMessage}`);
              }

              // Download ZIP blob
              const blob = await response.blob();

              // Convert blob to base64
              const reader = new FileReader();
              const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              const base64Data = await base64Promise;

              // Save to file system
              const filename = `pensine-export-${Date.now()}.zip`;
              const localPath = `${FileSystem.documentDirectory}${filename}`;
              await FileSystem.writeAsStringAsync(localPath, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });

              // Share ZIP (user can save to Files app or email)
              await Sharing.shareAsync(localPath, {
                mimeType: 'application/zip',
                dialogTitle: 'Sauvegarder vos données Pensine',
              });

              Alert.alert(
                'Export terminé',
                'Vos données ont été exportées avec succès.',
              );
            } catch (error: any) {
              Alert.alert(
                'Erreur',
                `Impossible d'exporter vos données: ${error.message}`,
              );
            } finally {
              setExportLoading(false);
            }
          },
        },
      ],
    );
  };

  /**
   * Handle Account Deletion
   */
  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ Supprimer mon compte',
      'Cette action est DÉFINITIVE et IRRÉVERSIBLE.\n\n' +
        'Toutes vos données seront supprimées.\n\n' +
        'Voulez-vous vraiment continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => promptPasswordConfirmation(),
        },
      ],
    );
  };

  /**
   * Prompt password confirmation for account deletion
   */
  const promptPasswordConfirmation = () => {
    setPassword('');
    setPasswordModalVisible(true);
  };

  /**
   * Handle password confirmation from modal
   */
  const handlePasswordConfirm = async () => {
    if (!password || password.trim() === '') {
      Alert.alert('Erreur', 'Veuillez saisir votre mot de passe.');
      return;
    }
    setPasswordModalVisible(false);
    await executeAccountDeletion(password);
  };

  /**
   * Handle modal cancel
   */
  const handlePasswordCancel = () => {
    setPassword('');
    setPasswordModalVisible(false);
  };

  /**
   * Execute account deletion (call API)
   */
  const executeAccountDeletion = async (password: string) => {
    setDeleteLoading(true);

    try {
      // Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Non authentifié');
      }

      // Call deletion API
      const response = await fetch(apiConfig.endpoints.rgpd.deleteAccount, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 204) {
        // Deletion successful
        Alert.alert(
          'Compte supprimé',
          'Votre compte et toutes vos données ont été supprimés.\n\nVous allez être déconnecté.',
          [
            {
              text: 'OK',
              onPress: async () => {
                // Sign out and return to login
                await supabase.auth.signOut();
                // Navigation handled by auth state listener
              },
            },
          ],
        );
      } else if (response.status === 401) {
        Alert.alert('Erreur', 'Mot de passe incorrect.');
      } else {
        const error = await response.json();
        Alert.alert(
          'Erreur',
          error.message || 'Impossible de supprimer le compte.',
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        `Impossible de supprimer le compte: ${error.message}`,
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Transcription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcription</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('WhisperSettings')}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemLabel}>Modèle Whisper</Text>
              <Text style={styles.menuItemSubtitle}>
                Configurer le modèle de transcription
              </Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{selectedModelLabel}</Text>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('LLMSettings')}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemLabel}>Amélioration IA</Text>
              <Text style={styles.menuItemSubtitle}>
                Améliorer automatiquement les transcriptions
              </Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>{llmStatusLabel}</Text>
              <Text style={styles.menuItemChevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* RGPD Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Confidentialité & Données</Text>

          {/* Export Data */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleExportData}
            disabled={exportLoading}
          >
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemLabel}>Exporter mes données</Text>
              <Text style={styles.menuItemSubtitle}>
                Télécharger toutes vos données
              </Text>
            </View>
            {exportLoading && <ActivityIndicator />}
          </TouchableOpacity>

          {/* Delete Account */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
          >
            <View style={styles.menuItemContent}>
              <Text style={[styles.menuItemLabel, { color: '#FF3B30' }]}>
                Supprimer mon compte
              </Text>
              <Text style={styles.menuItemSubtitle}>
                Suppression définitive et irréversible
              </Text>
            </View>
            {deleteLoading && <ActivityIndicator />}
          </TouchableOpacity>
        </View>

        {/* Development Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Développement</Text>

          <View style={styles.menuItem}>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemLabel}>Mode debug</Text>
              <Text style={styles.menuItemSubtitle}>
                Active les outils de diagnostic (logs, lecture WAV...)
              </Text>
            </View>
            <Switch
              value={debugMode}
              onValueChange={toggleDebugMode}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>

      {/* Password Confirmation Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handlePasswordCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmer votre mot de passe</Text>
            <Text style={styles.modalMessage}>
              Pour des raisons de sécurité, veuillez saisir votre mot de passe.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Mot de passe"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
              autoFocus={true}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handlePasswordCancel}
              >
                <Text style={styles.modalButtonTextCancel}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handlePasswordConfirm}
              >
                <Text style={styles.modalButtonTextConfirm}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemValue: {
    fontSize: 15,
    color: '#8E8E93',
    marginRight: 4,
  },
  menuItemChevron: {
    fontSize: 20,
    color: '#C7C7CC',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 17,
    marginBottom: 16,
    backgroundColor: '#F2F2F7',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  modalButtonConfirm: {
    backgroundColor: '#FF3B30',
  },
  modalButtonTextCancel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalButtonTextConfirm: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
