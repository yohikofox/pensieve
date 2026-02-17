/**
 * LazyAudioDownloader
 * Story 6.3 - Task 2: Metadata First, Audio Lazy Loading
 *
 * Downloads audio files on-demand with priority queue
 */

import * as FileSystem from 'expo-file-system';
import { DatabaseConnection } from '../../database';
import type { DB } from '@op-engineering/op-sqlite';

/**
 * LazyAudioDownloader
 * Task 2.4: Download audio on-demand
 * Task 2.6: Priority queue for downloads
 * Task 2.7: Cache management
 */
export class LazyAudioDownloader {
  private db: DB;
  private downloadQueue: string[] = [];
  private processing = false;
  private downloadingIds = new Set<string>(); // Track downloads in progress

  // Task 2.7: Audio cache directory
  private readonly AUDIO_CACHE_DIR = `${FileSystem.documentDirectory}audio`;

  constructor() {
    this.db = DatabaseConnection.getInstance().getDatabase();
  }

  /**
   * Task 2.4: Download audio if not cached locally
   * Returns local path if available, null if no audio
   */
  async downloadAudioIfNeeded(captureId: string): Promise<string | null> {
    console.log(`[LazyAudio] Checking audio for capture ${captureId}...`);

    // Query capture from database
    const result = this.db.executeSync(
      'SELECT id, audio_url, audio_local_path FROM captures WHERE id = ?',
      [captureId]
    );

    const rows = (result.rows as any)?._array || [];

    // Task 2.4: Return null if capture not found
    if (rows.length === 0) {
      console.log(`[LazyAudio] Capture ${captureId} not found`);
      return null;
    }

    const capture = rows[0];

    // Task 2.4: Return null if no audio (text capture)
    if (!capture.audio_url) {
      console.log(`[LazyAudio] Capture ${captureId} has no audio`);
      return null;
    }

    // Task 2.4: Return local path if already downloaded
    if (capture.audio_local_path) {
      const fileInfo = await FileSystem.getInfoAsync(capture.audio_local_path);
      if (fileInfo.exists) {
        console.log(`[LazyAudio] ✅ Audio already cached: ${capture.audio_local_path}`);
        return capture.audio_local_path;
      }
    }

    // Task 2.7: Ensure audio directory exists
    await this.ensureAudioDirectoryExists();

    // Task 2.4: Download audio file
    const localPath = `${this.AUDIO_CACHE_DIR}/${captureId}.m4a`;
    console.log(`[LazyAudio] 📥 Downloading audio: ${capture.audio_url} → ${localPath}`);

    const downloadResult = await FileSystem.downloadAsync(
      capture.audio_url,
      localPath
    );

    if (downloadResult.status !== 200) {
      console.error(`[LazyAudio] ❌ Download failed: ${downloadResult.status}`);
      return null;
    }

    // Task 2.4: Update database with local path
    this.db.executeSync(
      'UPDATE captures SET audio_local_path = ? WHERE id = ?',
      [localPath, captureId]
    );

    console.log(`[LazyAudio] ✅ Audio downloaded and cached: ${localPath}`);
    return localPath;
  }

  /**
   * Task 2.6: Enqueue download for background processing
   * Prevents duplicate downloads
   */
  enqueueDownload(captureId: string): void {
    // Task 2.6: Don't enqueue duplicates (check queue AND in-progress)
    if (this.downloadQueue.includes(captureId) || this.downloadingIds.has(captureId)) {
      console.log(`[LazyAudio] Capture ${captureId} already in queue or downloading`);
      return;
    }

    console.log(`[LazyAudio] 📋 Enqueueing download: ${captureId}`);
    this.downloadQueue.push(captureId);

    // Start processing queue if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process download queue in background
   * Task 2.6: Priority queue (FIFO - most recent added last)
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return; // Already processing
    }

    this.processing = true;
    console.log(`[LazyAudio] 🔄 Processing download queue (${this.downloadQueue.length} items)...`);

    while (this.downloadQueue.length > 0) {
      const captureId = this.downloadQueue.shift()!; // FIFO

      // Mark as downloading
      this.downloadingIds.add(captureId);

      try {
        await this.downloadAudioIfNeeded(captureId);
      } catch (error) {
        console.error(`[LazyAudio] ❌ Failed to download ${captureId}:`, error);
      } finally {
        // Remove from downloading set
        this.downloadingIds.delete(captureId);
      }
    }

    this.processing = false;
    console.log('[LazyAudio] ✅ Queue processing complete');
  }

  /**
   * Task 2.7: Ensure audio cache directory exists
   */
  private async ensureAudioDirectoryExists(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.AUDIO_CACHE_DIR);

    if (!dirInfo.exists) {
      console.log(`[LazyAudio] 📁 Creating audio cache directory: ${this.AUDIO_CACHE_DIR}`);
      await FileSystem.makeDirectoryAsync(this.AUDIO_CACHE_DIR, {
        intermediates: true,
      });
    }
  }
}
