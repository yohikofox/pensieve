/**
 * Deep Link Service
 * Handles deep link navigation from notifications
 *
 * Story 4.4: Notifications de Progression IA
 * Task 7: Deep Link Handling (AC4)
 *
 * Covers:
 * - Subtask 7.1: URL scheme configuration (pensieve://)
 * - Subtask 7.2: Deep link handler implementation (capture/:id)
 * - Subtask 7.3: Navigation to CaptureDetailScreen with highlight
 * - Subtask 7.4: Handle deep link when app is closed/background/foreground
 *
 * AC4: Deep Link to Digested Capture
 */

import * as Linking from 'expo-linking';
import { NavigationContainerRef } from '@react-navigation/native';

export interface DeepLinkParams {
  type: 'capture';
  captureId: string;
  sourceType?: 'notification' | 'external';
}

export class DeepLinkService {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private pendingLink: DeepLinkParams | null = null;

  /**
   * Initialize deep link listener
   * Subtask 7.2: Implement notification deep link handler
   * Subtask 7.4: Handle deep link when app is closed/background/foreground
   */
  initialize(navigationRef: NavigationContainerRef<any>) {
    this.navigationRef = navigationRef;

    // Handle initial URL when app is opened from closed state
    this.handleInitialURL();

    // Listen for URL changes when app is already open (background/foreground)
    const subscription = Linking.addEventListener('url', this.handleDeepLink);

    // Execute pending link if navigation is now ready
    if (this.pendingLink && this.navigationRef) {
      this.navigateToDeepLink(this.pendingLink);
      this.pendingLink = null;
    }

    return () => {
      subscription.remove();
    };
  }

  /**
   * Handle initial URL when app is launched
   * Subtask 7.4: Handle deep link when app is closed
   */
  private async handleInitialURL() {
    try {
      const url = await Linking.getInitialURL();
      if (url) {
        this.handleURL(url, 'notification');
      }
    } catch (error) {
      console.error('Failed to get initial URL:', error);
    }
  }

  /**
   * Handle incoming deep link URL
   * Subtask 7.4: Handle deep link when app is background/foreground
   */
  private handleDeepLink = (event: { url: string }) => {
    this.handleURL(event.url, 'notification');
  };

  /**
   * Parse and handle deep link URL
   * Subtask 7.2: Implement notification deep link handler (capture/:id)
   *
   * Supported formats:
   * - pensieve://capture/:captureId
   * - pensieve://capture/:captureId?type=completed
   * - pensieve://capture/:captureId?type=failed
   *
   * @param url - Deep link URL
   * @param sourceType - Source of the deep link
   */
  private handleURL(url: string, sourceType: 'notification' | 'external') {
    try {
      // Parse URL using Expo Linking
      const { hostname, path, queryParams } = Linking.parse(url);

      // Handle capture deep links: pensieve://capture/:captureId
      if (hostname === 'capture' && path) {
        // Extract captureId from path (remove leading slash if present)
        const captureId = path.replace(/^\//, '');

        if (captureId) {
          const params: DeepLinkParams = {
            type: 'capture',
            captureId,
            sourceType,
          };

          this.navigateToDeepLink(params);
        }
      }
    } catch (error) {
      console.error('Failed to handle deep link:', url, error);
    }
  }

  /**
   * Navigate to deep link destination
   * Subtask 7.3: Navigate to CaptureDetailScreen with highlight animation
   *
   * @param params - Deep link parameters
   */
  private navigateToDeepLink(params: DeepLinkParams) {
    // If navigation not ready yet, queue the link
    if (!this.navigationRef || !this.navigationRef.isReady()) {
      this.pendingLink = params;
      return;
    }

    switch (params.type) {
      case 'capture':
        // Navigate to Captures tab, then to CaptureDetail screen
        // AC4: Navigate directly to detailed view of digested capture
        this.navigationRef.navigate('Captures', {
          screen: 'CaptureDetail',
          params: {
            captureId: params.captureId,
            // AC4: Highlight with subtle glow effect
            highlightInsights: true,
            // Source type for analytics
            fromNotification: params.sourceType === 'notification',
          },
        });
        break;

      default:
        console.warn('Unknown deep link type:', params.type);
    }
  }

  /**
   * Manually navigate to capture
   * Useful for testing or programmatic navigation
   *
   * @param captureId - Capture ID to navigate to
   */
  navigateToCapture(captureId: string) {
    this.navigateToDeepLink({
      type: 'capture',
      captureId,
      sourceType: 'external',
    });
  }
}

// Export singleton instance
export const deepLinkService = new DeepLinkService();
