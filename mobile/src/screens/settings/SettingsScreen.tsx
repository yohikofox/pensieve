import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const SettingsScreen = () => {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

              const apiUrl = 'http://localhost:3000/api/rgpd/export';

              // Download ZIP
              const filename = `pensine-export-${Date.now()}.zip`;
              const localPath = `${FileSystem.documentDirectory}${filename}`;

              const downloadResult = await FileSystem.downloadAsync(
                apiUrl,
                localPath,
                {
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                  },
                },
              );

              // Share ZIP (user can save to Files app or email)
              await Sharing.shareAsync(downloadResult.uri, {
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
    Alert.prompt(
      'Confirmer votre mot de passe',
      'Pour des raisons de sécurité, veuillez saisir votre mot de passe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async (password) => {
            if (!password || password.trim() === '') {
              Alert.alert('Erreur', 'Veuillez saisir votre mot de passe.');
              return;
            }
            await executeAccountDeletion(password);
          },
        },
      ],
      'secure-text',
    );
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

      const apiUrl = 'http://localhost:3000/api/rgpd/delete-account';

      // Call deletion API
      const response = await fetch(apiUrl, {
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
    <ScrollView style={styles.container}>
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
    </ScrollView>
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
});
