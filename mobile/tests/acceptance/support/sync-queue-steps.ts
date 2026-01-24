/**
 * Sync Queue Step Definitions
 *
 * Common step definitions for testing sync queue functionality
 * Replace syncStatus-based assertions with sync_queue-based ones
 */

import { defineStep } from '@cucumber/cucumber';
import { expect } from '@jest/globals';
import type { TestContext } from './test-context';

/**
 * Check if a capture is in the sync queue (pending sync)
 */
defineStep(/la capture est dans la queue de synchronisation/, async function (this: TestContext) {
  const isPending = await this.database.isPendingSync(this.currentCapture.id);
  expect(isPending).toBe(true);
});

/**
 * Check if a capture is synchronized (not in sync queue)
 */
defineStep(/la capture est synchronisée/, async function (this: TestContext) {
  const isPending = await this.database.isPendingSync(this.currentCapture.id);
  expect(isPending).toBe(false);
});

/**
 * Check if a capture has a conflict
 */
defineStep(/la capture a un conflit de synchronisation/, async function (this: TestContext) {
  const hasConflict = await this.database.hasConflict(this.currentCapture.id);
  expect(hasConflict).toBe(true);
});

/**
 * Check if multiple captures are in sync queue
 */
defineStep(/les (\d+) captures sont dans la queue de synchronisation/, async function (this: TestContext, count: string) {
  const expectedCount = parseInt(count, 10);
  const pendingCaptures = await this.database.findPendingSync();
  expect(pendingCaptures.length).toBe(expectedCount);
});

/**
 * Check if all captures are in sync queue
 */
defineStep(/toutes les captures sont dans la queue de synchronisation/, async function (this: TestContext) {
  const allCaptures = await this.database.findAll();
  const pendingCaptures = await this.database.findPendingSync();
  expect(pendingCaptures.length).toBe(allCaptures.length);
});

/**
 * Check if no captures are in sync queue
 */
defineStep(/aucune capture n'est dans la queue de synchronisation/, async function (this: TestContext) {
  const queueSize = await this.database.getSyncQueueSize();
  expect(queueSize).toBe(0);
});

/**
 * Given step: user has X captures in sync queue
 */
defineStep(/l'utilisateur a (\d+) captures dans la queue de synchronisation/, async function (this: TestContext, count: string) {
  const expectedCount = parseInt(count, 10);
  for (let i = 0; i < expectedCount; i++) {
    await this.database.create({
      type: 'AUDIO',
      state: 'CAPTURED',
      rawContent: `capture-${i}.m4a`,
    });
  }
  const queueSize = await this.database.getSyncQueueSize();
  expect(queueSize).toBe(expectedCount);
});

/**
 * Given step: user has X synchronized captures
 */
defineStep(/l'utilisateur a (\d+) captures synchronisées/, async function (this: TestContext, count: string) {
  const expectedCount = parseInt(count, 10);
  for (let i = 0; i < expectedCount; i++) {
    const capture = await this.database.create({
      type: 'AUDIO',
      state: 'CAPTURED',
      rawContent: `synced-capture-${i}.m4a`,
    });
    // Remove from sync queue to mark as synced
    await this.database.removeFromSyncQueueByEntityId(capture.id);
  }
  const syncedCaptures = await this.database.findSynced();
  expect(syncedCaptures.length).toBe(expectedCount);
});

/**
 * Given step: capture in sync queue
 */
defineStep(/une Capture dans la queue de synchronisation est créée/, async function (this: TestContext) {
  this.currentCapture = await this.database.create({
    type: 'AUDIO',
    state: 'RECORDING',
    rawContent: 'recording.m4a',
  });
  const isPending = await this.database.isPendingSync(this.currentCapture.id);
  expect(isPending).toBe(true);
});

/**
 * Then step: capture was added to sync queue
 */
defineStep(/la Capture est ajoutée à la queue de synchronisation/, async function (this: TestContext) {
  const isPending = await this.database.isPendingSync(this.currentCapture.id);
  expect(isPending).toBe(true);
});
