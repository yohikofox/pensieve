/**
 * Queue Monitoring Service
 * Monitors queue health, metrics, and implements graceful degradation
 *
 * Covers:
 * - Subtask 6.1: Queue depth monitoring
 * - Subtask 6.2: Alert threshold detection
 * - Subtask 6.3: Estimated processing time calculation
 * - Subtask 6.4: Prometheus metrics
 * - Subtask 6.5: Graceful degradation
 *
 * AC6: Queue Monitoring and Metrics
 */

import { Injectable, Logger } from '@nestjs/common';

export interface QueueMetrics {
  jobsProcessed: number;
  jobsFailed: number;
  avgLatencyMs: number;
  currentQueueDepth: number;
  timestamp: Date;
}

@Injectable()
export class QueueMonitoringService {
  private readonly logger = new Logger(QueueMonitoringService.name);

  // Metrics state
  private jobsProcessed = 0;
  private jobsFailed = 0;
  private latencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 100; // Keep last 100 samples

  // Configuration
  private readonly OVERLOAD_THRESHOLD = 100; // Jobs in queue
  private readonly PREFETCH_COUNT = 3; // Concurrent workers (from AC3)
  private readonly AVG_JOB_DURATION_MS = 20000; // 20s estimate (from NFR3)

  /**
   * Get current queue depth (number of pending jobs)
   * Subtask 6.1: Queue depth monitoring
   *
   * NOTE: This is a stub. In real implementation, this would query RabbitMQ
   * management API or use amqplib channel.checkQueue()
   *
   * @returns Number of jobs waiting in queue
   */
  async getQueueDepth(): Promise<number> {
    // TODO: Query actual RabbitMQ queue depth
    // For now, return 0 (no jobs pending)
    // In production:
    // const queueInfo = await this.channel.checkQueue('digestion-jobs');
    // return queueInfo.messageCount;
    return 0;
  }

  /**
   * Check if queue depth exceeds alert threshold
   * Subtask 6.2: Alert threshold detection
   *
   * @param threshold - Max acceptable queue depth (default: 100)
   * @returns True if queue is overloaded
   */
  async isQueueOverloaded(threshold: number = this.OVERLOAD_THRESHOLD): Promise<boolean> {
    const queueDepth = await this.getQueueDepth();
    const isOverloaded = queueDepth > threshold;

    if (isOverloaded) {
      this.logger.warn(
        `⚠️  Queue overloaded: ${queueDepth} jobs (threshold: ${threshold})`,
      );
    }

    return isOverloaded;
  }

  /**
   * Calculate estimated wait time for new job
   * Subtask 6.3: Estimated processing time
   *
   * Formula: ceil(queueDepth / concurrentWorkers) * avgProcessingTime
   *
   * @param queueDepth - Number of jobs in queue
   * @param avgProcessingTime - Average job duration in ms
   * @param concurrentWorkers - Number of parallel workers
   * @returns Estimated wait time in milliseconds
   */
  calculateEstimatedWaitTime(
    queueDepth: number,
    avgProcessingTime: number = this.AVG_JOB_DURATION_MS,
    concurrentWorkers: number = this.PREFETCH_COUNT,
  ): number {
    if (queueDepth === 0) {
      return 0;
    }

    // Calculate how many batches of jobs will be processed
    const batches = Math.ceil(queueDepth / concurrentWorkers);

    // Estimated wait = batches * avg processing time
    return batches * avgProcessingTime;
  }

  /**
   * Record successful job completion
   * Subtask 6.4: Metrics tracking
   */
  recordJobProcessed(): void {
    this.jobsProcessed++;
  }

  /**
   * Record job failure
   * Subtask 6.4: Metrics tracking
   */
  recordJobFailed(): void {
    this.jobsFailed++;
  }

  /**
   * Record job processing latency
   * Subtask 6.4: Metrics tracking
   *
   * @param latencyMs - Job duration in milliseconds
   */
  recordJobLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);

    // Keep only last N samples to avoid memory growth
    if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }
  }

  /**
   * Get current metrics snapshot
   * Subtask 6.4: Metrics tracking
   *
   * @returns Current queue metrics
   */
  getMetrics(): QueueMetrics {
    const avgLatency =
      this.latencies.length > 0
        ? this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length
        : 0;

    return {
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      avgLatencyMs: Math.round(avgLatency),
      currentQueueDepth: 0, // TODO: Get real queue depth
      timestamp: new Date(),
    };
  }

  /**
   * Export metrics in Prometheus format
   * Subtask 6.4: Prometheus metrics
   *
   * @returns Prometheus-formatted metrics string
   */
  getPrometheusMetrics(): string {
    const metrics = this.getMetrics();

    return `
# HELP digestion_jobs_processed_total Total number of digestion jobs processed
# TYPE digestion_jobs_processed_total counter
digestion_jobs_processed_total ${metrics.jobsProcessed}

# HELP digestion_jobs_failed_total Total number of digestion jobs failed
# TYPE digestion_jobs_failed_total counter
digestion_jobs_failed_total ${metrics.jobsFailed}

# HELP digestion_job_latency_milliseconds Average job processing latency
# TYPE digestion_job_latency_milliseconds gauge
digestion_job_latency_milliseconds ${metrics.avgLatencyMs}

# HELP digestion_queue_depth Current number of jobs in queue
# TYPE digestion_queue_depth gauge
digestion_queue_depth ${metrics.currentQueueDepth}
`.trim();
  }

  /**
   * Determine if new job creation should be paused
   * Subtask 6.5: Graceful degradation
   *
   * @returns True if job creation should be paused
   */
  async shouldPauseJobCreation(): Promise<boolean> {
    return await this.isQueueOverloaded();
  }

  /**
   * Get monitoring statistics for logging/debugging
   */
  getStats(): {
    successRate: number;
    totalJobs: number;
    avgLatencyMs: number;
  } {
    const totalJobs = this.jobsProcessed + this.jobsFailed;
    const successRate = totalJobs > 0 ? this.jobsProcessed / totalJobs : 0;

    return {
      successRate: Math.round(successRate * 100) / 100,
      totalJobs,
      avgLatencyMs: this.getMetrics().avgLatencyMs,
    };
  }
}
