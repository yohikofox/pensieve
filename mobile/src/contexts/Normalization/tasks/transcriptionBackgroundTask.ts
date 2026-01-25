/**
 * Background Transcription Task
 *
 * Architecture (ADR-020):
 * - Uses expo-task-manager for iOS/Android background processing
 * - iOS: 15-minute background limit (95% of captures <5min will complete)
 * - Android: More permissive background execution
 *
 * Responsibilities:
 * - Register background task with OS
 * - Process transcription queue when app is backgrounded
 * - Respect pause state (don't process if paused)
 * - Handle task errors gracefully
 *
 * Lifecycle:
 * - Registered once at app startup
 * - Invoked periodically by OS when app is backgrounded
 * - Unregistered at app shutdown (optional)
 *
 * Usage:
 * ```typescript
 * // In App.tsx initialization
 * import { registerTranscriptionBackgroundTask } from './tasks/transcriptionBackgroundTask';
 * await registerTranscriptionBackgroundTask();
 * ```
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { container } from 'tsyringe';
import { TranscriptionWorker } from '../workers/TranscriptionWorker';

/**
 * Background task name (must be unique across app)
 */
export const TRANSCRIPTION_BACKGROUND_TASK = 'TRANSCRIPTION_BACKGROUND_TASK';

/**
 * Background task definition
 *
 * Called by OS when app is backgrounded and background fetch is triggered.
 * Processes one item from transcription queue then exits.
 *
 * IMPORTANT: Keep this function lightweight and fast (<30s on iOS).
 */
TaskManager.defineTask(TRANSCRIPTION_BACKGROUND_TASK, async () => {
  try {
    console.log('[BackgroundTask] 🔙 Starting background transcription task');

    // Resolve TranscriptionWorker from DI container
    // Note: We can't inject dependencies into background tasks directly
    const worker = container.resolve(TranscriptionWorker);

    // Process one item from queue
    const processed = await worker.processOneItem();

    if (processed) {
      console.log('[BackgroundTask] ✅ Successfully processed one item');
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } else {
      console.log('[BackgroundTask] ℹ️  Queue empty or paused, no items processed');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
  } catch (error) {
    console.error('[BackgroundTask] ❌ Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register background transcription task
 *
 * Call once during app initialization (in App.tsx).
 * Configures OS to invoke task periodically when app is backgrounded.
 *
 * Configuration:
 * - minimumInterval: 15 minutes (iOS limit)
 * - stopOnTerminate: false (continue after app is killed)
 * - startOnBoot: true (restart on device reboot)
 */
export async function registerTranscriptionBackgroundTask(): Promise<void> {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TRANSCRIPTION_BACKGROUND_TASK);

    if (isRegistered) {
      console.log('[BackgroundTask] Already registered, skipping');
      return;
    }

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(TRANSCRIPTION_BACKGROUND_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (iOS background fetch limit)
      stopOnTerminate: false, // Continue running after app is killed
      startOnBoot: true, // Restart on device reboot
    });

    console.log('[BackgroundTask] ✅ Background transcription task registered');
  } catch (error) {
    console.error('[BackgroundTask] ❌ Failed to register background task:', error);
    // Don't throw - app should continue even if background task registration fails
  }
}

/**
 * Unregister background transcription task
 *
 * Call during app shutdown (optional - OS will clean up eventually).
 */
export async function unregisterTranscriptionBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(TRANSCRIPTION_BACKGROUND_TASK);
    console.log('[BackgroundTask] 🛑 Background task unregistered');
  } catch (error) {
    console.error('[BackgroundTask] ❌ Failed to unregister background task:', error);
  }
}

/**
 * Get background task status
 *
 * Useful for debugging and monitoring.
 */
export async function getBackgroundTaskStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  return await BackgroundFetch.getStatusAsync();
}
