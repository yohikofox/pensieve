/**
 * PersonalAccessTokensScreen — Liste et gestion des PATs
 * Story 27.2 — AC1, AC5, AC6, AC7, AC8
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useNetworkStatus } from '../../../contexts/NetworkContext';
import { usePatList } from '../../../hooks/pat/usePatList';
import { useRevokePat } from '../../../hooks/pat/useRevokePat';
import { useRenewPat } from '../../../hooks/pat/useRenewPat';
import type { Pat, PatWithToken } from '../../../hooks/pat/types';
import type { SettingsStackParamList } from '../../../navigation/SettingsNavigationTypes';
import { PATListItem } from './components/PATListItem';
import { PATTokenDisplayModal } from './PATTokenDisplayModal';
import { StandardLayout } from '../../../components/layouts';
import { Card } from '../../../design-system/components';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'PersonalAccessTokens'>;

export const PersonalAccessTokensScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isConnected } = useNetworkStatus();
  const { data: pats, isLoading, error } = usePatList();
  const revokeMutation = useRevokePat();
  const renewMutation = useRenewPat();

  const [renewedToken, setRenewedToken] = useState<PatWithToken | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activePats = (pats ?? []).filter(
    (p) => !p.revokedAt && new Date(p.expiresAt) >= new Date(),
  );
  const archivedPats = (pats ?? []).filter(
    (p) => !!p.revokedAt || new Date(p.expiresAt) < new Date(),
  );

  const handleRevoke = (pat: Pat) => {
    Alert.alert(
      'Révoquer ce token ?',
      'Cette action est irréversible. Le token sera immédiatement invalidé.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: () => revokeMutation.mutate(pat.id),
        },
      ],
    );
  };

  const handleRenew = (pat: Pat) => {
    // Calculer la durée originale en jours et l'arrondir à l'option la plus proche
    const originalMs = new Date(pat.expiresAt).getTime() - new Date(pat.createdAt).getTime();
    const originalDays = Math.round(originalMs / (1000 * 60 * 60 * 24));
    const EXPIRY_OPTIONS = [7, 30, 90, 365];
    const expiresInDays = EXPIRY_OPTIONS.reduce((prev, curr) =>
      Math.abs(curr - originalDays) < Math.abs(prev - originalDays) ? curr : prev,
    );

    Alert.alert(
      'Renouveler ce token ?',
      `Renouveler ce token révoquera l'ancien immédiatement. Votre client devra être reconfiguré.\nNouvelle durée : ${expiresInDays} jour${expiresInDays > 1 ? 's' : ''}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Renouveler',
          onPress: () => {
            renewMutation.mutate(
              { id: pat.id, expiresInDays },
              {
                onSuccess: (data) => setRenewedToken(data),
              },
            );
          },
        },
      ],
    );
  };

  const handleEdit = (pat: Pat) => {
    navigation.navigate('PATCreate', { patId: pat.id });
  };

  return (
    <StandardLayout>
      <ScrollView className="flex-1">
        {/* Bandeau offline */}
        {!isConnected && (
          <View className="flex-row items-center bg-amber-50 px-4 py-3 mx-4 mt-4 rounded-lg">
            <Feather name="wifi-off" size={16} color="#d97706" style={{ marginRight: 8 }} />
            <Text className="text-sm text-amber-700 flex-1">
              Connexion requise pour modifier les tokens
            </Text>
          </View>
        )}

        {/* En-tête + bouton création */}
        <View className="flex-row items-center justify-between px-4 pt-6 pb-2">
          <Text className="text-lg font-semibold text-text-primary">Tokens d'accès</Text>
          <TouchableOpacity
            className={`flex-row items-center px-3 py-2 rounded-lg ${
              isConnected ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
            onPress={() => navigation.navigate('PATCreate', {})}
            disabled={!isConnected}
            testID="create-pat-button"
          >
            <Feather name="plus" size={16} color="white" style={{ marginRight: 4 }} />
            <Text className="text-white font-medium text-sm">Créer</Text>
          </TouchableOpacity>
        </View>

        {/* Contenu */}
        {isLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" />
          </View>
        )}

        {error && (
          <View className="px-4 py-6">
            <Text className="text-center text-status-error">
              Impossible de charger les tokens.
            </Text>
          </View>
        )}

        {!isLoading && !error && (
          <>
            {/* PATs actifs */}
            <Card variant="elevated" className="mx-4 mb-4">
              {activePats.length === 0 ? (
                <View className="px-4 py-6 items-center">
                  <Feather name="key" size={32} color="#9ca3af" />
                  <Text className="text-text-tertiary text-sm mt-2 text-center">
                    Aucun token actif.{'\n'}Créez votre premier PAT pour accéder à l'API.
                  </Text>
                </View>
              ) : (
                activePats.map((pat) => (
                  <PATListItem
                    key={pat.id}
                    pat={pat}
                    onEdit={handleEdit}
                    onRenew={handleRenew}
                    onRevoke={handleRevoke}
                    disabled={!isConnected}
                  />
                ))
              )}
            </Card>

            {/* PATs archivés (expirés + révoqués) */}
            {archivedPats.length > 0 && (
              <Card variant="elevated" className="mx-4 mb-6">
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-3"
                  onPress={() => setShowArchived((v) => !v)}
                >
                  <Text className="text-sm font-semibold text-text-secondary uppercase">
                    Archivés ({archivedPats.length})
                  </Text>
                  <Feather
                    name={showArchived ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#6b7280"
                  />
                </TouchableOpacity>
                {showArchived &&
                  archivedPats.map((pat) => (
                    <PATListItem key={pat.id} pat={pat} disabled />
                  ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Modale affichage token après renouvellement */}
      {renewedToken && (
        <PATTokenDisplayModal
          visible={true}
          token={renewedToken.token}
          patName={renewedToken.pat.name}
          onConfirm={() => setRenewedToken(null)}
          mode="renew"
        />
      )}
    </StandardLayout>
  );
};
