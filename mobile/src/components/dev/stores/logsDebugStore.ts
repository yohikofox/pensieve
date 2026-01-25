/**
 * Zustand Store for Logs DevTool
 *
 * Architecture:
 * - Store is global singleton (logs captured at app level)
 * - Console interception feeds logs to store
 * - Components subscribe via useLogsDebugStore()
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface LogEntry {
  timestamp: Date;
  level: 'log' | 'error' | 'warn';
  message: string;
}

interface LogsDebugState {
  // State
  logs: LogEntry[];
  sniffing: boolean;

  // Actions
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setSniffing: (sniffing: boolean) => void;
}

export const useLogsDebugStore = create<LogsDebugState>()(
  devtools(
    (set, get) => ({
      // Initial state
      logs: [],
      sniffing: true,

      // Actions
      addLog: (entry) =>
        set((state) => ({
          logs: [...state.logs, entry],
        })),

      clearLogs: () => set({ logs: [] }),

      setSniffing: (sniffing) => set({ sniffing }),
    }),
    {
      name: 'logs-debug-store',
      enabled: __DEV__,
    }
  )
);

/**
 * Setup console interception to feed logs to store
 * Called once at app initialization
 */
let isInterceptionSetup = false;

export function setupConsoleInterception(): void {
  if (isInterceptionSetup || !__DEV__) {
    return;
  }

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    const { sniffing } = useLogsDebugStore.getState();
    if (sniffing) {
      const message = args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(' ');
      useLogsDebugStore.getState().addLog({
        timestamp: new Date(),
        level: 'log',
        message,
      });
    }
    originalLog(...args);
  };

  console.error = (...args) => {
    const { sniffing } = useLogsDebugStore.getState();
    if (sniffing) {
      const message = args.map((arg) => String(arg)).join(' ');
      useLogsDebugStore.getState().addLog({
        timestamp: new Date(),
        level: 'error',
        message,
      });
    }
    originalError(...args);
  };

  console.warn = (...args) => {
    const { sniffing } = useLogsDebugStore.getState();
    if (sniffing) {
      const message = args.map((arg) => String(arg)).join(' ');
      useLogsDebugStore.getState().addLog({
        timestamp: new Date(),
        level: 'warn',
        message,
      });
    }
    originalWarn(...args);
  };

  isInterceptionSetup = true;
  console.log('[LogsDebugStore] ✅ Console interception setup');
}

// Auto-setup in DEV mode
if (__DEV__) {
  setupConsoleInterception();
}
