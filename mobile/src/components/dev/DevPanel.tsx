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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDevPanel } from './DevPanelContext';
import { LogsViewer } from './InAppLogger';
import { CaptureDevTools } from './CaptureDevTools';
import { TranscriptionQueueDebug } from './TranscriptionQueueDebug';
import { WavDebugPlayer } from './WavDebugPlayer';
import { CorrectionLearningDebug } from './CorrectionLearningDebug';
import { useSettingsStore } from '../../stores/settingsStore';

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 20;

export function DevPanel() {
  const { tabs, isOpen, openPanel, closePanel } = useDevPanel();
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Get debug mode and button position from global settings store
  const debugMode = useSettingsStore((state) => state.debugMode);
  const buttonPosition = useSettingsStore((state) => state.debugButtonPosition);
  const setButtonPosition = useSettingsStore((state) => state.setDebugButtonPosition);

  // Screen dimensions
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Calculate initial position from stored settings
  const getPositionFromSettings = useCallback(() => {
    const x = buttonPosition.edge === 'right'
      ? screenWidth - BUTTON_SIZE - EDGE_MARGIN
      : EDGE_MARGIN;
    const y = buttonPosition.verticalPercent * (screenHeight - BUTTON_SIZE - insets.top - insets.bottom) + insets.top;
    return { x, y };
  }, [buttonPosition, screenWidth, screenHeight, insets]);

  // Animated position
  const pan = useRef(new Animated.ValueXY(getPositionFromSettings())).current;
  const isDragging = useRef(false);

  // Update position when settings change (e.g., on mount)
  useEffect(() => {
    const pos = getPositionFromSettings();
    pan.setValue(pos);
  }, [buttonPosition.edge, buttonPosition.verticalPercent]);

  // Pan responder for drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if moved more than 5 pixels (to allow taps)
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        // Store current position as offset
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // If it was just a tap (not a drag), open the panel
        if (!isDragging.current) {
          openPanel();
          return;
        }

        // Calculate final position
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // Determine which edge to snap to
        const snapToRight = currentX > screenWidth / 2;
        const targetX = snapToRight
          ? screenWidth - BUTTON_SIZE - EDGE_MARGIN
          : EDGE_MARGIN;

        // Clamp Y position within screen bounds
        const minY = insets.top + EDGE_MARGIN;
        const maxY = screenHeight - BUTTON_SIZE - insets.bottom - EDGE_MARGIN;
        const targetY = Math.max(minY, Math.min(maxY, currentY));

        // Animate to edge
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 7,
        }).start();

        // Save position to store
        const verticalPercent = (targetY - insets.top) / (screenHeight - BUTTON_SIZE - insets.top - insets.bottom);
        setButtonPosition({
          edge: snapToRight ? 'right' : 'left',
          verticalPercent: Math.max(0, Math.min(1, verticalPercent)),
        });
      },
    })
  ).current;

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

  // Only show DevPanel when debug mode is enabled
  if (!debugMode) return null;

  // Global dev tools tabs (always available)
  const globalTabs = [
    {
      id: 'captures',
      label: '📦 Captures',
      component: <CaptureDevTools />,
      priority: 100,
    },
    {
      id: 'queue',
      label: '🎙️ Queue',
      component: <TranscriptionQueueDebug alwaysExpanded />,
      priority: 200,
    },
    {
      id: 'wav-player',
      label: '🔊 WAV Debug',
      component: <WavDebugPlayer />,
      priority: 300,
    },
    {
      id: 'corrections',
      label: '📝 Corrections',
      component: <CorrectionLearningDebug />,
      priority: 400,
    },
    {
      id: 'logs',
      label: '📋 Logs',
      component: <LogsViewer />,
      priority: 1000,
    },
  ];

  // Combine contextual tabs with global tabs
  const allTabs = [
    ...tabs,
    ...globalTabs,
  ].sort((a, b) => (a.priority || 500) - (b.priority || 500));

  const activeTab = allTabs.find((t) => t.id === activeTabId) || allTabs[0];

  return (
    <>
      {/* Floating Button - Draggable, anchored to edges */}
      <Animated.View
        style={[
          styles.floatingButton,
          {
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.floatingButtonText}>🔍</Text>
      </Animated.View>

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
    top: 0,
    left: 0,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
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
