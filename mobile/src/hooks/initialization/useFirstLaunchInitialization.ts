/**
 * useFirstLaunchInitialization
 *
 * Story 24.4: First Launch Initializer — Pixel 9+ Defaults
 *
 * Déclenche FirstLaunchInitializer.run() après la première authentification.
 * Expose l'état de progression pour l'UI FirstLaunchProgress.
 *
 * Pattern : initialization hook (voir useLLMDownloadRecovery comme référence)
 */

import { useEffect, useRef, useState } from 'react';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { FirstLaunchInitializer } from '../../contexts/identity/services/FirstLaunchInitializer';

export interface FirstLaunchState {
  /** Whether the first-launch progress screen should be visible */
  isVisible: boolean;
  /** Download progress 0-1 */
  progress: number;
  /** Hide the progress screen and let download continue in background */
  skip: () => void;
}

/**
 * Trigger first-launch initialization after the user authenticates.
 * Returns state to drive the FirstLaunchProgress UI overlay.
 *
 * @param userId - Authenticated user ID (null when not authenticated)
 */
export function useFirstLaunchInitialization(userId: string | null): FirstLaunchState {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const hasRunRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Run only once per session, only when authenticated
    if (!userId || hasRunRef.current) return;
    hasRunRef.current = true;

    // Guard setters against unmounted component (e.g. logout before download finishes)
    const safeSetIsVisible = (v: boolean) => { if (isMountedRef.current) setIsVisible(v); };
    const safeSetProgress = (p: number) => { if (isMountedRef.current) setProgress(p); };

    runFirstLaunch(safeSetIsVisible, safeSetProgress);
  }, [userId]);

  const skip = () => setIsVisible(false);

  return { isVisible, progress, skip };
}

async function runFirstLaunch(
  setIsVisible: (v: boolean) => void,
  setProgress: (p: number) => void,
): Promise<void> {
  try {
    const initializer = container.resolve<FirstLaunchInitializer>(TOKENS.FirstLaunchInitializer);

    await initializer.run((p: number) => {
      // Show overlay on first progress event (progress=0 signals download start)
      setIsVisible(true);
      setProgress(p);
    });

    // Hide overlay once run() completes (download done or skipped)
    setIsVisible(false);
  } catch {
    // FirstLaunchInitializer handles errors internally — just hide UI
    setIsVisible(false);
  }
}
