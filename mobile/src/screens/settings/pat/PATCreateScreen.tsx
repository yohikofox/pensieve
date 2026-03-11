/**
 * PATCreateScreen — Formulaire création / modification d'un PAT
 * Story 27.2 — AC2, AC4
 *
 * Wrapper + Content pattern :
 *   PATCreateScreen  → extrait patId depuis les route params
 *   PATCreateContent → porte toute la logique (testable sans navigation)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import type { SettingsStackParamList } from '../../../navigation/SettingsNavigationTypes';
import { useCreatePat } from '../../../hooks/pat/useCreatePat';
import { useUpdatePat } from '../../../hooks/pat/useUpdatePat';
import { PAT_LIST_QUERY_KEY } from '../../../hooks/pat/usePatList';
import type { Pat, PatWithToken } from '../../../hooks/pat/types';
import { PATScopeSelector } from './components/PATScopeSelector';
import { PATTokenDisplayModal } from './PATTokenDisplayModal';
import { Card } from '../../../design-system/components';
import { StandardLayout } from '../../../components/layouts';

type Props = NativeStackScreenProps<SettingsStackParamList, 'PATCreate'>;
type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'PATCreate'>;

const EXPIRY_OPTIONS = [
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
  { label: '1 an', value: 365 },
];

interface PATCreateContentProps {
  patId?: string;
  onBack: () => void;
}

export const PATCreateContent: React.FC<PATCreateContentProps> = ({ patId, onBack }) => {
  const isEditing = !!patId;

  const queryClient = useQueryClient();
  const createMutation = useCreatePat();
  const updateMutation = useUpdatePat();

  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['captures:read']);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [newToken, setNewToken] = useState<PatWithToken | null>(null);

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (!isEditing || !patId) return;
    const cached = queryClient.getQueryData<Pat[]>(PAT_LIST_QUERY_KEY);
    const existing = cached?.find((p) => p.id === patId);
    if (existing) {
      setName(existing.name);
      setSelectedScopes(existing.scopes);
    }
  }, [isEditing, patId, queryClient]);

  const isValid = name.trim().length >= 1 && name.trim().length <= 100 && selectedScopes.length >= 1;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!isValid) return;

    if (isEditing && patId) {
      updateMutation.mutate(
        { id: patId, name: name.trim(), scopes: selectedScopes },
        { onSuccess: onBack },
      );
    } else {
      createMutation.mutate(
        { name: name.trim(), scopes: selectedScopes, expiresInDays },
        { onSuccess: (data) => setNewToken(data) },
      );
    }
  };

  return (
    <StandardLayout>
      <ScrollView className="flex-1 px-4">
        <Text className="text-2xl font-bold text-text-primary mt-6 mb-6">
          {isEditing ? 'Modifier le token' : "Nouveau token d'accès"}
        </Text>

        {/* Nom */}
        <Card variant="elevated" className="mb-4 p-4">
          <Text className="text-sm font-medium text-text-secondary mb-2">Nom du token *</Text>
          <TextInput
            className="border border-border-default rounded-lg p-3 text-base bg-bg-input text-text-primary"
            placeholder="Mon client API"
            placeholderTextColor="#9ca3af"
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoCapitalize="none"
            autoCorrect={false}
            testID="pat-name-input"
          />
          <Text className="text-xs text-text-tertiary mt-1">{name.length}/100</Text>
        </Card>

        {/* Scopes */}
        <Card variant="elevated" className="mb-4 p-4">
          <PATScopeSelector
            selectedScopes={selectedScopes}
            onChange={setSelectedScopes}
          />
        </Card>

        {/* Durée — uniquement à la création */}
        {!isEditing && (
          <Card variant="elevated" className="mb-6 p-4">
            <Text className="text-sm font-medium text-text-secondary mb-2">Durée de validité</Text>
            <View className="flex-row flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  className={`px-3 py-2 rounded-lg border ${
                    expiresInDays === opt.value
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-bg-primary border-border-default'
                  }`}
                  onPress={() => setExpiresInDays(opt.value)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      expiresInDays === opt.value ? 'text-white' : 'text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Erreur */}
        {(createMutation.isError || updateMutation.isError) && (
          <Text className="text-status-error text-sm mb-4 text-center">
            Une erreur est survenue. Veuillez réessayer.
          </Text>
        )}

        {/* Bouton valider */}
        <TouchableOpacity
          className={`items-center py-4 rounded-lg mb-8 ${
            isValid && !isPending ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
          onPress={handleSubmit}
          disabled={!isValid || isPending}
          testID="pat-submit-button"
        >
          {isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {isEditing ? 'Enregistrer' : 'Créer le token'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modale affichage token après création */}
      {newToken && (
        <PATTokenDisplayModal
          visible={true}
          token={newToken.token}
          patName={newToken.pat.name}
          onConfirm={() => {
            setNewToken(null);
            onBack();
          }}
        />
      )}
    </StandardLayout>
  );
};

/** Wrapper : extrait patId depuis les route params → rend PATCreateContent */
export const PATCreateScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const { patId } = route.params ?? {};

  return <PATCreateContent patId={patId} onBack={() => navigation.goBack()} />;
};
