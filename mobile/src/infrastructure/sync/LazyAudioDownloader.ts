/**
 * LazyAudioDownloader
 * Story 6.3 - Task 2: Metadata First, Audio Lazy Loading
 *
 * Downloads audio files on-demand with priority queue
 */

import { Paths, File as ExpoFile, Directory } from 'expo-file-system';
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

  // Task 2.7: Audio cache directory (new expo-file-system SDK 54 API)
  private readonly AUDIO_CACHE_DIR = new Directory(Paths.document, 'audio');

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

    // OP-SQLite : result.rows est un tableau direct (pas de _array contrairement à WatermelonDB)
    const rows: any[] = (result.rows as any)?._array ?? result.rows ?? [];

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

    // Task 2.4: Return local path if already downloaded (sync exists check)
    if (capture.audio_local_path) {
      const file = new ExpoFile(capture.audio_local_path);
      if (file.exists) {
        console.log(`[LazyAudio] ✅ Audio already cached: ${capture.audio_local_path}`);
        return capture.audio_local_path;
      }
    }

    // Task 2.7: Ensure audio directory exists (synchronous in new API)
    this.ensureAudioDirectoryExists();

    // Task 2.4: Download audio file
    const localFile = new ExpoFile(this.AUDIO_CACHE_DIR, `${captureId}.m4a`);
    console.log(`[LazyAudio] 📥 Downloading audio: ${capture.audio_url} → ${localFile.uri}`);

    try {
      await ExpoFile.downloadFileAsync(capture.audio_url, localFile);
    } catch (error) {
      console.error(`[LazyAudio] ❌ Download failed:`, error);
      return null;
    }

    const localPath = localFile.uri;

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
   * Sync audio path for a capture after PULL.
   *
   * Priority order:
   * 1. raw_content already a valid local file → nothing to do
   * 2. audio_local_path points to an existing file → sync raw_content ← audio_local_path
   * 3. audio_url available → download → update raw_content AND audio_local_path
   * 4. No option → return null (do not block)
   */
  async syncAudioForCapture(captureId: string): Promise<string | null> {
    const result = this.db.executeSync(
      'SELECT id, raw_content, audio_url, audio_local_path FROM captures WHERE id = ?',
      [captureId]
    );
    // OP-SQLite : result.rows est un tableau direct (pas de _array contrairement à WatermelonDB)
    const rows: any[] = (result.rows as any)?._array ?? result.rows ?? [];
    if (rows.length === 0) {
      console.error(`[LazyAudio] ❌ Capture introuvable en base: ${captureId}`);
      return null;
    }

    const capture = rows[0];

    console.log(`[LazyAudio] 🔍 Diagnostic ${captureId}:`, {
      raw_content: capture.raw_content ?? '(null)',
      audio_local_path: capture.audio_local_path ?? '(null)',
      audio_url: capture.audio_url ? '(présent)' : '(null)',
    });

    // Cas 1 : raw_content est déjà un path local valide → rien à faire
    if (capture.raw_content && (capture.raw_content.startsWith('file://') || capture.raw_content.startsWith('/'))) {
      const file = new ExpoFile(capture.raw_content);
      if (file.exists) {
        console.log(`[LazyAudio] ✅ raw_content already local: ${capture.raw_content}`);
        return capture.raw_content;
      }
      console.warn(`[LazyAudio] ⚠️ raw_content local mais fichier absent: ${capture.raw_content}`);
    }

    // Cas 1.5 : scanner le dossier audio/ pour un fichier correspondant au captureId
    // Le format enregistré par FileStorageService est capture_{captureId}_{timestamp}.m4a
    const foundLocal = this.findLocalAudioFile(captureId);
    if (foundLocal) {
      console.log(
        `[LazyAudio] 📂 Fichier local trouvé par scan:\n` +
        `  path: ${foundLocal}\n` +
        `  raw_content actuel: ${capture.raw_content ?? '(null)'}\n` +
        `  → UPDATE raw_content + audio_local_path avec ce path`
      );
      this.db.executeSync(
        'UPDATE captures SET audio_local_path = ?, raw_content = ? WHERE id = ?',
        [foundLocal, foundLocal, captureId]
      );
      return foundLocal;
    }

    // Cas 2 : audio_local_path pointe vers un fichier existant → resync raw_content
    if (capture.audio_local_path) {
      const file = new ExpoFile(capture.audio_local_path);
      if (file.exists) {
        this.db.executeSync(
          'UPDATE captures SET raw_content = ? WHERE id = ?',
          [capture.audio_local_path, captureId]
        );
        if (capture.raw_content && capture.raw_content !== capture.audio_local_path) {
          console.warn(
            `[LazyAudio] ⚠️ raw_content path divergence for ${captureId}:\n` +
            `  original: ${capture.raw_content}\n` +
            `  resolved: ${capture.audio_local_path}`
          );
        }
        console.log(`[LazyAudio] ✅ Synced raw_content from audio_local_path: ${capture.audio_local_path}`);
        return capture.audio_local_path;
      }
      console.warn(`[LazyAudio] ⚠️ audio_local_path défini mais fichier absent: ${capture.audio_local_path}`);
    }

    // Cas 3 : télécharger depuis audio_url
    if (!capture.audio_url) {
      console.error(
        `[LazyAudio] ❌ Impossible de résoudre l'audio pour ${captureId}: aucun audio_url en base, aucun fichier local trouvé.`
      );
      return null;
    }

    this.ensureAudioDirectoryExists();
    const localFile = new ExpoFile(this.AUDIO_CACHE_DIR, `${captureId}.m4a`);

    try {
      await ExpoFile.downloadFileAsync(capture.audio_url, localFile);
    } catch (error) {
      console.error(`[LazyAudio] ❌ Download failed:`, error);
      return null;
    }

    const localPath = localFile.uri;
    this.db.executeSync(
      'UPDATE captures SET audio_local_path = ?, raw_content = ? WHERE id = ?',
      [localPath, localPath, captureId]
    );

    if (capture.raw_content && capture.raw_content !== localPath) {
      console.warn(
        `[LazyAudio] ⚠️ raw_content path divergence for ${captureId}:\n` +
        `  original: ${capture.raw_content}\n` +
        `  resolved: ${localPath}`
      );
    }

    console.log(`[LazyAudio] ✅ Downloaded and synced: ${localPath}`);
    return localPath;
  }

  /**
   * Recherche un fichier audio local correspondant au captureId dans le dossier audio/.
   *
   * Cherche dans l'ordre :
   * 1. capture_{captureId}_{timestamp}.m4a  (format FileStorageService)
   * 2. {captureId}.m4a                      (format LazyAudioDownloader download)
   *
   * Retourne l'URI du fichier trouvé, ou null.
   */
  private findLocalAudioFile(captureId: string): string | null {
    if (!this.AUDIO_CACHE_DIR.exists) return null;

    try {
      const entries = this.AUDIO_CACHE_DIR.list();
      for (const entry of entries) {
        const name = entry.uri.split('/').pop() ?? '';
        const isCanonical = name === `${captureId}.m4a`;
        const isRecorded = name.startsWith(`capture_${captureId}_`) && name.endsWith('.m4a');
        if (isCanonical || isRecorded) {
          const file = new ExpoFile(entry.uri);
          if (file.exists) {
            console.log(
              `[LazyAudio] 🔎 Scan audio/ → trouvé (${isCanonical ? 'canonical' : 'recorded'}): ${name}`
            );
            return entry.uri;
          }
        }
      }
    } catch (error) {
      console.warn(`[LazyAudio] ⚠️ Échec scan dossier audio pour ${captureId}:`, error);
    }

    return null;
  }

  /**
   * Task 2.7: Ensure audio cache directory exists (synchronous in new API)
   */
  private ensureAudioDirectoryExists(): void {
    if (!this.AUDIO_CACHE_DIR.exists) {
      console.log(`[LazyAudio] 📁 Creating audio cache directory: ${this.AUDIO_CACHE_DIR.uri}`);
      this.AUDIO_CACHE_DIR.create({ intermediates: true });
    }
  }
}
