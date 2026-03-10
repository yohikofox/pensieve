/**
 * PATScopeSelector — Sélection des scopes pour un PAT
 * Story 27.2
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PAT_SCOPES, type PatScope } from '../../../../hooks/pat/types';

interface PATScopeSelectorProps {
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
}

const SCOPE_LABELS: Record<PatScope, string> = {
  'captures:read': 'Lectures — Captures',
  'thoughts:read': 'Lectures — Pensées',
  'ideas:read': 'Lectures — Idées',
  'todos:read': 'Lectures — Tâches',
  'todos:write': 'Écriture — Tâches',
};

export const PATScopeSelector: React.FC<PATScopeSelectorProps> = ({
  selectedScopes,
  onChange,
  disabled = false,
}) => {
  const toggle = (scope: string) => {
    if (disabled) return;
    if (selectedScopes.includes(scope)) {
      const next = selectedScopes.filter((s) => s !== scope);
      if (next.length === 0) return; // Au moins 1 scope requis
      onChange(next);
    } else {
      onChange([...selectedScopes, scope]);
    }
  };

  return (
    <View>
      <Text className="text-sm font-medium text-text-secondary mb-2">
        Permissions (min. 1 requis)
      </Text>
      {PAT_SCOPES.map((scope) => {
        const isSelected = selectedScopes.includes(scope);
        return (
          <TouchableOpacity
            key={scope}
            className="flex-row items-center py-2 px-1"
            onPress={() => toggle(scope)}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected, disabled }}
          >
            <Feather
              name={isSelected ? 'check-square' : 'square'}
              size={20}
              color={isSelected ? '#6366f1' : '#9ca3af'}
              style={{ marginRight: 10 }}
            />
            <Text className={`text-base ${disabled ? 'text-text-tertiary' : 'text-text-primary'}`}>
              {SCOPE_LABELS[scope as PatScope] ?? scope}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
