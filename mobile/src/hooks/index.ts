// Capture-specific hooks
export { useCaptureAudioPlayer } from './useCaptureAudioPlayer';
export { useCaptureTranscription } from './useCaptureTranscription';
export { useDialogState } from './useDialogState';
export { useCaptureActions } from './useCaptureActions';

// Dependency Injection hooks
export { useDI, useOptionalDI, useIsDIRegistered, useDIWithFallback } from './useDI';

// Service-specific hooks
export {
  useCaptureRepository,
  useTranscriptionQueue,
  useTranscriptionModel,
  useTranscriptionEngine,
  useSyncService,
} from './useServices';
