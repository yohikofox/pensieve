import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFilterState, FilterType, SortType } from '../useFilterState';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('useFilterState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should initialize with default values (active filter, default sort)', async () => {
      const { result } = renderHook(() => useFilterState());

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filter).toBe('active');
      expect(result.current.sort).toBe('default');
    });

    it('should load persisted filter from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => {
        if (key === '@pensine/actions_filter') return 'completed';
        return null;
      });

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filter).toBe('completed');
      expect(result.current.sort).toBe('default');
    });

    it('should load persisted sort from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => {
        if (key === '@pensine/actions_sort') return 'priority';
        return null;
      });

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filter).toBe('active');
      expect(result.current.sort).toBe('priority');
    });

    it('should load both persisted filter and sort', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => {
        if (key === '@pensine/actions_filter') return 'all';
        if (key === '@pensine/actions_sort') return 'createdDate';
        return null;
      });

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filter).toBe('all');
      expect(result.current.sort).toBe('createdDate');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fallback to defaults
      expect(result.current.filter).toBe('active');
      expect(result.current.sort).toBe('default');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load filter preferences:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Filter Updates', () => {
    it('should update filter state', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setFilter('completed');
      });

      expect(result.current.filter).toBe('completed');
    });

    it('should persist filter to AsyncStorage', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setFilter('all');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensine/actions_filter',
        'all'
      );
    });

    it('should handle AsyncStorage save errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setFilter('completed');
      });

      // State should still update despite storage error
      expect(result.current.filter).toBe('completed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save filter preference:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should update filter multiple times', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setFilter('completed');
      });
      expect(result.current.filter).toBe('completed');

      await act(async () => {
        await result.current.setFilter('all');
      });
      expect(result.current.filter).toBe('all');

      await act(async () => {
        await result.current.setFilter('active');
      });
      expect(result.current.filter).toBe('active');
    });
  });

  describe('Sort Updates', () => {
    it('should update sort state', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setSort('priority');
      });

      expect(result.current.sort).toBe('priority');
    });

    it('should persist sort to AsyncStorage', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setSort('createdDate');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensine/actions_sort',
        'createdDate'
      );
    });

    it('should handle AsyncStorage save errors gracefully', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setSort('alphabetical');
      });

      // State should still update despite storage error
      expect(result.current.sort).toBe('alphabetical');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save sort preference:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should update sort multiple times', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setSort('priority');
      });
      expect(result.current.sort).toBe('priority');

      await act(async () => {
        await result.current.setSort('alphabetical');
      });
      expect(result.current.sort).toBe('alphabetical');

      await act(async () => {
        await result.current.setSort('default');
      });
      expect(result.current.sort).toBe('default');
    });
  });

  describe('Combined Filter and Sort Updates', () => {
    it('should update filter and sort independently', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setFilter('completed');
      });

      await act(async () => {
        await result.current.setSort('priority');
      });

      expect(result.current.filter).toBe('completed');
      expect(result.current.sort).toBe('priority');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensine/actions_filter',
        'completed'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pensine/actions_sort',
        'priority'
      );
    });

    it('should persist filter and sort changes across mount/unmount', async () => {
      // First mount - set preferences
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const { result: result1, unmount } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result1.current.setFilter('all');
        await result1.current.setSort('createdDate');
      });

      unmount();

      // Second mount - should load persisted preferences
      (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => {
        if (key === '@pensine/actions_filter') return 'all';
        if (key === '@pensine/actions_sort') return 'createdDate';
        return null;
      });

      const { result: result2 } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(result2.current.filter).toBe('all');
      expect(result2.current.sort).toBe('createdDate');
    });
  });

  describe('Type Safety', () => {
    it('should accept all valid filter types', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validFilters: FilterType[] = ['all', 'active', 'completed'];

      for (const filter of validFilters) {
        await act(async () => {
          await result.current.setFilter(filter);
        });
        expect(result.current.filter).toBe(filter);
      }
    });

    it('should accept all valid sort types', async () => {
      const { result } = renderHook(() => useFilterState());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validSorts: SortType[] = [
        'default',
        'priority',
        'createdDate',
        'alphabetical',
      ];

      for (const sort of validSorts) {
        await act(async () => {
          await result.current.setSort(sort);
        });
        expect(result.current.sort).toBe(sort);
      }
    });
  });
});
