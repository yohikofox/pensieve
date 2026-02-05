/**
 * ActionsScreen - Centralized Actions Tab
 * Story 5.2 - Task 2 & 5: Main screen with virtualized list
 *
 * AC2: Unified list of all todos from all captures
 * AC3: Default grouping by deadline
 * AC4: Efficient rendering (virtualized SectionList)
 * AC5: Empty state with "Jardin d'idées" illustration
 * AC7: Pull-to-refresh functionality
 * AC8: Scroll position persistence
 *
 * Code Review Fixes Applied:
 * - Issue #2: Added getItemLayout for 60fps performance
 * - Issue #3: Implemented scroll position persistence
 * - Issue #8: Pre-compute source preview in useMemo
 * - Issue #11: Pre-compute timestamps in useMemo
 * - Issue #12: Extract magic number 50 to constant
 */

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, SectionList, RefreshControl, SectionListData } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAllTodosWithSource } from '../../contexts/action/hooks/useAllTodosWithSource';
import { EmptyState } from '../../contexts/action/ui/EmptyState';
import { ActionsTodoCard } from '../../contexts/action/ui/ActionsTodoCard';
import { groupTodosByDeadline, TodoSection } from '../../contexts/action/utils/groupTodosByDeadline';
import { TodoWithSource } from '../../contexts/action/domain/ITodoRepository';

// Constants (Issue #12 fix)
const MAX_PREVIEW_LENGTH = 50;
const ESTIMATED_ITEM_HEIGHT = 120; // Average height for ActionsTodoCard
const SECTION_HEADER_HEIGHT = 40;

interface EnrichedTodo extends TodoWithSource {
  sourcePreview?: string;
  sourceTimestamp?: string;
}

export const ActionsScreen = () => {
  const { data: todos, isLoading, refetch, isRefetching } = useAllTodosWithSource();

  // Issue #3 fix: Scroll position persistence (AC8)
  const sectionListRef = useRef<SectionList>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Restore scroll position on focus (AC8)
  useFocusEffect(
    React.useCallback(() => {
      if (scrollOffset > 0 && sectionListRef.current) {
        // Small delay to ensure list is rendered
        setTimeout(() => {
          sectionListRef.current?.scrollToLocation({
            sectionIndex: 0,
            itemIndex: 0,
            viewOffset: scrollOffset,
            animated: false,
          });
        }, 100);
      }
    }, [scrollOffset])
  );

  // Issue #8 & #11 fix: Pre-compute todos with preview and timestamp (Performance)
  const enrichedTodos = useMemo(() => {
    if (!todos) return [];

    return todos.map((todo): EnrichedTodo => {
      // Pre-compute source preview (Issue #8 fix)
      const sourceText = todo.idea?.text || todo.thought?.summary;
      const sourcePreview = sourceText
        ? sourceText.length > MAX_PREVIEW_LENGTH
          ? `${sourceText.substring(0, MAX_PREVIEW_LENGTH)}...`
          : sourceText
        : undefined;

      // Pre-compute relative timestamp (Issue #11 fix)
      const sourceTimestamp = todo.createdAt
        ? formatDistanceToNow(todo.createdAt, {
            addSuffix: true,
            locale: fr,
          })
        : undefined;

      return {
        ...todo,
        sourcePreview,
        sourceTimestamp,
      };
    });
  }, [todos]);

  // Group todos by deadline
  const sections = useMemo(() => {
    if (!enrichedTodos || enrichedTodos.length === 0) return [];
    return groupTodosByDeadline(enrichedTodos);
  }, [enrichedTodos]);

  // Issue #2 fix: getItemLayout for performance (AC4)
  const getItemLayout = (
    _data: SectionListData<EnrichedTodo, TodoSection>[] | null,
    index: number
  ) => {
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    };
  };

  // Save scroll position on blur (AC8)
  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    setScrollOffset(offset);
  };

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
  if (!enrichedTodos || enrichedTodos.length === 0) {
    return (
      <View className="flex-1 bg-background-50 dark:bg-background-950">
        <EmptyState />
      </View>
    );
  }

  return (
    <SectionList
      ref={sectionListRef}
      className="flex-1 bg-background-50 dark:bg-background-950"
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ActionsTodoCard
          todo={item}
          sourcePreview={item.sourcePreview}
          sourceTimestamp={item.sourceTimestamp}
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
      getItemLayout={getItemLayout} // Issue #2 fix
      onScroll={handleScroll} // Issue #3 fix
      scrollEventThrottle={16}
    />
  );
};
