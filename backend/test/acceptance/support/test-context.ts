/**
 * Test Context for Backend BDD Tests - Story 4.1
 *
 * Provides in-memory mocks for:
 * - RabbitMQ (queue management, publishing, consuming)
 * - Capture Repository (status updates)
 * - Progress Tracker (real-time updates)
 * - Event Bus (domain events)
 *
 * Pattern: Pure functions, deterministic, no external dependencies
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DigestionJobPayload {
  captureId: string;
  userId: string;
  contentType: 'text' | 'audio_transcribed';
  priority: 'high' | 'normal';
  queuedAt: Date;
  retryCount: number;
}

export interface QueueMessage {
  content: DigestionJobPayload;
  properties: {
    priority: number; // 0-10 (RabbitMQ x-max-priority)
    persistent: boolean;
    headers: Record<string, any>;
  };
  ack: () => void;
  nack: () => void;
}

export interface Capture {
  id: string;
  userId: string;
  type: 'AUDIO' | 'TEXT';
  status: 'queued_for_digestion' | 'digesting' | 'digestion_failed' | 'transcribed';
  processing_started_at?: Date;
  error_message?: string;
  error_stack?: string;
  created_at: Date;
}

export interface DomainEvent {
  eventType: 'DigestionJobQueued' | 'DigestionJobStarted' | 'DigestionJobFailed' | 'QueueOverloaded';
  payload: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// Mock RabbitMQ Service
// ============================================================================

export class MockRabbitMQ {
  private queues: Map<string, QueueMessage[]> = new Map();
  private exchanges: Map<string, string> = new Map();
  private queueConfigs: Map<string, {
    durable: boolean;
    maxPriority?: number;
    deadLetterExchange?: string;
  }> = new Map();
  private prefetchCount: number = 1;
  private heartbeat: number = 60;
  private processingJobs: Set<string> = new Set(); // Track concurrent jobs

  // Queue management
  async assertQueue(
    queueName: string,
    options: {
      durable?: boolean;
      maxPriority?: number;
      deadLetterExchange?: string;
    } = {}
  ): Promise<void> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queueConfigs.set(queueName, {
      durable: options.durable ?? false,
      maxPriority: options.maxPriority,
      deadLetterExchange: options.deadLetterExchange,
    });
  }

  async assertExchange(exchangeName: string, type: string): Promise<void> {
    this.exchanges.set(exchangeName, type);
  }

  checkQueue(queueName: string): { queue: string; durable: boolean } | null {
    if (!this.queues.has(queueName)) {
      return null;
    }
    const config = this.queueConfigs.get(queueName);
    return {
      queue: queueName,
      durable: config?.durable ?? false,
    };
  }

  checkExchange(exchangeName: string): { exchange: string } | null {
    if (!this.exchanges.has(exchangeName)) {
      return null;
    }
    return { exchange: exchangeName };
  }

  // Publishing
  async publish(
    queueName: string,
    payload: DigestionJobPayload,
    options: { priority?: number; persistent?: boolean } = {}
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    const message: QueueMessage = {
      content: payload,
      properties: {
        priority: options.priority ?? 0,
        persistent: options.persistent ?? false,
        headers: {
          'x-retry-count': payload.retryCount,
        },
      },
      ack: () => {
        this.processingJobs.delete(payload.captureId);
      },
      nack: () => {
        // Move to DLQ
        const dlqName = this.queueConfigs.get(queueName)?.deadLetterExchange;
        if (dlqName) {
          this.moveToDeadLetterQueue(payload, dlqName);
        }
        this.processingJobs.delete(payload.captureId);
      },
    };

    // Insert based on priority (higher priority first)
    const insertIndex = queue.findIndex(
      (msg) => msg.properties.priority < message.properties.priority
    );
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }
  }

  // Consuming
  async consume(queueName: string): Promise<QueueMessage | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return null;
    }

    // Check concurrent job limit (prefetch count)
    if (this.processingJobs.size >= this.prefetchCount) {
      return null; // Cannot consume more jobs
    }

    const message = queue.shift()!;
    this.processingJobs.add(message.content.captureId);
    return message;
  }

  getQueueDepth(queueName: string): number {
    return this.queues.get(queueName)?.length ?? 0;
  }

  isQueueOverloaded(queueName: string, threshold: number = 100): boolean {
    return this.getQueueDepth(queueName) > threshold;
  }

  getConcurrentJobsCount(): number {
    return this.processingJobs.size;
  }

  // Configuration
  setPrefetchCount(count: number): void {
    this.prefetchCount = count;
  }

  getPrefetchCount(): number {
    return this.prefetchCount;
  }

  setHeartbeat(seconds: number): void {
    this.heartbeat = seconds;
  }

  getHeartbeat(): number {
    return this.heartbeat;
  }

  // Dead-letter queue
  private moveToDeadLetterQueue(payload: DigestionJobPayload, dlxName: string): void {
    const dlqName = dlxName.replace('-dlx', '-failed');
    if (!this.queues.has(dlqName)) {
      this.assertQueue(dlqName);
    }
    this.queues.get(dlqName)!.push({
      content: { ...payload, retryCount: payload.retryCount + 1 },
      properties: {
        priority: 0,
        persistent: true,
        headers: {
          'x-retry-count': payload.retryCount + 1,
          'x-death': new Date(),
        },
      },
      ack: () => {},
      nack: () => {},
    });
  }

  // Retry logic
  async retryWithBackoff(payload: DigestionJobPayload): Promise<void> {
    const delays = [5000, 15000, 45000]; // 5s, 15s, 45s
    const delay = delays[payload.retryCount] || 0;

    if (payload.retryCount >= 3) {
      // Max retries exceeded, move to DLQ permanently
      const dlqName = 'digestion-failed';
      if (!this.queues.has(dlqName)) {
        await this.assertQueue(dlqName);
      }
      await this.publish(dlqName, payload, { persistent: true });
      return;
    }

    // Simulate delay (in real implementation, use TTL or delayed exchange)
    setTimeout(async () => {
      await this.publish('digestion-jobs', {
        ...payload,
        retryCount: payload.retryCount + 1,
      });
    }, delay);
  }

  // Persistence simulation
  simulateRestart(): void {
    // Keep durable queues, remove non-durable
    const durableQueues = new Map<string, QueueMessage[]>();
    this.queues.forEach((messages, queueName) => {
      const config = this.queueConfigs.get(queueName);
      if (config?.durable) {
        // Keep only persistent messages
        const persistentMessages = messages.filter((msg) => msg.properties.persistent);
        durableQueues.set(queueName, persistentMessages);
      }
    });
    this.queues = durableQueues;
  }

  reset(): void {
    this.queues.clear();
    this.exchanges.clear();
    this.queueConfigs.clear();
    this.prefetchCount = 1;
    this.heartbeat = 60;
    this.processingJobs.clear();
  }
}

// ============================================================================
// Mock Capture Repository
// ============================================================================

export class MockCaptureRepository {
  private captures: Map<string, Capture> = new Map();

  async create(data: Partial<Capture>): Promise<Capture> {
    const capture: Capture = {
      id: data.id || `capture-${Date.now()}`,
      userId: data.userId || 'default-user',
      type: data.type || 'AUDIO',
      status: data.status || 'transcribed',
      created_at: data.created_at || new Date(),
    };
    this.captures.set(capture.id, capture);
    return capture;
  }

  async findById(captureId: string): Promise<Capture | null> {
    return this.captures.get(captureId) || null;
  }

  async updateStatus(
    captureId: string,
    status: Capture['status'],
    additionalFields: Partial<Capture> = {}
  ): Promise<Capture | null> {
    const capture = this.captures.get(captureId);
    if (!capture) {
      return null;
    }
    Object.assign(capture, { status, ...additionalFields });
    return capture;
  }

  async findByStatus(status: Capture['status']): Promise<Capture[]> {
    return Array.from(this.captures.values()).filter((c) => c.status === status);
  }

  getAll(): Capture[] {
    return Array.from(this.captures.values());
  }

  reset(): void {
    this.captures.clear();
  }
}

// ============================================================================
// Mock Progress Tracker
// ============================================================================

export interface JobProgress {
  captureId: string;
  status: 'digesting' | 'completed' | 'failed';
  startedAt: Date;
  progress: number; // 0-100
}

export class MockProgressTracker {
  private progresses: Map<string, JobProgress> = new Map();

  startTracking(captureId: string): JobProgress {
    const progress: JobProgress = {
      captureId,
      status: 'digesting',
      startedAt: new Date(),
      progress: 0,
    };
    this.progresses.set(captureId, progress);
    return progress;
  }

  updateProgress(captureId: string, progressPercent: number): void {
    const progress = this.progresses.get(captureId);
    if (progress) {
      progress.progress = Math.min(100, Math.max(0, progressPercent));
    }
  }

  markCompleted(captureId: string): void {
    const progress = this.progresses.get(captureId);
    if (progress) {
      progress.status = 'completed';
      progress.progress = 100;
    }
  }

  markFailed(captureId: string): void {
    const progress = this.progresses.get(captureId);
    if (progress) {
      progress.status = 'failed';
    }
  }

  getProgress(captureId: string): JobProgress | null {
    return this.progresses.get(captureId) || null;
  }

  reset(): void {
    this.progresses.clear();
  }
}

// ============================================================================
// Mock Event Bus
// ============================================================================

export class MockEventBus {
  private events: DomainEvent[] = [];
  private listeners: Map<string, Array<(event: DomainEvent) => void>> = new Map();

  emit(eventType: DomainEvent['eventType'], payload: Record<string, any>): void {
    const event: DomainEvent = {
      eventType,
      payload,
      timestamp: new Date(),
    };
    this.events.push(event);

    // Trigger listeners
    const eventListeners = this.listeners.get(eventType) || [];
    eventListeners.forEach((listener) => listener(event));
  }

  on(eventType: DomainEvent['eventType'], listener: (event: DomainEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  getEvents(eventType?: DomainEvent['eventType']): DomainEvent[] {
    if (eventType) {
      return this.events.filter((e) => e.eventType === eventType);
    }
    return this.events;
  }

  getLastEvent(eventType: DomainEvent['eventType']): DomainEvent | null {
    const events = this.getEvents(eventType);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  reset(): void {
    this.events = [];
    this.listeners.clear();
  }
}

// ============================================================================
// Mock Logger
// ============================================================================

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export class MockLogger {
  private logs: LogEntry[] = [];

  info(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'info', message, context, timestamp: new Date() });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'warn', message, context, timestamp: new Date() });
  }

  error(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'error', message, context, timestamp: new Date() });
  }

  getLogs(level?: LogEntry['level']): LogEntry[] {
    if (level) {
      return this.logs.filter((log) => log.level === level);
    }
    return this.logs;
  }

  getLastLog(level?: LogEntry['level']): LogEntry | null {
    const logs = this.getLogs(level);
    return logs.length > 0 ? logs[logs.length - 1] : null;
  }

  reset(): void {
    this.logs = [];
  }
}

// ============================================================================
// Test Context (aggregates all mocks)
// ============================================================================

export class TestContext {
  public rabbitmq: MockRabbitMQ;
  public captureRepo: MockCaptureRepository;
  public progressTracker: MockProgressTracker;
  public eventBus: MockEventBus;
  public logger: MockLogger;

  // Test state
  private _userId: string = 'default-user';
  private _isOffline: boolean = false;

  constructor() {
    this.rabbitmq = new MockRabbitMQ();
    this.captureRepo = new MockCaptureRepository();
    this.progressTracker = new MockProgressTracker();
    this.eventBus = new MockEventBus();
    this.logger = new MockLogger();
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

  // Helpers
  async setupRabbitMQInfrastructure(): Promise<void> {
    await this.rabbitmq.assertQueue('digestion-jobs', {
      durable: true,
      maxPriority: 10,
      deadLetterExchange: 'digestion-dlx',
    });
    await this.rabbitmq.assertExchange('digestion-dlx', 'direct');
    await this.rabbitmq.assertQueue('digestion-failed', { durable: true });
    this.rabbitmq.setPrefetchCount(3);
    this.rabbitmq.setHeartbeat(30);
  }

  calculateEstimatedWaitTime(queueDepth: number, avgJobDuration: number = 25): number {
    const concurrentWorkers = this.rabbitmq.getPrefetchCount();
    return Math.ceil((queueDepth / concurrentWorkers) * avgJobDuration);
  }

  reset(): void {
    this.rabbitmq.reset();
    this.captureRepo.reset();
    this.progressTracker.reset();
    this.eventBus.reset();
    this.logger.reset();
    this._userId = 'default-user';
    this._isOffline = false;
  }
}
