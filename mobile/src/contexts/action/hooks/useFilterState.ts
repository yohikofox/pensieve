import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FilterType = 'all' | 'active' | 'completed';
export type SortType = 'default' | 'priority' | 'createdDate' | 'alphabetical';

const FILTER_STORAGE_KEY = '@pensine/actions_filter';
const SORT_STORAGE_KEY = '@pensine/actions_sort';

export interface UseFilterStateReturn {
  filter: FilterType;
  sort: SortType;
  setFilter: (filter: FilterType) => Promise<void>;
  setSort: (sort: SortType) => Promise<void>;
  isLoading: boolean;
}

/**
 * Hook to manage filter and sort state for the Actions screen
 * Persists preferences to AsyncStorage (AC8)
 */
export const useFilterState = (): UseFilterStateReturn => {
  const [filter, setFilterState] = useState<FilterType>('active');
  const [sort, setSortState] = useState<SortType>('default');
  const [isLoading, setIsLoading] = useState(true);

  // Load persisted preferences on mount (AC8)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [savedFilter, savedSort] = await Promise.all([
          AsyncStorage.getItem(FILTER_STORAGE_KEY),
          AsyncStorage.getItem(SORT_STORAGE_KEY),
        ]);

        if (savedFilter) {
          setFilterState(savedFilter as FilterType);
        }
        if (savedSort) {
          setSortState(savedSort as SortType);
        }
      } catch (error) {
        // Fallback to defaults on error - don't block app
        console.error('Failed to load filter preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Update filter and persist to AsyncStorage (AC8)
  const setFilter = async (newFilter: FilterType): Promise<void> => {
    const previousFilter = filter;
    setFilterState(newFilter);
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, newFilter);
    } catch (error) {
      console.error('Failed to save filter preference:', error);
      // Rollback state on persistence failure
      setFilterState(previousFilter);
    }
  };

  // Update sort and persist to AsyncStorage (AC8)
  const setSort = async (newSort: SortType): Promise<void> => {
    const previousSort = sort;
    setSortState(newSort);
    try {
      await AsyncStorage.setItem(SORT_STORAGE_KEY, newSort);
    } catch (error) {
      console.error('Failed to save sort preference:', error);
      // Rollback state on persistence failure
      setSortState(previousSort);
    }
  };

  return {
    filter,
    sort,
    setFilter,
    setSort,
    isLoading,
  };
};
