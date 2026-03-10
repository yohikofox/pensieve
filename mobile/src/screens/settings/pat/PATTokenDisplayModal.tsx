/**
 * PATTokenDisplayModal — Affichage unique du token après création/renouvellement
 * Story 27.2 — AC2, AC3
 *
 * Le token n'est JAMAIS re-affiché après fermeture.
 * Non-dismissable : l'utilisateur doit confirmer avoir copié le token.
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';

interface PATTokenDisplayModalProps {
  visible: boolean;
  token: string;
  patName: string;
  onConfirm: () => void;
  mode?: 'create' | 'renew';
}

export const PATTokenDisplayModal: React.FC<PATTokenDisplayModalProps> = ({
  visible,
  token,
  patName,
  onConfirm,
  mode = 'create',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        // Non-dismissable : ignorer la demande de fermeture (Android back button)
      }}
    >
      <View className="flex-1 bg-bg-primary justify-center px-6">
        <View className="mb-6">
          <Feather name="key" size={40} color="#6366f1" />
        </View>

        <Text className="text-2xl font-bold text-text-primary mb-2">
          {mode === 'renew' ? 'Votre token a été renouvelé' : 'Votre token a été créé'}
        </Text>
        <Text className="text-base text-text-secondary mb-1 font-semibold">{patName}</Text>
        <Text className="text-sm text-text-secondary mb-6">
          Ce token ne sera affiché qu'une seule fois. Copiez-le maintenant et conservez-le en lieu
          sûr.
        </Text>

        {/* Affichage du token */}
        <View className="bg-gray-100 rounded-lg p-4 mb-4">
          <Text
            className="text-sm font-mono text-text-primary break-all"
            selectable
            testID="pat-token-value"
          >
            {token}
          </Text>
        </View>

        {/* Bouton Copier */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-indigo-600 rounded-lg py-3 mb-4"
          onPress={handleCopy}
          testID="pat-copy-button"
        >
          <Feather
            name={copied ? 'check' : 'copy'}
            size={18}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text className="text-white font-semibold text-base">
            {copied ? 'Copié !' : 'Copier le token'}
          </Text>
        </TouchableOpacity>

        {/* Avertissement */}
        <View className="flex-row items-start bg-amber-50 rounded-lg p-3 mb-6">
          <Feather name="alert-triangle" size={16} color="#d97706" style={{ marginRight: 8, marginTop: 2 }} />
          <Text className="text-sm text-amber-700 flex-1">
            Une fois cette fenêtre fermée, vous ne pourrez plus voir ce token.
          </Text>
        </View>

        {/* Bouton confirmation */}
        <Pressable
          className="items-center py-3 border border-border-default rounded-lg"
          onPress={onConfirm}
          testID="pat-confirm-button"
        >
          <Text className="text-base text-text-primary font-medium">
            J'ai copié mon token
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};
