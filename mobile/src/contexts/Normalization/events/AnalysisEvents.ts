/**
 * Analysis Queue Domain Events
 *
 * Events emitted by AnalysisQueueService on analysis completion or failure.
 * Consumed by useAnalyses (React hook) to update UI state.
 *
 * Story 16.3 — Queue d'Analyses Asynchrone
 */

import type { DomainEvent } from '../../shared/events/DomainEvent';
import type { AnalyzeResult } from '../services/CaptureAnalysisService';
import type { AnalysisType } from '../../capture/domain/CaptureAnalysis.model';

export interface AnalysisCompletedPayload {
  readonly captureId: string;
  readonly analysisType: AnalysisType;
  readonly result: AnalyzeResult;
}

export interface AnalysisFailedPayload {
  readonly captureId: string;
  readonly analysisType: AnalysisType;
  readonly error: string;
}

export interface AnalysisStartedPayload {
  readonly captureId: string;
  readonly analysisType: AnalysisType;
}

export interface AnalysisStartedEvent extends DomainEvent {
  readonly type: 'AnalysisStarted';
  readonly payload: AnalysisStartedPayload;
}

export interface AnalysisCompletedEvent extends DomainEvent {
  readonly type: 'AnalysisCompleted';
  readonly payload: AnalysisCompletedPayload;
}

export interface AnalysisFailedEvent extends DomainEvent {
  readonly type: 'AnalysisFailed';
  readonly payload: AnalysisFailedPayload;
}
