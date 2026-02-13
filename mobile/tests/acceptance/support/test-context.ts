/**
 * Test Context for BDD Acceptance Tests
 *
 * Provides isolated test environment with:
 * - In-memory database (no SQLite)
 * - Mocked external dependencies (expo-av, file system)
 * - Test data fixtures
 */

import { v4 as uuidv4 } from 'uuid';
import { type RepositoryResult, RepositoryResultType, success, validationError } from '../../../src/contexts/capture/domain/Result';

// ============================================================================
// Types
// ============================================================================

export interface Capture {
  id: string;
  type: 'AUDIO' | 'TEXT';
  state: string; // 'recording' | 'captured' | 'recovered' | 'processing' | 'ready' | 'failed' | 'transcribing' | 'transcribed' | 'transcription_failed'
  rawContent: string;
  normalizedText: string | null;
  capturedAt: Date;
  transcribedAt?: Date;
  duration?: number;
  fileSize?: number;
  filePath?: string;
  format?: string;
  location: string | null;
  tags: string[];
  recoveredFromCrash?: boolean;
  // Note: syncStatus is managed via sync_queue (not part of Capture model)
  // Note: userId doesn't exist in Capture model
}

export interface SyncQueueItem {
  id: number;
  entityType: 'capture' | 'user' | 'settings';
  entityId: string;
  operation: 'create' | 'update' | 'delete' | 'conflict';
  payload: any;
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

export interface AudioRecordingStatus {
  isRecording: boolean;
  durationMillis: number;
  uri?: string;
}

// ============================================================================
// Mock Audio Recorder (replaces expo-av)
// ============================================================================

export class MockAudioRecorder {
  private _isRecording = false;
  private _recordingStartTime: number | null = null;
  private _currentRecordingUri: string | null = null;
  private _simulatedDuration = 0;

  async startRecording(): Promise<RepositoryResult<{ uri: string }>> {
    if (this._isRecording) {
      return validationError('RecordingAlreadyInProgress');
    }

    this._isRecording = true;
    this._recordingStartTime = Date.now();
    this._currentRecordingUri = `mock://audio_${Date.now()}.m4a`;

    return success({ uri: this._currentRecordingUri });
  }

  async stopRecording(): Promise<RepositoryResult<{ uri: string; duration: number }>> {
    if (!this._isRecording) {
      return validationError('NoRecordingInProgress');
    }

    this._isRecording = false;
    const duration = this._simulatedDuration || (Date.now() - this._recordingStartTime!);
    const uri = this._currentRecordingUri!;

    this._recordingStartTime = null;
    this._currentRecordingUri = null;
    this._simulatedDuration = 0;

    return success({ uri, duration });
  }

  getStatus(): AudioRecordingStatus {
    return {
      isRecording: this._isRecording,
      durationMillis: this._isRecording
        ? this._simulatedDuration || (Date.now() - this._recordingStartTime!)
        : 0,
      uri: this._currentRecordingUri || undefined,
    };
  }

  // Test helper: simulate recording duration without real delay
  simulateRecording(durationMs: number): void {
    this._simulatedDuration = durationMs;
  }

  reset(): void {
    this._isRecording = false;
    this._recordingStartTime = null;
    this._currentRecordingUri = null;
    this._simulatedDuration = 0;
  }
}

// ============================================================================
// Mock File System (replaces expo-file-system)
// ============================================================================

export interface MockFile {
  path: string;
  content: string;
  size: number;
  createdAt: Date;
}

export class MockFileSystem {
  private _files: Map<string, MockFile> = new Map();
  private _availableSpace: number = 1000 * 1024 * 1024; // 1GB par défaut

  async writeFile(path: string, content: string): Promise<RepositoryResult<void>> {
    const size = content.length;

    if (this.getAvailableSpace() < size) {
      return validationError('InsufficientStorage');
    }

    this._files.set(path, {
      path,
      content,
      size,
      createdAt: new Date(),
    });

    return success(undefined as void);
  }

  async readFile(path: string): Promise<RepositoryResult<string>> {
    const file = this._files.get(path);
    if (!file) {
      return validationError(`FileNotFound: ${path}`);
    }
    return success(file.content);
  }

  fileExists(path: string): boolean {
    return this._files.has(path);
  }

  async deleteFile(path: string): Promise<RepositoryResult<void>> {
    this._files.delete(path);
    return success(undefined as void);
  }

  getFiles(): MockFile[] {
    return Array.from(this._files.values());
  }

  getFile(path: string): MockFile | undefined {
    return this._files.get(path);
  }

  getAvailableSpace(): number {
    const usedSpace = Array.from(this._files.values()).reduce(
      (sum, file) => sum + file.size,
      0
    );
    return this._availableSpace - usedSpace;
  }

  setAvailableSpace(bytes: number): void {
    this._availableSpace = bytes;
  }

  reset(): void {
    this._files.clear();
    this._availableSpace = 1000 * 1024 * 1024;
  }
}

// ============================================================================
// In-Memory Database (replaces WatermelonDB & OP-SQLite)
// ============================================================================

export class InMemoryDatabase {
  private _captures: Map<string, Capture> = new Map();
  private _syncQueue: Map<number, SyncQueueItem> = new Map();
  private _nextSyncQueueId: number = 1;
  private _simulatedDelay: number = 0;

  /**
   * Set simulated delay for database operations (for testing loading states)
   */
  setSimulatedDelay(delayMs: number): void {
    this._simulatedDelay = delayMs;
  }

  private async _applyDelay(): Promise<void> {
    if (this._simulatedDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this._simulatedDelay));
    }
  }

  async create(data: Partial<Capture>): Promise<Capture> {
    const capture: Capture = {
      id: data.id || uuidv4(),
      type: data.type || 'AUDIO',
      state: data.state || 'recording',
      rawContent: data.rawContent || '',
      normalizedText: data.normalizedText || null,
      capturedAt: data.capturedAt || new Date(),
      transcribedAt: data.transcribedAt,
      duration: data.duration,
      fileSize: data.fileSize,
      filePath: data.filePath,
      format: data.format,
      location: data.location || null,
      tags: data.tags || [],
      recoveredFromCrash: data.recoveredFromCrash || false,
    };

    this._captures.set(capture.id, capture);

    // Auto-add to sync queue (mimics CaptureRepository behavior)
    await this.addToSyncQueue({
      entityType: 'capture',
      entityId: capture.id,
      operation: 'create',
      payload: {
        type: capture.type,
        state: capture.state,
        rawContent: capture.rawContent,
        duration: capture.duration,
        fileSize: capture.fileSize,
      },
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    });

    return capture;
  }

  async update(id: string, updates: Partial<Capture>): Promise<Capture> {
    const capture = this._captures.get(id);
    if (!capture) {
      throw new Error(`CaptureNotFound: ${id}`);
    }

    const updated = { ...capture, ...updates };
    this._captures.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<Capture | null> {
    return this._captures.get(id) || null;
  }

  async findAll(): Promise<Capture[]> {
    await this._applyDelay();
    return Array.from(this._captures.values());
  }

  async findByState(state: string): Promise<Capture[]> {
    return Array.from(this._captures.values()).filter((c) => c.state === state);
  }

  /**
   * Find captures pending synchronization (exist in sync_queue)
   */
  async findPendingSync(): Promise<Capture[]> {
    const pendingIds = new Set(
      Array.from(this._syncQueue.values())
        .filter((item) => item.entityType === 'capture' && ['create', 'update', 'delete'].includes(item.operation))
        .map((item) => item.entityId)
    );
    return Array.from(this._captures.values()).filter((c) => pendingIds.has(c.id));
  }

  /**
   * Find captures already synchronized (not in sync_queue)
   */
  async findSynced(): Promise<Capture[]> {
    const pendingIds = new Set(
      Array.from(this._syncQueue.values())
        .filter((item) => item.entityType === 'capture')
        .map((item) => item.entityId)
    );
    return Array.from(this._captures.values()).filter((c) => !pendingIds.has(c.id));
  }

  /**
   * Find captures with conflicts (operation = 'conflict' in sync_queue)
   */
  async findConflicts(): Promise<Capture[]> {
    const conflictIds = new Set(
      Array.from(this._syncQueue.values())
        .filter((item) => item.entityType === 'capture' && item.operation === 'conflict')
        .map((item) => item.entityId)
    );
    return Array.from(this._captures.values()).filter((c) => conflictIds.has(c.id));
  }

  /**
   * Check if capture is pending sync
   */
  async isPendingSync(captureId: string): Promise<boolean> {
    return Array.from(this._syncQueue.values()).some(
      (item) => item.entityType === 'capture' && item.entityId === captureId && ['create', 'update', 'delete'].includes(item.operation)
    );
  }

  /**
   * Check if capture has conflict
   */
  async hasConflict(captureId: string): Promise<boolean> {
    return Array.from(this._syncQueue.values()).some(
      (item) => item.entityType === 'capture' && item.entityId === captureId && item.operation === 'conflict'
    );
  }

  /**
   * Sync Queue Management
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
    const id = this._nextSyncQueueId++;
    this._syncQueue.set(id, { ...item, id });
    return id;
  }

  async removeFromSyncQueue(itemId: number): Promise<void> {
    this._syncQueue.delete(itemId);
  }

  async removeFromSyncQueueByEntityId(entityId: string): Promise<void> {
    const itemsToRemove = Array.from(this._syncQueue.values())
      .filter((item) => item.entityId === entityId);
    itemsToRemove.forEach((item) => this._syncQueue.delete(item.id));
  }

  async getSyncQueueSize(): Promise<number> {
    return this._syncQueue.size;
  }

  async delete(id: string): Promise<void> {
    this._captures.delete(id);
    // FK CASCADE behavior: remove from sync_queue
    await this.removeFromSyncQueueByEntityId(id);
  }

  async count(): Promise<number> {
    return this._captures.size;
  }

  reset(): void {
    this._captures.clear();
    this._syncQueue.clear();
    this._nextSyncQueueId = 1;
    this._simulatedDelay = 0;
  }

  // Aliases for test convenience (Story 6.1)
  createCapture(data: Partial<Capture>): Promise<Capture> {
    return this.create(data);
  }

  updateCapture(id: string, updates: Partial<Capture>): Promise<Capture> {
    return this.update(id, updates);
  }

  getCaptureById(id: string): Promise<Capture | null> {
    return this.findById(id);
  }

  getAllCaptures(): Promise<Capture[]> {
    return this.findAll();
  }
}

// ============================================================================
// Auth Types (Supabase-compatible)
// ============================================================================

export interface User {
  id: string;
  email: string;
  emailConfirmed: boolean;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt?: Date;
  role?: string;
  appMetadata: {
    provider: 'email' | 'google' | 'apple';
    providers?: string[];
  };
  userMetadata: {
    name?: string;
    avatar_url?: string;
    email_verified?: boolean;
  };
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  expiresIn: number;
  tokenType: 'bearer';
  user: User;
}

export interface AuthError {
  message: string;
  status?: number;
  code?: string;
}

export interface AuthResponse {
  data: {
    user: User | null;
    session: Session | null;
  };
  error: AuthError | null;
}

export interface OAuthResponse {
  data: {
    provider: 'google' | 'apple';
    url: string;
  };
  error: AuthError | null;
}

// ============================================================================
// Mock AsyncStorage (replaces @react-native-async-storage/async-storage)
// ============================================================================

export class MockAsyncStorage {
  private _storage: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this._storage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this._storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this._storage.delete(key);
  }

  async clear(): Promise<void> {
    this._storage.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this._storage.keys());
  }

  reset(): void {
    this._storage.clear();
  }
}

// ============================================================================
// Mock Supabase Auth (replaces @supabase/supabase-js auth)
// ============================================================================

export class MockSupabaseAuth {
  private _users: Map<string, User> = new Map();
  private _sessions: Map<string, Session> = new Map();
  private _passwords: Map<string, string> = new Map(); // email -> password
  private _confirmationsSent: Set<string> = new Set(); // emails with confirmation sent
  private _resetEmailsSent: Set<string> = new Set(); // emails with reset link sent
  private _failedAttempts: Map<string, number> = new Map(); // email -> count
  private _rateLimitedUntil: Map<string, number> = new Map(); // email -> timestamp

  async signUp(email: string, password: string): Promise<AuthResponse> {
    // Validate email format
    if (!this._isValidEmail(email)) {
      return {
        data: { user: null, session: null },
        error: { message: 'Format email invalide', code: 'invalid_email' },
      };
    }

    // Validate password strength
    const passwordError = this._validatePassword(password);
    if (passwordError) {
      return {
        data: { user: null, session: null },
        error: passwordError,
      };
    }

    // Check if user already exists
    const existingUser = Array.from(this._users.values()).find(
      (u) => u.email === email.toLowerCase()
    );
    if (existingUser) {
      return {
        data: { user: null, session: null },
        error: { message: 'Email déjà utilisé', code: 'email_exists' },
      };
    }

    // Create user
    const user: User = {
      id: uuidv4(),
      email: email.toLowerCase(),
      emailConfirmed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      appMetadata: {
        provider: 'email',
        providers: ['email'],
      },
      userMetadata: {},
    };

    this._users.set(user.id, user);
    this._passwords.set(user.email, password);
    this._confirmationsSent.add(user.email);

    // Create session
    const session = this._createSession(user);
    this._sessions.set(user.id, session);

    return {
      data: { user, session },
      error: null,
    };
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase();

    // Check rate limiting
    if (this._isRateLimited(normalizedEmail)) {
      return {
        data: { user: null, session: null },
        error: {
          message: 'Trop de tentatives, réessayez dans 5 minutes',
          code: 'rate_limited',
        },
      };
    }

    // Validate email format
    if (!this._isValidEmail(email)) {
      return {
        data: { user: null, session: null },
        error: { message: 'Format email invalide', code: 'invalid_email' },
      };
    }

    // Validate password format (for test clarity)
    const passwordError = this._validatePassword(password);
    if (passwordError) {
      return {
        data: { user: null, session: null },
        error: passwordError,
      };
    }

    // Find user
    const user = Array.from(this._users.values()).find(
      (u) => u.email === normalizedEmail
    );

    if (!user || this._passwords.get(normalizedEmail) !== password) {
      this._recordFailedAttempt(normalizedEmail);
      return {
        data: { user: null, session: null },
        error: { message: 'Email ou password invalide', code: 'invalid_credentials' },
      };
    }

    // Reset failed attempts on success
    this._failedAttempts.delete(normalizedEmail);

    // Update last sign in
    user.lastSignInAt = new Date();
    user.updatedAt = new Date();
    this._users.set(user.id, user);

    // Create session
    const session = this._createSession(user);
    this._sessions.set(user.id, session);

    return {
      data: { user, session },
      error: null,
    };
  }

  async signInWithOAuth(provider: 'google' | 'apple'): Promise<OAuthResponse> {
    // Simulate OAuth flow
    const url = `https://accounts.${provider}.com/oauth/authorize?redirect_uri=pensieve://auth/callback`;

    return {
      data: {
        provider,
        url,
      },
      error: null,
    };
  }

  async handleOAuthCallback(
    provider: 'google' | 'apple',
    email: string,
    name?: string
  ): Promise<AuthResponse> {
    // Check if user exists
    let user = Array.from(this._users.values()).find(
      (u) => u.email === email.toLowerCase()
    );

    if (!user) {
      // Create new user
      user = {
        id: uuidv4(),
        email: email.toLowerCase(),
        emailConfirmed: true, // OAuth emails are pre-confirmed
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignInAt: new Date(),
        appMetadata: {
          provider,
          providers: [provider],
        },
        userMetadata: {
          name: name || email.split('@')[0],
          email_verified: true,
        },
      };
      this._users.set(user.id, user);
    } else {
      // Update existing user
      if (!user.appMetadata.providers?.includes(provider)) {
        user.appMetadata.providers = [
          ...(user.appMetadata.providers || []),
          provider,
        ];
      }
      user.lastSignInAt = new Date();
      user.updatedAt = new Date();
      this._users.set(user.id, user);
    }

    // Create session
    const session = this._createSession(user);
    this._sessions.set(user.id, session);

    return {
      data: { user, session },
      error: null,
    };
  }

  async signOut(userId: string): Promise<{ error: AuthError | null }> {
    this._sessions.delete(userId);
    return { error: null };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
    const normalizedEmail = email.toLowerCase();

    if (!this._isValidEmail(email)) {
      return {
        error: { message: 'Format email invalide', code: 'invalid_email' },
      };
    }

    // Mark reset email as sent (always succeeds even if user doesn't exist for security)
    this._resetEmailsSent.add(normalizedEmail);

    return { error: null };
  }

  async updateUser(
    userId: string,
    attributes: { password?: string; email?: string; data?: any }
  ): Promise<AuthResponse> {
    const user = this._users.get(userId);
    if (!user) {
      return {
        data: { user: null, session: null },
        error: { message: 'User not found', code: 'user_not_found' },
      };
    }

    if (attributes.password) {
      const passwordError = this._validatePassword(attributes.password);
      if (passwordError) {
        return {
          data: { user: null, session: null },
          error: passwordError,
        };
      }
      this._passwords.set(user.email, attributes.password);
    }

    if (attributes.email) {
      user.email = attributes.email.toLowerCase();
    }

    if (attributes.data) {
      user.userMetadata = { ...user.userMetadata, ...attributes.data };
    }

    user.updatedAt = new Date();
    this._users.set(userId, user);

    const session = this._sessions.get(userId);

    return {
      data: { user, session: session || null },
      error: null,
    };
  }

  async getSession(userId: string): Promise<{ data: { session: Session | null }; error: AuthError | null }> {
    const session = this._sessions.get(userId);

    // Check if session expired
    if (session && Date.now() > session.expiresAt) {
      // Auto-refresh
      const refreshed = this._refreshSession(session);
      this._sessions.set(userId, refreshed);
      return { data: { session: refreshed }, error: null };
    }

    return { data: { session: session || null }, error: null };
  }

  async refreshSession(session: Session): Promise<AuthResponse> {
    const refreshed = this._refreshSession(session);
    this._sessions.set(session.user.id, refreshed);

    return {
      data: { user: session.user, session: refreshed },
      error: null,
    };
  }

  // Test helpers
  hasConfirmationBeenSent(email: string): boolean {
    return this._confirmationsSent.has(email.toLowerCase());
  }

  hasResetEmailBeenSent(email: string): boolean {
    return this._resetEmailsSent.has(email.toLowerCase());
  }

  getUser(email: string): User | undefined {
    return Array.from(this._users.values()).find(
      (u) => u.email === email.toLowerCase()
    );
  }

  deleteUser(userId: string): void {
    this._users.delete(userId);
    this._sessions.delete(userId);
  }

  reset(): void {
    this._users.clear();
    this._sessions.clear();
    this._passwords.clear();
    this._confirmationsSent.clear();
    this._resetEmailsSent.clear();
    this._failedAttempts.clear();
    this._rateLimitedUntil.clear();
  }

  // Private helpers
  private _createSession(user: User): Session {
    return {
      accessToken: `mock-token-${uuidv4()}`,
      refreshToken: `mock-refresh-${uuidv4()}`,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour
      expiresIn: 3600,
      tokenType: 'bearer',
      user,
    };
  }

  private _refreshSession(session: Session): Session {
    return {
      ...session,
      accessToken: `mock-token-${uuidv4()}`,
      expiresAt: Date.now() + 3600 * 1000,
      expiresIn: 3600,
    };
  }

  private _isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private _validatePassword(password: string): AuthError | null {
    if (password.length < 8) {
      return { message: 'Password trop court', code: 'password_too_short' };
    }
    if (!/[A-Z]/.test(password)) {
      return { message: 'Au moins 1 majuscule requise', code: 'password_no_uppercase' };
    }
    if (!/[0-9]/.test(password)) {
      return { message: 'Au moins 1 chiffre requis', code: 'password_no_number' };
    }
    return null;
  }

  private _recordFailedAttempt(email: string): void {
    const attempts = (this._failedAttempts.get(email) || 0) + 1;
    this._failedAttempts.set(email, attempts);

    if (attempts >= 5) {
      this._rateLimitedUntil.set(email, Date.now() + 5 * 60 * 1000); // 5 minutes
    }
  }

  private _isRateLimited(email: string): boolean {
    const limitedUntil = this._rateLimitedUntil.get(email);
    if (!limitedUntil) return false;

    if (Date.now() > limitedUntil) {
      this._rateLimitedUntil.delete(email);
      this._failedAttempts.delete(email);
      return false;
    }

    return true;
  }

  // ============================================================================
  // Public helper methods for tests
  // ============================================================================

  confirmEmail(userId: string): void {
    const user = this._users.get(userId);
    if (user) {
      user.emailConfirmed = true;
      this._users.set(userId, user);
    }
  }

  wasConfirmationEmailSent(email: string): boolean {
    return this._confirmationsSent.has(email.toLowerCase());
  }

  wasResetEmailSent(email: string): boolean {
    return this._resetEmailsSent.has(email.toLowerCase());
  }
}

// ============================================================================
// RGPD Types
// ============================================================================

export interface DataExportMetadata {
  export_date: string;
  user_id: string;
  format_version: string;
}

export interface DataExportContent {
  metadata: DataExportMetadata;
  user_profile: User;
  captures: any[];
  transcriptions: any[];
  ai_digests: any[];
  actions: any[];
  audio_files: string[];
}

export interface DataExportResult {
  success: boolean;
  zipPath?: string;
  zipSizeMB?: number;
  downloadUrl?: string;
  expiresAt?: number;
  error?: string;
}

export interface AuditLog {
  id: string;
  event_type: 'RGPD_DATA_EXPORT' | 'RGPD_ACCOUNT_DELETION';
  user_id: string;
  timestamp: Date;
  ip_address: string;
  export_size_mb?: number;
  metadata?: Record<string, any>;
}

export interface DeletionResult {
  success: boolean;
  sources_deleted: {
    supabase_auth: boolean;
    postgresql: boolean;
    minio: boolean;
    watermelondb: boolean;
  };
  error?: string;
}

// ============================================================================
// Mock RGPD Service
// ============================================================================

export class MockRGPDService {
  private _exports: Map<string, DataExportResult> = new Map();
  private _auditLogs: AuditLog[] = [];
  private _deletedUsers: Set<string> = new Set();
  private _exportInProgress: Set<string> = new Set();
  private _userDataSizes: Map<string, number> = new Map(); // Test helper

  async requestDataExport(
    userId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<DataExportResult> {
    // Check if export already in progress
    if (this._exportInProgress.has(userId)) {
      return {
        success: false,
        error: 'Export déjà en cours',
      };
    }

    // Get user data size (mock)
    const dataSizeMB = this._calculateDataSize(userId);

    // Small dataset (< 100 MB) - synchronous
    if (dataSizeMB < 100) {
      const exportData = this._generateExportData(userId);
      const zipPath = `/tmp/export_${userId}_${Date.now()}.zip`;

      const result: DataExportResult = {
        success: true,
        zipPath,
        zipSizeMB: dataSizeMB,
      };

      this._exports.set(userId, result);

      // Log audit trail
      this._auditLogs.push({
        id: uuidv4(),
        event_type: 'RGPD_DATA_EXPORT',
        user_id: userId,
        timestamp: new Date(),
        ip_address: ipAddress,
        export_size_mb: dataSizeMB,
      });

      return result;
    }

    // Large dataset (> 100 MB) - asynchronous
    this._exportInProgress.add(userId);

    // Simulate async processing
    setTimeout(() => {
      const exportData = this._generateExportData(userId);
      const downloadUrl = `https://storage.pensieve.app/exports/${userId}`;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      const result: DataExportResult = {
        success: true,
        downloadUrl,
        zipSizeMB: dataSizeMB,
        expiresAt,
      };

      this._exports.set(userId, result);
      this._exportInProgress.delete(userId);

      // Log audit trail
      this._auditLogs.push({
        id: uuidv4(),
        event_type: 'RGPD_DATA_EXPORT',
        user_id: userId,
        timestamp: new Date(),
        ip_address: ipAddress,
        export_size_mb: dataSizeMB,
      });
    }, 100);

    return {
      success: true,
      zipSizeMB: dataSizeMB,
    };
  }

  async deleteAccount(
    userId: string,
    password: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<DeletionResult> {
    // Verify password (mock - assume valid)
    if (password !== 'Password123!') {
      return {
        success: false,
        sources_deleted: {
          supabase_auth: false,
          postgresql: false,
          minio: false,
          watermelondb: false,
        },
        error: 'Password incorrect',
      };
    }

    // Delete from all sources
    this._deletedUsers.add(userId);

    // Log audit trail (before deletion)
    this._auditLogs.push({
      id: uuidv4(),
      event_type: 'RGPD_ACCOUNT_DELETION',
      user_id: userId,
      timestamp: new Date(),
      ip_address: ipAddress,
    });

    return {
      success: true,
      sources_deleted: {
        supabase_auth: true,
        postgresql: true,
        minio: true,
        watermelondb: true,
      },
    };
  }

  getExport(userId: string): DataExportResult | null {
    return this._exports.get(userId) ?? null;
  }

  getAuditLogs(userId?: string): AuditLog[] {
    if (userId) {
      return this._auditLogs.filter((log) => log.user_id === userId);
    }
    return this._auditLogs;
  }

  isUserDeleted(userId: string): boolean {
    return this._deletedUsers.has(userId);
  }

  isExportInProgress(userId: string): boolean {
    return this._exportInProgress.has(userId);
  }

  setUserDataSize(userId: string, sizeMB: number): void {
    this._userDataSizes.set(userId, sizeMB);
  }

  private _calculateDataSize(userId: string): number {
    // Use predefined size for testing, or default to small
    return this._userDataSizes.get(userId) || 50; // Default 50 MB
  }

  private _generateExportData(userId: string): DataExportContent {
    return {
      metadata: {
        export_date: new Date().toISOString(),
        user_id: userId,
        format_version: '1.0',
      },
      user_profile: {
        id: userId,
        email: 'user@example.com',
        emailConfirmed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        appMetadata: { provider: 'email' },
        userMetadata: {},
      },
      captures: [],
      transcriptions: [],
      ai_digests: [],
      actions: [],
      audio_files: [],
    };
  }

  reset(): void {
    this._exports.clear();
    this._auditLogs = [];
    this._deletedUsers.clear();
    this._exportInProgress.clear();
    this._userDataSizes.clear();
  }
}

// ============================================================================
// Mock Permission Manager
// ============================================================================

export class MockPermissionManager {
  private _microphoneGranted = true;
  private _notificationsGranted = true;

  setMicrophonePermission(granted: boolean): void {
    this._microphoneGranted = granted;
  }

  setNotificationPermission(granted: boolean): void {
    this._notificationsGranted = granted;
  }

  async hasMicrophonePermission(): Promise<boolean> {
    return this._microphoneGranted;
  }

  async checkMicrophonePermission(): Promise<boolean> {
    return this._microphoneGranted;
  }

  async requestMicrophonePermission(): Promise<boolean> {
    return this._microphoneGranted;
  }

  reset(): void {
    this._microphoneGranted = true;
    this._notificationsGranted = true;
  }
}

// ============================================================================
// Mock Keyboard (Story 2.2)
// ============================================================================

export class MockKeyboard {
  public isOpen: boolean = false;

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  reset(): void {
    this.isOpen = false;
  }
}

// ============================================================================
// Mock Text Input (Story 2.2)
// ============================================================================

export class MockTextInput {
  private _text: string = '';
  private _isFocused: boolean = false;
  private _isOpen: boolean = false;
  private _lineCount: number = 1;
  public hasHorizontalScroll: boolean = false;

  open(): void {
    this._isOpen = true;
    this._isFocused = true;
  }

  close(): void {
    this._isOpen = false;
    this._isFocused = false;
  }

  setText(text: string): void {
    this._text = text;
    this._lineCount = (text.match(/\n/g) || []).length + 1;
  }

  getText(): string {
    return this._text;
  }

  clear(): void {
    this._text = '';
    this._lineCount = 1;
  }

  get isFocused(): boolean {
    return this._isFocused;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get lineCount(): number {
    return this._lineCount;
  }

  reset(): void {
    this._text = '';
    this._isFocused = false;
    this._isOpen = false;
    this._lineCount = 1;
    this.hasHorizontalScroll = false;
  }
}

// ============================================================================
// Mock Dialog (Story 2.2)
// ============================================================================

export class MockDialog {
  private _isShown: boolean = false;
  private _message: string = '';
  private _options: string[] = [];
  private _selectedOption: string | null = null;

  show(message: string, options: string[]): void {
    this._isShown = true;
    this._message = message;
    this._options = options;
  }

  selectOption(option: string): void {
    if (this._options.includes(option)) {
      this._selectedOption = option;
      this._isShown = false;
    }
  }

  getMessage(): string {
    return this._message;
  }

  getOptions(): string[] {
    return this._options;
  }

  getSelectedOption(): string | null {
    return this._selectedOption;
  }

  isShown(): boolean {
    return this._isShown;
  }

  reset(): void {
    this._isShown = false;
    this._message = '';
    this._options = [];
    this._selectedOption = null;
  }
}

// ============================================================================
// Mock Draft Storage (Story 2.2 - Crash Recovery)
// ============================================================================

export class MockDraftStorage {
  private _drafts: Map<string, string> = new Map();

  saveDraft(text: string, key: string = 'default'): void {
    this._drafts.set(key, text);
  }

  getDraft(key: string = 'default'): string | null {
    return this._drafts.get(key) || null;
  }

  clearDraft(key: string = 'default'): void {
    this._drafts.delete(key);
  }

  hasDraft(key: string = 'default'): boolean {
    return this._drafts.has(key);
  }

  reset(): void {
    this._drafts.clear();
  }
}

// ============================================================================
// Mock App (Story 2.2 - Lifecycle)
// ============================================================================

export class MockApp {
  private _isInBackground: boolean = false;
  private _hasCrashed: boolean = false;

  goToBackground(): void {
    this._isInBackground = true;
  }

  returnToForeground(): void {
    this._isInBackground = false;
  }

  crash(): void {
    this._hasCrashed = true;
  }

  relaunch(): void {
    this._hasCrashed = false;
    this._isInBackground = false;
  }

  isInBackground(): boolean {
    return this._isInBackground;
  }

  hasCrashed(): boolean {
    return this._hasCrashed;
  }

  reset(): void {
    this._isInBackground = false;
    this._hasCrashed = false;
  }
}

// ============================================================================
// Mock Whisper Service (Story 2.5)
// ============================================================================

export class MockWhisperService {
  private _modelInstalled: boolean = true;
  private _transcriptionResults: Map<string, string> = new Map();
  private _failNextTranscription: boolean = false;
  private _transcriptionDuration: number = 1000; // Default 1s

  setModelInstalled(installed: boolean): void {
    this._modelInstalled = installed;
  }

  isModelInstalled(): boolean {
    return this._modelInstalled;
  }

  setTranscriptionDuration(ms: number): void {
    this._transcriptionDuration = ms;
  }

  async transcribe(audioFilePath: string, audioDuration: number): Promise<string> {
    if (!this._modelInstalled) {
      throw new Error('WhisperModelNotInstalled');
    }

    if (this._failNextTranscription) {
      this._failNextTranscription = false;
      throw new Error('TranscriptionFailed: Corrupted audio');
    }

    // Simulate transcription time (should be < 2x audio duration for NFR2)
    await this._simulateDelay(this._transcriptionDuration);

    // Check NFR2 compliance
    if (this._transcriptionDuration > audioDuration * 2) {
      throw new Error(`NFR2 violation: Transcription took ${this._transcriptionDuration}ms but audio was ${audioDuration}ms`);
    }

    const transcription = `Transcription of ${audioFilePath}`;
    this._transcriptionResults.set(audioFilePath, transcription);
    return transcription;
  }

  triggerError(): void {
    this._failNextTranscription = true;
  }

  getTranscriptionResult(audioFilePath: string): string | undefined {
    return this._transcriptionResults.get(audioFilePath);
  }

  private async _simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(): void {
    this._modelInstalled = true;
    this._transcriptionResults.clear();
    this._failNextTranscription = false;
    this._transcriptionDuration = 1000;
  }
}

// ============================================================================
// Mock Transcription Queue (Story 2.5)
// ============================================================================

export interface TranscriptionJob {
  captureId: string;
  audioFilePath: string;
  audioDuration: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class MockTranscriptionQueue {
  private _queue: TranscriptionJob[] = [];
  private _processing: boolean = false;

  addJob(captureId: string, audioFilePath: string, audioDuration: number): void {
    this._queue.push({
      captureId,
      audioFilePath,
      audioDuration,
      status: 'pending',
    });
  }

  getJobsCount(): number {
    return this._queue.length;
  }

  getPendingJobsCount(): number {
    return this._queue.filter(job => job.status === 'pending').length;
  }

  getNextJob(): TranscriptionJob | null {
    const pendingJob = this._queue.find(job => job.status === 'pending');
    if (pendingJob) {
      pendingJob.status = 'processing';
      return pendingJob;
    }
    return null;
  }

  markJobCompleted(captureId: string): void {
    const job = this._queue.find(job => job.captureId === captureId);
    if (job) {
      job.status = 'completed';
    }
  }

  markJobFailed(captureId: string): void {
    const job = this._queue.find(job => job.captureId === captureId);
    if (job) {
      job.status = 'failed';
    }
  }

  isProcessing(): boolean {
    return this._processing;
  }

  setProcessing(processing: boolean): void {
    this._processing = processing;
  }

  getJobs(): TranscriptionJob[] {
    return [...this._queue];
  }

  clear(): void {
    this._queue = [];
    this._processing = false;
  }

  reset(): void {
    this.clear();
  }
}

// ============================================================================
// Mock Audio Player (Story 2.6)
// ============================================================================

export class MockAudioPlayer {
  private _audioFilePath: string | null = null;
  private _audioDuration: number = 0;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private _currentPosition: number = 0;
  private _playbackSpeed: number = 1.0;

  async loadAudio(filePath: string, durationMs: number): Promise<void> {
    this._audioFilePath = filePath;
    this._audioDuration = durationMs;
    this._currentPosition = 0;
    this._isPlaying = false;
    this._isPaused = false;
  }

  async play(): Promise<void> {
    if (!this._audioFilePath) {
      throw new Error('No audio file loaded');
    }
    this._isPlaying = true;
    this._isPaused = false;
  }

  async pause(): Promise<void> {
    if (!this._isPlaying) {
      throw new Error('Audio not playing');
    }
    this._isPlaying = false;
    this._isPaused = true;
  }

  async stop(): Promise<void> {
    this._isPlaying = false;
    this._isPaused = false;
    this._currentPosition = 0;
  }

  async seekTo(positionMs: number): Promise<void> {
    if (positionMs < 0 || positionMs > this._audioDuration) {
      throw new Error('Invalid seek position');
    }
    this._currentPosition = positionMs;
  }

  setPlaybackSpeed(speed: number): void {
    if (speed <= 0 || speed > 2.0) {
      throw new Error('Invalid playback speed');
    }
    this._playbackSpeed = speed;
  }

  getAudioFilePath(): string | null {
    return this._audioFilePath;
  }

  getAudioDuration(): number {
    return this._audioDuration;
  }

  isPlaying(): boolean {
    return this._isPlaying;
  }

  isPaused(): boolean {
    return this._isPaused;
  }

  getCurrentPosition(): number {
    return this._currentPosition;
  }

  getPlaybackSpeed(): number {
    return this._playbackSpeed;
  }

  setCurrentTime(timeMs: number): void {
    if (timeMs < 0 || timeMs > this._audioDuration) {
      throw new Error('Invalid time position');
    }
    this._currentPosition = timeMs;
  }

  canPlay(): boolean {
    return this._audioFilePath !== null;
  }

  getDuration(): number {
    return this._audioDuration;
  }

  getCurrentTime(): number {
    return this._currentPosition;
  }

  setPosition(positionMs: number): void {
    if (positionMs < 0 || positionMs > this._audioDuration) {
      throw new Error('Invalid position');
    }
    this._currentPosition = positionMs;
  }

  reset(): void {
    this._audioFilePath = null;
    this._audioDuration = 0;
    this._isPlaying = false;
    this._isPaused = false;
    this._currentPosition = 0;
    this._playbackSpeed = 1.0;
  }
}

// ============================================================================
// Mock Network Status (for Story 3.1 offline indicator)
// ============================================================================

export class MockNetwork {
  private _isOffline: boolean = false;
  private _lastError: Error | null = null;

  setOffline(offline: boolean): void {
    this._isOffline = offline;
  }

  isOffline(): boolean {
    return this._isOffline;
  }

  isConnected(): boolean {
    return !this._isOffline;
  }

  setError(error: Error | null): void {
    this._lastError = error;
  }

  getLastError(): Error | null {
    return this._lastError;
  }

  reset(): void {
    this._isOffline = false;
    this._lastError = null;
  }
}

// ============================================================================
// Mock Notification Service (Story 4.4)
// ============================================================================

export class MockNotificationService {
  public sentNotifications: Array<{
    type: string;
    title: string;
    body: string;
    data?: any;
    timestamp: Date;
  }> = [];

  public permissions: 'granted' | 'denied' | 'undetermined' = 'granted';

  async requestPermissions(): Promise<boolean> {
    return this.permissions === 'granted';
  }

  async showQueuedNotification(captureId: string, queuePosition?: number): Promise<string> {
    const notification = {
      type: 'queued',
      title: 'Processing your thought...',
      body: queuePosition ? `Position in queue: ${queuePosition}` : 'Starting soon',
      data: { captureId, type: 'queued' },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showProcessingNotification(captureId: string, elapsed: number): Promise<string | null> {
    if (elapsed < 10000) return null;

    const notification = {
      type: 'still_processing',
      title: 'Still processing...',
      body: `Taking longer than usual (${Math.round(elapsed / 1000)}s)`,
      data: { captureId, type: 'still_processing' },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showCompletionNotification(
    captureId: string,
    summary: string,
    ideasCount: number,
    todosCount: number
  ): Promise<string> {
    const notification = {
      type: 'completed',
      title: '✨ New insights from your thought!',
      body: `${ideasCount} ideas, ${todosCount} actions. "${summary.substring(0, 50)}..."`,
      data: { captureId, type: 'completed', deepLink: `pensieve://capture/${captureId}` },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showErrorNotification(captureId: string, retryCount: number): Promise<string> {
    const notification = {
      type: 'failed',
      title: 'Unable to process thought',
      body: 'Tap to retry',
      data: { captureId, type: 'failed', action: 'retry' },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showTimeoutWarningNotification(captureId: string, elapsed: number): Promise<string> {
    const notification = {
      type: 'timeout_warning',
      title: '⚠️ This is taking longer than usual...',
      body: `Processing for ${Math.round(elapsed / 1000)}s. Keep waiting?`,
      data: { captureId, type: 'timeout_warning' },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showOfflineQueueNotification(queuedCount: number): Promise<string> {
    const notification = {
      type: 'offline_queue',
      title: 'Offline Queue',
      body: `${queuedCount} capture${queuedCount > 1 ? 's' : ''} queued for when online`,
      data: { type: 'offline_queue', count: queuedCount },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  async showNetworkRestoredNotification(queuedCount: number): Promise<string> {
    const notification = {
      type: 'network_restored',
      title: '🌐 Network Restored',
      body: `Processing ${queuedCount} queued capture${queuedCount > 1 ? 's' : ''}...`,
      data: { type: 'network_restored', count: queuedCount },
      timestamp: new Date(),
    };
    this.sentNotifications.push(notification);
    return `notification-${Date.now()}`;
  }

  getNotificationsByType(type: string) {
    return this.sentNotifications.filter((n) => n.type === type);
  }

  getLastNotification() {
    return this.sentNotifications[this.sentNotifications.length - 1];
  }

  reset() {
    this.sentNotifications = [];
    this.permissions = 'granted';
  }
}

// ============================================================================
// Mock WebSocket (Story 4.4)
// ============================================================================

export class MockWebSocket {
  public listeners: Map<string, Array<(data: any) => void>> = new Map();
  public emittedEvents: Array<{ event: string; data: any; timestamp: Date }> = [];
  public connected = false;

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    this.emittedEvents.push({ event, data, timestamp: new Date() });
  }

  // Test helper: trigger an event as if received from server
  triggerEvent(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  reset() {
    this.listeners.clear();
    this.emittedEvents = [];
    this.connected = false;
  }
}

// ============================================================================
// Mock Haptic Service (Story 4.4)
// ============================================================================

export class MockHapticService {
  public triggeredHaptics: Array<{
    type: 'impact' | 'notification' | 'selection';
    style?: 'light' | 'medium' | 'heavy';
    timestamp: Date;
  }> = [];

  public enabled = true;

  async triggerImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
    if (!this.enabled) return;
    this.triggeredHaptics.push({
      type: 'impact',
      style,
      timestamp: new Date(),
    });
  }

  async triggerNotification(type: 'success' | 'warning' | 'error'): Promise<void> {
    if (!this.enabled) return;
    this.triggeredHaptics.push({
      type: 'notification',
      timestamp: new Date(),
    });
  }

  async triggerSelection(): Promise<void> {
    if (!this.enabled) return;
    this.triggeredHaptics.push({
      type: 'selection',
      timestamp: new Date(),
    });
  }

  getHapticsByType(type: string) {
    return this.triggeredHaptics.filter((h) => h.type === type);
  }

  reset() {
    this.triggeredHaptics = [];
    this.enabled = true;
  }
}

// ============================================================================
// Test Context (aggregates all mocks)
// ============================================================================

export class TestContext {
  public db: InMemoryDatabase;
  public audioRecorder: MockAudioRecorder;
  public fileSystem: MockFileSystem;
  public permissions: MockPermissionManager;
  public auth: MockSupabaseAuth;
  public storage: MockAsyncStorage;
  public rgpd: MockRGPDService;

  // Story 2.2 - Text Capture mocks
  public keyboard: MockKeyboard;
  public textInput: MockTextInput;
  public dialog: MockDialog;
  public draftStorage: MockDraftStorage;
  public app: MockApp;

  // Story 2.5 - Transcription mocks
  public whisper: MockWhisperService;
  public transcriptionQueue: MockTranscriptionQueue;

  // Story 2.6 - Audio Player mock
  public audioPlayer: MockAudioPlayer;

  // Story 3.1 - Network status mock
  public network: MockNetwork;

  // Story 4.4 - Notifications, WebSocket, Haptics mocks
  public notifications: MockNotificationService;
  public webSocket: MockWebSocket;
  public haptics: MockHapticService;

  private _userId: string = 'test-user';
  private _isOffline: boolean = false;

  constructor() {
    this.db = new InMemoryDatabase();
    this.audioRecorder = new MockAudioRecorder();
    this.fileSystem = new MockFileSystem();
    this.permissions = new MockPermissionManager();
    this.auth = new MockSupabaseAuth();
    this.storage = new MockAsyncStorage();
    this.rgpd = new MockRGPDService();

    // Story 2.2 mocks
    this.keyboard = new MockKeyboard();
    this.textInput = new MockTextInput();
    this.dialog = new MockDialog();
    this.draftStorage = new MockDraftStorage();
    this.app = new MockApp();

    // Story 2.5 mocks
    this.whisper = new MockWhisperService();
    this.transcriptionQueue = new MockTranscriptionQueue();

    // Story 2.6 mocks
    this.audioPlayer = new MockAudioPlayer();

    // Story 3.1 mocks
    this.network = new MockNetwork();

    // Story 4.4 mocks
    this.notifications = new MockNotificationService();
    this.webSocket = new MockWebSocket();
    this.haptics = new MockHapticService();
  }

  setUserId(userId: string): void {
    this._userId = userId;
  }

  getUserId(): string {
    return this._userId;
  }

  setOffline(offline: boolean): void {
    this._isOffline = offline;
  }

  isOffline(): boolean {
    return this._isOffline;
  }

  reset(): void {
    this.db.reset();
    this.audioRecorder.reset();
    this.fileSystem.reset();
    this.permissions.reset();
    this.auth.reset();
    this.storage.reset();
    this.rgpd.reset();

    // Story 2.2 resets
    this.keyboard.reset();
    this.textInput.reset();
    this.dialog.reset();
    this.draftStorage.reset();
    this.app.reset();

    // Story 2.5 resets
    this.whisper.reset();
    this.transcriptionQueue.reset();

    // Story 2.6 resets
    this.audioPlayer.reset();

    // Story 3.1 resets
    this.network.reset();

    // Story 4.4 resets
    this.notifications.reset();
    this.webSocket.reset();
    this.haptics.reset();

    this._userId = 'test-user';
    this._isOffline = false;
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

export function generateFilePath(userId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const uuid = uuidv4();
  return `capture_${userId}_${ts}_${uuid}.m4a`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Story 3.2 - Capture Detail Helper Functions
// ============================================================================

/**
 * Create a mock audio capture
 */
export function createMockAudioCapture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: uuidv4(),
    type: 'AUDIO',
    state: 'ready',
    rawContent: 'mock://audio_capture.m4a',
    normalizedText: 'Transcription de l\'audio',
    capturedAt: new Date(),
    duration: 60000, // 1 minute
    fileSize: 512000, // 500KB
    filePath: 'mock://audio_capture.m4a',
    format: 'm4a',
    location: null,
    tags: [],
    recoveredFromCrash: false,
    ...overrides,
  };
}

/**
 * Create a mock text capture
 */
export function createMockTextCapture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: uuidv4(),
    type: 'TEXT',
    state: 'ready',
    rawContent: 'Texte de la capture',
    normalizedText: 'Texte de la capture',
    capturedAt: new Date(),
    duration: undefined,
    fileSize: undefined,
    filePath: undefined,
    format: undefined,
    location: null,
    tags: [],
    recoveredFromCrash: false,
    ...overrides,
  };
}

/**
 * Create a generic mock capture (defaults to audio)
 */
export function createMockCapture(overrides: Partial<Capture> = {}): Capture {
  return createMockAudioCapture(overrides);
}

/**
 * Mock CaptureRepository for Story 3.2 tests
 */
export function mockCaptureRepository() {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByState: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    observeById: jest.fn(), // For AC5 - Live transcription updates
  };
}

/**
 * Mock NetworkContext for Story 3.2 tests
 */
export const mockNetworkContext = {
  isOffline: false,
  mockOnline: () => {
    mockNetworkContext.isOffline = false;
  },
  mockOffline: () => {
    mockNetworkContext.isOffline = true;
  },
};

/**
 * Setup test container with DI mocks
 */
export function setupTestContainer() {
  // Clear all registered instances
  if (typeof jest !== 'undefined') {
    jest.clearAllMocks();
  }
  // Additional DI setup if needed
}

/**
 * Cleanup test container after tests
 */
export function cleanupTestContainer() {
  // Clean up DI registrations
  if (typeof jest !== 'undefined') {
    jest.resetAllMocks();
  }
}

// Export singleton instance for tests
export const testContext = new TestContext();
