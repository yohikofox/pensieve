import { useEffect } from 'react';
import { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ILogger } from '../../infrastructure/logging/ILogger';
import { deepLinkService } from '../../services/deep-linking/DeepLinkService';

// Lazy logger resolution - only resolve when hook is called, not at module load time
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('DeepLinkInit');

/**
 * Initialize Deep Link Service
 *
 * Sets up deep link handling for notification navigation.
 * Waits for navigation container to be ready before initializing.
 *
 * Story: 4.4 - Deep Link Service for notification navigation
 */
export function useDeepLinkInitialization(
  navigationRef: NavigationContainerRefWithCurrent<any>
) {
  useEffect(() => {
    if (navigationRef.current) {
      const log = getLogger();
      log.debug("Initializing deep link service...");
      const cleanup = deepLinkService.initialize(navigationRef.current);
      log.debug("✅ Deep link service initialized");
      return cleanup;
    }
  }, [navigationRef]);
}
