/**
 * Metrics Controller
 * Exposes Prometheus metrics for monitoring
 *
 * Covers:
 * - Subtask 6.4: Prometheus metrics endpoint
 *
 * AC6: Queue Monitoring and Metrics
 */

import { Controller, Get, Header } from '@nestjs/common';
import { QueueMonitoringService } from '../services/queue-monitoring.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly queueMonitoring: QueueMonitoringService,
  ) {}

  /**
   * Prometheus metrics endpoint
   * GET /metrics
   *
   * Returns metrics in Prometheus text format
   * Compatible with Prometheus scraping
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getPrometheusMetrics(): string {
    return this.queueMonitoring.getPrometheusMetrics();
  }

  /**
   * Human-readable metrics JSON endpoint
   * GET /metrics/json
   *
   * Returns metrics as JSON for debugging
   */
  @Get('json')
  getMetricsJson() {
    return this.queueMonitoring.getMetrics();
  }
}
