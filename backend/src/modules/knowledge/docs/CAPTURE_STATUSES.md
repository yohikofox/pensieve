# Capture Entity Status Updates - Story 4.1

## New Status Values (AC2, AC4, AC5)

Story 4.1 introduces new status values for the Capture entity to track AI digestion progress.

### Status Flow

```
[Existing Statuses]
  recording → captured → transcribing → transcribed
                                          ↓
                                [NEW STATUSES]
                              queued_for_digestion  ← AC2
                                          ↓
                                     digesting       ← AC4
                                     ↙       ↘
                          digestion_failed  digested  ← AC5
```

### New Status Definitions

#### `queued_for_digestion`
- **When**: Set when a digestion job is published to RabbitMQ
- **AC**: AC2 - Automatic Job Publishing After Transcription
- **Trigger**:
  - Audio capture: After transcription completes
  - Text capture: Immediately after creation (bypasses transcription)
- **Next**: `digesting` when worker picks up the job

#### `digesting`
- **When**: Set when a worker starts processing the digestion job
- **AC**: AC4 - Real-Time Progress Updates
- **Trigger**: Worker consumes job from RabbitMQ queue
- **Next**: `digested` (success) or `digestion_failed` (failure)
- **Metadata**: `processing_started_at` timestamp added

#### `digestion_failed`
- **When**: Set when job fails after max retries (3 attempts)
- **AC**: AC5 - Retry Logic with Exponential Backoff
- **Trigger**: 3 consecutive failures with exponential backoff (5s, 15s, 45s)
- **Next**: Manual retry via dedicated endpoint, or stays in failed state
- **Metadata**: Error details logged for debugging

## Database Schema Update (TODO)

When Capture entity is created in backend, add these fields:

```typescript
@Entity('captures')
export class Capture {
  // ... existing fields ...

  @Column({
    type: 'enum',
    enum: [
      // Existing statuses
      'recording', 'captured', 'transcribing', 'transcribed',
      // NEW: Digestion statuses
      'queued_for_digestion',
      'digesting',
      'digestion_failed',
      'digested', // Added in Story 4.2
    ],
  })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  processing_started_at?: Date;

  @Column({ type: 'text', nullable: true })
  digestion_error?: string; // Error details if failed
}
```

## Integration Points

### When to update status

1. **queued_for_digestion** → Set by `DigestionJobPublisher` after publishing to RabbitMQ
2. **digesting** → Set by `DigestionJobConsumer` when starting job (Story 4.1 Task 3)
3. **digestion_failed** → Set by retry logic after max attempts (Story 4.1 Task 5)
4. **digested** → Set when digestion completes successfully (Story 4.2)

### Event-driven updates

```typescript
// TranscriptionCompleted event → Update status to "queued_for_digestion"
await captureRepository.updateStatus(captureId, 'queued_for_digestion');

// DigestionJobStarted event → Update status to "digesting"
await captureRepository.updateStatus(captureId, 'digesting', {
  processing_started_at: new Date()
});

// DigestionJobFailed event → Update status to "digestion_failed"
await captureRepository.updateStatus(captureId, 'digestion_failed', {
  digestion_error: errorMessage
});
```

## Mobile App Updates

The mobile app's Capture model should also include these new statuses for proper sync handling.

See: `mobile/src/contexts/capture/domain/Capture.model.ts`

## References

- AC2: Automatic Job Publishing After Transcription
- AC4: Real-Time Progress Updates
- AC5: Retry Logic with Exponential Backoff
- NFR13: User data isolation (userId must be validated)
