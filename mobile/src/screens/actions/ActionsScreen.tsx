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

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ViewToken,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAllTodosWithSource } from '../../contexts/action/hooks/useAllTodosWithSource';
import { useFilterState } from '../../contexts/action/hooks/useFilterState';
import { useFilteredTodoCounts } from '../../contexts/action/hooks/useFilteredTodoCounts';
import { useBulkDeleteCompleted } from '../../contexts/action/hooks/useBulkDeleteCompleted';
import { filterTodos } from '../../contexts/action/utils/filterTodos';
import { sortTodos, isSectionData } from '../../contexts/action/utils/sortTodos';
import { FilterTabs } from '../../contexts/action/ui/FilterTabs';
import { SortMenu } from '../../contexts/action/ui/SortMenu';
import { FilteredEmptyState } from '../../contexts/action/ui/FilteredEmptyState';
import { ActionsTodoCard } from '../../contexts/action/ui/ActionsTodoCard';
import { TodoSection } from '../../contexts/action/utils/groupTodosByDeadline';
import { TodoWithSource } from '../../contexts/action/domain/ITodoRepository';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import {
  colors,
  getBackgroundColorsForColorScheme,
} from '../../design-system/tokens';
import { StandardLayout } from '../../components/layouts';

// Constants
const MAX_PREVIEW_LENGTH = 50;
const ESTIMATED_ITEM_HEIGHT = 120;
const DATE_COLUMN_WIDTH = 72;

// Animation constants (Story 5.3 - Code Review Fix #8)
const FADE_IN_DURATION = 300;
const FADE_OUT_DURATION = 200;
const TRANSITION_DAMPING = 15;
const TRANSITION_STIFFNESS = 150;

interface EnrichedTodo extends TodoWithSource {
  sourcePreview?: string;
  sourceTimestamp?: string;
}

interface FlatTodoItem {
  todo: EnrichedTodo;
  sectionTitle: string;
  isFirstInSection: boolean;
  isLastInSection: boolean;
}

export const ActionsScreen = () => {
  const { isDark, colorSchemePreference } = useTheme();
  const { data: todos, isLoading, refetch, isRefetching } = useAllTodosWithSource();

  // Story 5.3: Filter and sort state (AC1, AC8)
  const { filter, sort, setFilter, setSort, isLoading: isFilterLoading } = useFilterState();
  const counts = useFilteredTodoCounts();

  // Story 5.4: Bulk delete completed todos (AC10, Task 11)
  const bulkDeleteCompleted = useBulkDeleteCompleted();

  // Sort menu visibility
  const [isSortMenuVisible, setSortMenuVisible] = useState(false);

  // Scroll position persistence (Story 5.2 - AC8)
  // Story 5.3 - Fix #9: Track previous list type to reset scroll on switch
  const flatListRef = useRef<FlatList>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const previousIsSections = useRef<boolean>(isSections);

  // Planning view: sticky section tracking
  const [currentStickySection, setCurrentStickySection] = useState('');
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // Restore scroll position on focus
  useFocusEffect(
    React.useCallback(() => {
      if (scrollOffset > 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: scrollOffset,
            animated: false,
          });
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

  // Planning view: flatten sections into FlatTodoItem[]
  const flatData = useMemo(() => {
    if (!isSections) return null;

    const flat: FlatTodoItem[] = [];
    (sortedData as TodoSection[]).forEach((section) => {
      section.data.forEach((todo, idx) => {
        flat.push({
          todo,
          sectionTitle: section.title,
          isFirstInSection: idx === 0,
          isLastInSection: idx === section.data.length - 1,
        });
      });
    });

    return flat;
  }, [sortedData, isSections]);

  // Planning view: track visible section for sticky overlay
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const first = viewableItems[0].item as FlatTodoItem;
        if (first?.sectionTitle) {
          setCurrentStickySection(first.sectionTitle);
        }
      }
    },
    [],
  );

  // Dynamic styles based on theme
  const styles = useMemo(() => createStyles(isDark, colorSchemePreference), [isDark, colorSchemePreference]);

  // Story 5.3 - Fix #9: Reset scroll offset when switching list type
  React.useEffect(() => {
    if (previousIsSections.current !== isSections) {
      setScrollOffset(0);
      previousIsSections.current = isSections;
    }
  }, [isSections]);

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

  // Story 5.4 - Task 11: Bulk delete handler (AC10)
  const handleBulkDelete = () => {
    if (!counts.completed || counts.completed === 0) {
      return;
    }

    const deletedCount = counts.completed;

    Alert.alert(
      'Supprimer les actions complétées',
      `Êtes-vous sûr de vouloir supprimer ${deletedCount} action${deletedCount > 1 ? 's' : ''} complétée${deletedCount > 1 ? 's' : ''} ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            // CODE REVIEW FIX #6: Show success alert only on successful mutation
            bulkDeleteCompleted.mutate(undefined, {
              onSuccess: (actualDeletedCount) => {
                setTimeout(() => {
                  Alert.alert(
                    'Actions supprimées',
                    `${actualDeletedCount} action${actualDeletedCount > 1 ? 's' : ''} supprimée${actualDeletedCount > 1 ? 's' : ''}`
                  );
                }, 300);
              },
              onError: (error) => {
                console.error('[ActionsScreen] Bulk delete failed:', error);
                Alert.alert(
                  'Erreur',
                  'Impossible de supprimer les actions. Veuillez réessayer.',
                  [{ text: 'OK', style: 'default' }]
                );
              },
            });
          },
        },
      ]
    );
  };

  // Loading state (Story 5.3 - Fix #6: Wait for filter preferences to load)
  if (isLoading || isFilterLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  // Render header (filter tabs + sort button + bulk delete)
  // Story 5.3 - Fix #7: Error boundary for filter components
  // Story 5.4 - Task 11: Bulk delete button (AC10)
  const renderHeader = () => (
    <ErrorBoundary
      fallback={
        <View style={styles.errorFallback}>
          <Text style={styles.errorText}>
            Erreur dans les filtres. Utilisation des filtres par défaut.
          </Text>
        </View>
      }
    >
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

          {/* Story 5.4 - AC10: Bulk delete button (only on "Faites" filter) */}
          {filter === 'completed' && counts.completed > 0 && (
            <TouchableOpacity
              style={styles.deleteAllButton}
              onPress={handleBulkDelete}
              accessibilityRole="button"
              accessibilityLabel="Supprimer toutes les actions complétées"
            >
              <Text style={styles.deleteAllButtonText}>🗑️ Tout supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ErrorBoundary>
  );

  // Render todo card with animations (Story 5.3 - Task 10)
  const renderTodoCard = (todo: EnrichedTodo) => (
    <Animated.View
      entering={FadeIn.duration(FADE_IN_DURATION)}
      exiting={FadeOut.duration(FADE_OUT_DURATION)}
      layout={LinearTransition.springify().damping(TRANSITION_DAMPING).stiffness(TRANSITION_STIFFNESS)}
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
      <StandardLayout>
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
      </StandardLayout>
    );
  }

  // Render calendar item for planning view
  const renderCalendarItem = ({ item }: { item: FlatTodoItem }) => {
    if (item.isFirstInSection) {
      return (
        <View style={styles.calendarRow}>
          <View style={styles.dateColumn}>
            <Text style={styles.dateLabelText}>{item.sectionTitle}</Text>
          </View>
          <View style={styles.cardColumn}>
            {renderTodoCard(item.todo)}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.indentedRow}>
        <View style={styles.verticalLineColumn} />
        <View style={styles.cardColumn}>
          {renderTodoCard(item.todo)}
        </View>
      </View>
    );
  };

  // Render planning view FlatList (for 'default' sort)
  if (isSections && flatData) {
    return (
      <StandardLayout>
        <View style={styles.container}>
          {renderHeader()}
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              style={styles.list}
              data={flatData}
              keyExtractor={(item) => item.todo.id}
              renderItem={renderCalendarItem}
              contentContainerStyle={styles.calendarListContent}
              refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
              }
              windowSize={10}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              removeClippedSubviews
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
            />
            {currentStickySection && scrollOffset > 0 && (
              <View style={styles.stickyDateOverlay}>
                <Text style={styles.stickyDateText}>{currentStickySection}</Text>
              </View>
            )}
          </View>
          <SortMenu
            visible={isSortMenuVisible}
            onClose={() => setSortMenuVisible(false)}
            activeSort={sort}
            onSortChange={setSort}
          />
        </View>
      </StandardLayout>
    );
  }

  // Render FlatList (for other sorts: priority, createdDate, alphabetical) with animations (Story 5.3 - Task 10)
  return (
    <StandardLayout>
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
    </StandardLayout>
  );
};

const createStyles = (isDark: boolean, colorScheme: import('../../design-system/tokens').ColorScheme) => {
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: isDark ? colors.neutral[400] : colors.neutral[500],
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
    },
    calendarListContent: {
      paddingTop: 12,
      paddingBottom: 16,
    },
    sortButtonContainer: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: backgrounds.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    sortButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: backgrounds.subtle,
    },
    sortButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.neutral[200] : colors.neutral[700],
    },
    deleteAllButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: isDark ? colors.error[900] : colors.error[100],
    },
    deleteAllButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.error[400] : colors.error[600],
    },
    calendarRow: {
      flexDirection: 'row',
      paddingRight: 16,
    },
    dateColumn: {
      width: DATE_COLUMN_WIDTH,
      paddingTop: 14,
      paddingLeft: 16,
      paddingRight: 8,
    },
    dateLabelText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
      textTransform: 'uppercase',
    },
    cardColumn: {
      flex: 1,
    },
    indentedRow: {
      flexDirection: 'row',
      paddingRight: 16,
    },
    verticalLineColumn: {
      width: DATE_COLUMN_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: isDark ? colors.neutral[600] : colors.neutral[300],
      marginRight: -StyleSheet.hairlineWidth,
    },
    stickyDateOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: DATE_COLUMN_WIDTH,
      paddingTop: 14,
      paddingLeft: 16,
      paddingRight: 8,
      paddingBottom: 8,
      backgroundColor: backgrounds.screen,
      zIndex: 10,
    },
    stickyDateText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? colors.neutral[300] : colors.neutral[600],
      textTransform: 'uppercase',
    },
    errorFallback: {
      padding: 16,
      backgroundColor: isDark ? colors.error[900] : colors.error[50],
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.error[700] : colors.error[300],
    },
    errorText: {
      color: isDark ? colors.error[400] : colors.error[600],
      fontSize: 14,
      textAlign: 'center',
    },
  });
};
