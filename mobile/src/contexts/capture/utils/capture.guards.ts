/**
 * Guards utilitaires pour les captures
 * Story 16.1 — AC1, AC2, AC6
 */

import type { Capture } from '../domain/Capture.model';

type CaptureWithOptionalQueue = Pick<Capture, 'state'> & { isInQueue?: boolean };

/**
 * Retourne true si une capture est en cours de traitement ou en attente dans la queue.
 * Pendant cet état, toutes les actions sont verrouillées sauf la lecture audio.
 */
export function isProcessing(capture: CaptureWithOptionalQueue): boolean {
  return capture.state === 'processing' || capture.isInQueue === true;
}
