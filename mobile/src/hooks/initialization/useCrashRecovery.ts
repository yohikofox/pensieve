import { useEffect } from 'react';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ICrashRecoveryService } from '../../contexts/capture/domain/ICrashRecoveryService';
import type { ILogger } from '../../infrastructure/logging/ILogger';
import { showCrashRecoveryNotification } from '../../shared/utils/notificationUtils';

// Lazy logger resolution - only resolve when hook is called, not at module load time
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('CrashRecovery');

/**
 * Crash Recovery Check
 *
 * Checks for incomplete recordings on app launch and shows notification
 * if any were recovered.
 *
 * Story: 2.1 - Crash Recovery Notification
 */
export function useCrashRecovery() {
  useEffect(() => {
    checkCrashRecovery();
  }, []);
}

async function checkCrashRecovery() {
  const log = getLogger();
  try {
    const crashRecoveryService = container.resolve<ICrashRecoveryService>(
      TOKENS.ICrashRecoveryService
    );
    const recovered = await crashRecoveryService.recoverIncompleteRecordings();

    if (recovered.length > 0) {
      showCrashRecoveryNotification(recovered);
    }
  } catch (error) {
    log.error("Crash recovery check failed:", error);
  }
}
