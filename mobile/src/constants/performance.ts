/**
 * Performance Constants
 *
 * Story 3.1 - Code Review Follow-up (LOW Priority)
 *
 * FlatList and React Native performance optimization constants.
 * Centralized for consistency and easy tuning.
 *
 * References:
 * - React Native FlatList Optimization: https://reactnative.dev/docs/optimizing-flatlist-configuration
 * - FlatList Performance Guide: https://reactnative.dev/docs/flatlist#performance
 */

/**
 * FlatList Optimization Constants
 *
 * These values are tuned for optimal 60fps scrolling performance
 * on typical mobile devices (2-4GB RAM, mid-range CPU).
 */
export const FLATLIST_PERFORMANCE = {
  /**
   * Number of items to render on initial mount
   * Higher = faster perceived load, but slower actual render
   * Lower = slower perceived load, but faster actual render
   *
   * Recommended: 10 for lists with complex items, 20 for simple items
   */
  INITIAL_NUM_TO_RENDER: 10,

  /**
   * Maximum number of items to render per batch when scrolling
   * Higher = smoother scroll but more memory, Lower = choppy scroll but less memory
   *
   * Recommended: 5-10 for most cases
   */
  MAX_TO_RENDER_PER_BATCH: 10,

  /**
   * Number of screens worth of content to render outside viewport
   * Higher = less blank content while scrolling, but more memory
   * Lower = more blank content while scrolling, but less memory
   *
   * Recommended: 5-10 (5 = 2.5 screens above + 2.5 screens below)
   */
  WINDOW_SIZE: 5,

  /**
   * Threshold (0-1) for triggering onEndReached callback
   * 0.5 = trigger when user is halfway through last screen of content
   *
   * Recommended: 0.3-0.5 for smooth infinite scroll
   */
  END_REACHED_THRESHOLD: 0.5,

  /**
   * Number of items to load per infinite scroll batch
   * Balance between UX (fewer loads) and memory (smaller batches)
   *
   * Recommended: 20-50 depending on item complexity
   */
  PAGINATION_BATCH_SIZE: 20,
} as const;

/**
 * Animation Performance Constants
 */
export const ANIMATION_PERFORMANCE = {
  /**
   * Standard animation duration for UI transitions (ms)
   * Based on Material Design motion guidelines
   */
  STANDARD_DURATION: 300,

  /**
   * Fast animation duration for micro-interactions (ms)
   */
  FAST_DURATION: 150,

  /**
   * Slow animation duration for emphasis (ms)
   */
  SLOW_DURATION: 500,
} as const;
