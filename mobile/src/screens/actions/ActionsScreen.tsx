/**
 * ActionsScreen - Centralized Actions Tab with Filters and Sorting
 * Story 5.3 - Task 7: Integration of filtering and sorting
 * Story 5.3 - Task 10: Animation and transitions
 *
 * NEW in Story 5.3:
 * - AC1: Filter tabs (Toutes | À faire | Faites) with count badges
 * - AC2-AC4: Client-side filtering logic with fade animations
 * - AC5-AC7: Sort options menu (Default, Priority, Created Date, Alphabetical)
 * - AC8: Filter and sort state persistence
 * - AC9: Contextual empty states per filter
 * - AC10: Real-time filter counts update with smooth transitions
 * - Animations: FadeIn (300ms), FadeOut (200ms), LinearTransition for reordering
 *
 * From Story 5.2:
 * - AC2: Unified list of all todos from all captures
 * - AC4: Efficient rendering (virtualized list)
 * - AC7: Pull-to-refresh functionality
 * - AC8: Scroll position persistence
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  RefreshControl,
  SectionListData,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAllTodosWithSource } from '../../contexts/action/hooks/useAllTodosWithSource';
import { useFilterState } from '../../contexts/action/hooks/useFilterState';
import { useFilteredTodoCounts } from '../../contexts/action/hooks/useFilteredTodoCounts';
import { filterTodos } from '../../contexts/action/utils/filterTodos';
import { sortTodos, isSectionData } from '../../contexts/action/utils/sortTodos';
import { FilterTabs } from '../../contexts/action/ui/FilterTabs';
import { SortMenu } from '../../contexts/action/ui/SortMenu';
import { FilteredEmptyState } from '../../contexts/action/ui/FilteredEmptyState';
import { ActionsTodoCard } from '../../contexts/action/ui/ActionsTodoCard';
import { TodoSection } from '../../contexts/action/utils/groupTodosByDeadline';
import { TodoWithSource } from '../../contexts/action/domain/ITodoRepository';

// Constants
const MAX_PREVIEW_LENGTH = 50;
const ESTIMATED_ITEM_HEIGHT = 120;
const SECTION_HEADER_HEIGHT = 40;

interface EnrichedTodo extends TodoWithSource {
  sourcePreview?: string;
  sourceTimestamp?: string;
}

export const ActionsScreen = () => {
  const { data: todos, isLoading, refetch, isRefetching } = useAllTodosWithSource();

  // Story 5.3: Filter and sort state (AC1, AC8)
  const { filter, sort, setFilter, setSort, isLoading: isFilterLoading } = useFilterState();
  const counts = useFilteredTodoCounts();

  // Sort menu visibility
  const [isSortMenuVisible, setSortMenuVisible] = useState(false);

  // Scroll position persistence (Story 5.2 - AC8)
  const sectionListRef = useRef<SectionList>(null);
  const flatListRef = useRef<FlatList>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Restore scroll position on focus
  useFocusEffect(
    React.useCallback(() => {
      if (scrollOffset > 0) {
        setTimeout(() => {
          if (sectionListRef.current) {
            sectionListRef.current.scrollToLocation({
              sectionIndex: 0,
              itemIndex: 0,
              viewOffset: scrollOffset,
              animated: false,
            });
          } else if (flatListRef.current) {
            flatListRef.current.scrollToOffset({
              offset: scrollOffset,
              animated: false,
            });
          }
        }, 100);
      }
    }, [scrollOffset])
  );

  // Pre-compute todos with preview and timestamp (Story 5.2 - Performance)
  const enrichedTodos = useMemo(() => {
    if (!todos) return [];

    return todos.map((todo): EnrichedTodo => {
      const sourceText = todo.idea?.text || todo.thought?.summary;
      const sourcePreview = sourceText
        ? sourceText.length > MAX_PREVIEW_LENGTH
          ? `${sourceText.substring(0, MAX_PREVIEW_LENGTH)}...`
          : sourceText
        : undefined;

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

  // Story 5.3: Apply filtering (AC2-AC4)
  const filteredTodos = useMemo(() => {
    if (!enrichedTodos || enrichedTodos.length === 0) return [];
    return filterTodos(enrichedTodos, filter);
  }, [enrichedTodos, filter]);

  // Story 5.3: Apply sorting (AC5-AC7)
  const sortedData = useMemo(() => {
    if (!filteredTodos || filteredTodos.length === 0) return [];
    return sortTodos(filteredTodos, sort);
  }, [filteredTodos, sort]);

  // Check if sorted data is sections or flat list
  const isSections = isSectionData(sortedData);

  // getItemLayout for performance
  const getItemLayout = (
    _data: any,
    index: number
  ) => {
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index,
    };
  };

  // Save scroll position
  const handleScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.y;
    setScrollOffset(offset);
  };

  // Loading state
  if (isLoading || isFilterLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // Render header (filter tabs + sort button)
  const renderHeader = () => (
    <View>
      <FilterTabs
        activeFilter={filter}
        onFilterChange={setFilter}
        counts={counts}
      />
      <View style={styles.sortButtonContainer}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortMenuVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Trier les actions"
        >
          <Text style={styles.sortButtonText}>⇅ Trier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render todo card with animations (Story 5.3 - Task 10)
  const renderTodoCard = (todo: EnrichedTodo) => (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify().damping(15).stiffness(150)}
    >
      <ActionsTodoCard
        todo={todo}
        sourcePreview={todo.sourcePreview}
        sourceTimestamp={todo.sourceTimestamp}
      />
    </Animated.View>
  );

  // Empty state (Story 5.3 - AC9: Contextual empty states)
  if (!filteredTodos || filteredTodos.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <FilteredEmptyState filter={filter} onFilterChange={setFilter} />
        <SortMenu
          visible={isSortMenuVisible}
          onClose={() => setSortMenuVisible(false)}
          activeSort={sort}
          onSortChange={setSort}
        />
      </View>
    );
  }

  // Render SectionList (for 'default' sort) with animations (Story 5.3 - Task 10)
  if (isSections) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <SectionList
          ref={sectionListRef}
          style={styles.list}
          sections={sortedData as TodoSection[]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTodoCard(item)}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
          }
          windowSize={10}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          getItemLayout={getItemLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
        <SortMenu
          visible={isSortMenuVisible}
          onClose={() => setSortMenuVisible(false)}
          activeSort={sort}
          onSortChange={setSort}
        />
      </View>
    );
  }

  // Render FlatList (for other sorts: priority, createdDate, alphabetical) with animations (Story 5.3 - Task 10)
  return (
    <View style={styles.container}>
      {renderHeader()}
      <FlatList
        ref={flatListRef}
        style={styles.list}
        data={sortedData as EnrichedTodo[]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderTodoCard(item)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
        windowSize={10}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        getItemLayout={getItemLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
      <SortMenu
        visible={isSortMenuVisible}
        onClose={() => setSortMenuVisible(false)}
        activeSort={sort}
        onSortChange={setSort}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    color: '#6B7280',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  sortButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sectionHeader: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
});
