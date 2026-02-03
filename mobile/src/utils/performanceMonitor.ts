/**
 * Performance Monitoring Utilities
 *
 * Story 3.4 - Task 7: Performance Optimization (Subtask 7.5)
 *
 * Provides utilities to monitor and log performance metrics:
 * - FlatList scroll performance
 * - Animation frame rate
 * - Render times
 * - Memory usage
 *
 * Usage:
 * ```ts
 * const monitor = new PerformanceMonitor('CapturesListScreen');
 * monitor.startTracking();
 * // ... operations ...
 * monitor.endTracking();
 * ```
 */

interface PerformanceMetrics {
  componentName: string;
  timestamp: number;
  duration?: number;
  fps?: number;
  memoryUsage?: number;
  renderCount?: number;
}

/**
 * Performance Monitor
 *
 * Tracks performance metrics for React Native components.
 * Logs to console in development mode only.
 */
export class PerformanceMonitor {
  private componentName: string;
  private startTime: number = 0;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private renderCount: number = 0;
  private enabled: boolean;

  constructor(componentName: string, enabled: boolean = __DEV__) {
    this.componentName = componentName;
    this.enabled = enabled;
  }

  /**
   * Start tracking performance
   */
  startTracking() {
    if (!this.enabled) return;

    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    this.renderCount = 0;

    this.log('Performance tracking started');
  }

  /**
   * End tracking and log results
   */
  endTracking() {
    if (!this.enabled) return;

    const duration = performance.now() - this.startTime;
    const fps = this.calculateFPS();

    const metrics: PerformanceMetrics = {
      componentName: this.componentName,
      timestamp: Date.now(),
      duration,
      fps,
      renderCount: this.renderCount,
    };

    this.log('Performance tracking ended', metrics);
  }

  /**
   * Track a render event
   */
  trackRender() {
    if (!this.enabled) return;

    this.renderCount++;
    this.frameCount++;

    const now = performance.now();
    const frameDuration = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Warn if frame duration exceeds 16.67ms (60fps threshold)
    if (frameDuration > 16.67) {
      this.warn(`Slow frame detected: ${frameDuration.toFixed(2)}ms (target: 16.67ms for 60fps)`);
    }
  }

  /**
   * Track scroll event performance
   */
  trackScroll(scrollOffset: number) {
    if (!this.enabled) return;

    const now = performance.now();
    const frameDuration = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Log if scroll performance drops below 60fps
    if (frameDuration > 16.67) {
      this.warn(`Scroll jank at offset ${scrollOffset.toFixed(0)}px: ${frameDuration.toFixed(2)}ms`);
    }
  }

  /**
   * Calculate average FPS
   */
  private calculateFPS(): number {
    const duration = (performance.now() - this.startTime) / 1000; // Convert to seconds
    return duration > 0 ? this.frameCount / duration : 0;
  }

  /**
   * Log performance info (development only)
   */
  private log(message: string, data?: any) {
    if (!this.enabled) return;
    console.log(`[PerformanceMonitor] [${this.componentName}] ${message}`, data || '');
  }

  /**
   * Log performance warning (development only)
   */
  private warn(message: string) {
    if (!this.enabled) return;
    console.warn(`[PerformanceMonitor] [${this.componentName}] ⚠️ ${message}`);
  }
}

/**
 * Measure execution time of an async function
 *
 * @param label - Label for the measurement
 * @param fn - Async function to measure
 * @returns Result of the function
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!__DEV__) return fn();

  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Measure execution time of a synchronous function
 *
 * @param label - Label for the measurement
 * @param fn - Synchronous function to measure
 * @returns Result of the function
 */
export function measureSync<T>(label: string, fn: () => T): T {
  if (!__DEV__) return fn();

  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * FlatList performance helper
 *
 * Provides callbacks for monitoring FlatList performance metrics.
 */
export class FlatListPerformanceMonitor {
  private componentName: string;
  private enabled: boolean;
  private lastScrollOffset: number = 0;
  private lastScrollTime: number = 0;

  constructor(componentName: string, enabled: boolean = __DEV__) {
    this.componentName = componentName;
    this.enabled = enabled;
  }

  /**
   * Callback for FlatList onScroll event
   * Monitors scroll performance and detects jank
   */
  onScroll = (event: any) => {
    if (!this.enabled) return;

    const currentOffset = event.nativeEvent.contentOffset.y;
    const now = performance.now();

    if (this.lastScrollTime > 0) {
      const scrollDelta = Math.abs(currentOffset - this.lastScrollOffset);
      const timeDelta = now - this.lastScrollTime;
      const fps = timeDelta > 0 ? 1000 / timeDelta : 0;

      // Warn if FPS drops below 55 (allowing 5fps margin)
      if (fps < 55 && fps > 0) {
        console.warn(
          `[Performance] [${this.componentName}] Scroll FPS: ${fps.toFixed(1)} ` +
          `(target: 60fps, offset: ${currentOffset.toFixed(0)}px)`
        );
      }
    }

    this.lastScrollOffset = currentOffset;
    this.lastScrollTime = now;
  };

  /**
   * Callback for FlatList viewabilityConfigCallbackPairs
   * Logs viewable items changes
   */
  onViewableItemsChanged = (info: any) => {
    if (!this.enabled) return;

    const viewableCount = info.viewableItems?.length || 0;
    console.log(
      `[Performance] [${this.componentName}] Viewable items: ${viewableCount}`
    );
  };
}
