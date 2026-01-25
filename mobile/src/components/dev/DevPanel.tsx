/**
 * DevPanel - Global Development Tools UI
 *
 * Features:
 * - Floating button accessible from any screen
 * - Fullscreen modal with tabbed interface
 * - Contextual tabs (registered by each screen via useDevPanel)
 * - Logs tab always available (global)
 *
 * Architecture:
 * - Uses DevPanelContext for tab management
 * - Screens register/unregister tabs on mount/unmount
 * - Logs are always present as fallback
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDevPanel } from './DevPanelContext';
import { LogsViewer } from './InAppLogger';

export function DevPanel() {
  const { tabs, isOpen, openPanel, closePanel } = useDevPanel();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Auto-select first tab when panel opens (only if no tab selected)
  useEffect(() => {
    if (isOpen && activeTabId === null) {
      // Select first contextual tab if available, otherwise Logs
      if (tabs.length > 0) {
        setActiveTabId(tabs[0].id);
      } else {
        setActiveTabId('logs');
      }
    }
  }, [isOpen, activeTabId, tabs]);

  // Reset active tab when panel closes (so next open auto-selects first tab)
  useEffect(() => {
    if (!isOpen) {
      setActiveTabId(null);
    }
  }, [isOpen]);

  if (!__DEV__) return null;

  // Always include Logs tab (global, always available)
  const allTabs = [
    ...tabs,
    {
      id: 'logs',
      label: '📋 Logs',
      component: <LogsViewer />,
      priority: 1000, // Last position
    },
  ].sort((a, b) => (a.priority || 500) - (b.priority || 500));

  const activeTab = allTabs.find((t) => t.id === activeTabId) || allTabs[0];

  return (
    <>
      {/* Floating Button - Always visible */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={openPanel}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonText}>🔍</Text>
      </TouchableOpacity>

      {/* Modal Panel */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePanel}
      >
        <View style={styles.container}>
          {/* Header with Tabs - explicit top padding for iOS */}
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <ScrollView
              horizontal
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabs}
              showsHorizontalScrollIndicator={false}
            >
              {allTabs.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, activeTabId === tab.id && styles.tabActive]}
                  onPress={() => setActiveTabId(tab.id)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTabId === tab.id && styles.tabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.closeButton} onPress={closePanel}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.content}>
            {activeTab ? (
              <View style={styles.fullscreenContainer}>{activeTab.component}</View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  📋 Logs are always available
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Navigate to a screen with debug tools to see contextual tabs
                </Text>
              </View>
            )}
          </View>
          {/* Bottom safe area padding */}
          <View style={{ height: insets.bottom }} />
        </View>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    zIndex: 9998,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tabsScroll: {
    flex: 1,
  },
  tabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#8E8E93',
  },
  content: {
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
  },
});
