/**
 * ActionsScreen - Centralized Actions Tab
 * Story 5.2 - Task 2 & 5: Main screen with virtualized list
 *
 * AC2: Unified list of all todos from all captures
 * AC3: Default grouping by deadline
 * AC4: Efficient rendering (virtualized SectionList)
 * AC5: Empty state with "Jardin d'idées" illustration
 * AC7: Pull-to-refresh functionality
 */

import React, { useMemo } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAllTodos } from '../../contexts/action/hooks/useAllTodos';
import { EmptyState } from '../../contexts/action/ui/EmptyState';
import { ActionsTodoCard } from '../../contexts/action/ui/ActionsTodoCard';
import { groupTodosByDeadline } from '../../contexts/action/utils/groupTodosByDeadline';

export const ActionsScreen = () => {
  const { data: todos, isLoading, refetch, isRefetching } = useAllTodos();

  // Group todos by deadline
  const sections = useMemo(() => {
    if (!todos) return [];
    return groupTodosByDeadline(todos);
  }, [todos]);

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background-50 dark:bg-background-950 items-center justify-center">
        <Text className="text-content-secondary dark:text-content-secondary-dark">
          Chargement...
        </Text>
      </View>
    );
  }

  // Empty state
  if (!todos || todos.length === 0) {
    return (
      <View className="flex-1 bg-background-50 dark:bg-background-950">
        <EmptyState />
      </View>
    );
  }

  return (
    <SectionList
      className="flex-1 bg-background-50 dark:bg-background-950"
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ActionsTodoCard
          todo={item}
          sourcePreview={undefined} // TODO: Task 7 - Fetch source preview
          sourceTimestamp={
            item.createdAt
              ? formatDistanceToNow(item.createdAt, {
                  addSuffix: true,
                  locale: fr,
                })
              : undefined
          }
        />
      )}
      renderSectionHeader={({ section: { title } }) => (
        <View className="bg-background-100 dark:bg-background-900 px-4 py-2">
          <Text className="text-content-secondary dark:text-content-secondary-dark text-sm font-semibold uppercase">
            {title}
          </Text>
        </View>
      )}
      contentContainerStyle={{ padding: 16 }}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
      }
      // Performance optimizations (AC4)
      windowSize={10}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      removeClippedSubviews
    />
  );
};
