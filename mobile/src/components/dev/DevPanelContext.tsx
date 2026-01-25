/**
 * DevPanelContext - Contextual Development Tools System
 *
 * Architecture:
 * - DevPanel floating button accessible globally (any screen)
 * - Logs tab always available (global)
 * - Contextual tabs registered/unregistered by each screen
 *
 * Usage:
 * ```tsx
 * // In any screen component
 * const { registerTab, unregisterTab } = useDevPanel();
 *
 * useEffect(() => {
 *   registerTab({
 *     id: 'my-tool',
 *     label: '🔧 My Tool',
 *     component: <MyDebugTool />
 *   });
 *
 *   return () => unregisterTab('my-tool');
 * }, []);
 * ```
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface DevTab {
  id: string;
  label: string;
  component: ReactNode;
  priority?: number; // Lower = left-most (Logs is 1000)
}

interface DevPanelContextValue {
  tabs: DevTab[];
  registerTab: (tab: DevTab) => void;
  unregisterTab: (tabId: string) => void;
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const DevPanelContext = createContext<DevPanelContextValue | undefined>(undefined);

interface DevPanelProviderProps {
  children: ReactNode;
}

export function DevPanelProvider({ children }: DevPanelProviderProps) {
  const [tabs, setTabs] = useState<DevTab[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const registerTab = useCallback((tab: DevTab) => {
    setTabs((prev) => {
      // Remove existing tab with same ID
      const filtered = prev.filter((t) => t.id !== tab.id);
      // Add new tab and sort by priority (lower = first)
      const newTabs = [...filtered, tab];
      return newTabs.sort((a, b) => (a.priority || 500) - (b.priority || 500));
    });
  }, []);

  const unregisterTab = useCallback((tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  }, []);

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const value: DevPanelContextValue = {
    tabs,
    registerTab,
    unregisterTab,
    isOpen,
    openPanel,
    closePanel,
  };

  return <DevPanelContext.Provider value={value}>{children}</DevPanelContext.Provider>;
}

/**
 * Hook to register contextual dev tools from any screen
 *
 * Example:
 * ```tsx
 * const MyScreen = () => {
 *   const { registerTab, unregisterTab } = useDevPanel();
 *
 *   useEffect(() => {
 *     registerTab({
 *       id: 'my-debug-tool',
 *       label: '🔧 Debug',
 *       component: <MyDebugComponent />,
 *       priority: 100, // Optional: lower = left-most
 *     });
 *
 *     return () => unregisterTab('my-debug-tool');
 *   }, []);
 * };
 * ```
 */
export function useDevPanel(): DevPanelContextValue {
  const context = useContext(DevPanelContext);
  if (!context) {
    throw new Error('useDevPanel must be used within DevPanelProvider');
  }
  return context;
}
