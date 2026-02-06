import { useEffect } from 'react';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ILLMModelService } from '../../contexts/Normalization/domain/ILLMModelService';
import type { ILogger } from '../../infrastructure/logging/ILogger';

// Lazy logger resolution - only resolve when hook is called, not at module load time
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('LLMDownloadRecovery');

/**
 * LLM Download Recovery
 *
 * Recovers interrupted LLM model downloads after app restart.
 * Initializes the model service and attempts to resume downloads.
 */
export function useLLMDownloadRecovery() {
  useEffect(() => {
    recoverDownloads();
  }, []);
}

async function recoverDownloads() {
  const log = getLogger();
  try {
    const modelService = container.resolve<ILLMModelService>(TOKENS.ILLMModelService);

    await modelService.initialize();
    const recoveredModels = await modelService.recoverInterruptedDownloads();

    if (recoveredModels.length > 0) {
      log.debug("Recovered interrupted downloads:", recoveredModels);
    }
  } catch (error) {
    log.error("Download recovery failed:", error);
  }
}
