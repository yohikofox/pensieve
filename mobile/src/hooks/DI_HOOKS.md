# Dependency Injection Hooks

Documentation des hooks React pour l'accès au container DI de manière idiomatique.

## Vue d'ensemble

Le système de hooks DI fournit trois niveaux d'abstraction :

1. **Hooks génériques** (`useDI`, `useOptionalDI`) - Accès direct au container
2. **Hooks de services** (`useCaptureRepository`, `useSyncService`) - Accès aux services spécifiques
3. **Hooks métier** (`useCaptureTranscription`, `useCaptureActions`) - Logique métier complète

## 1. Hooks Génériques

### `useDI<T>(token)`

Résout une dépendance **obligatoire**. Lance une erreur si non trouvée.

```typescript
import { useDI } from '@/hooks/useDI';
import { TOKENS } from '@/infrastructure/di/tokens';

function MyComponent() {
  const repository = useDI<ICaptureRepository>(TOKENS.ICaptureRepository);

  const handleSave = async () => {
    await repository.save(capture);
  };

  return <Button onPress={handleSave}>Save</Button>;
}
```

### `useOptionalDI<T>(token)`

Résout une dépendance **optionnelle**. Retourne `null` si non trouvée.

```typescript
import { useOptionalDI } from '@/hooks/useDI';

function MyComponent() {
  const syncService = useOptionalDI<ISyncService>(TOKENS.ISyncService);

  const handleSync = async () => {
    if (syncService) {
      await syncService.syncCaptures();
    } else {
      // Fallback si service pas encore implémenté
      console.log('Sync not available yet');
    }
  };

  return <Button onPress={handleSync}>Sync</Button>;
}
```

### `useIsDIRegistered<T>(token)`

Vérifie si une dépendance est enregistrée.

```typescript
function MyComponent() {
  const hasSyncService = useIsDIRegistered(TOKENS.ISyncService);

  return (
    <View>
      {hasSyncService ? (
        <SyncButton />
      ) : (
        <Text>Sync coming in Epic 6</Text>
      )}
    </View>
  );
}
```

### `useDIWithFallback<T>(token, fallback)`

Résout une dépendance avec valeur par défaut.

```typescript
function MyComponent() {
  const config = useDIWithFallback(TOKENS.IAppConfig, defaultConfig);

  return <Text>{config.appName}</Text>;
}
```

## 2. Hooks de Services

Accès direct aux services couramment utilisés, sans avoir à passer par les tokens.

### `useCaptureRepository()`

```typescript
import { useCaptureRepository } from '@/hooks/useServices';

function CaptureEditor() {
  const repository = useCaptureRepository();

  const handleSave = async (capture: Capture) => {
    await repository.save(capture);
  };

  return <Button onPress={handleSave}>Save</Button>;
}
```

### `useTranscriptionQueue()`

```typescript
import { useTranscriptionQueue } from '@/hooks/useServices';

function TranscribeButton({ capture }: { capture: Capture }) {
  const queueService = useTranscriptionQueue();

  const handleTranscribe = async () => {
    await queueService.enqueue({
      captureId: capture.id,
      audioPath: capture.rawContent,
      audioDuration: capture.duration,
    });
  };

  return <Button onPress={handleTranscribe}>Transcribe</Button>;
}
```

### `useTranscriptionModel()`

```typescript
import { useTranscriptionModel } from '@/hooks/useServices';

function ModelStatus() {
  const modelService = useTranscriptionModel();
  const [hasModel, setHasModel] = useState(false);

  useEffect(() => {
    const checkModel = async () => {
      const model = await modelService.getBestAvailableModel();
      setHasModel(model !== null);
    };
    checkModel();
  }, [modelService]);

  return <Text>{hasModel ? '✓ Model ready' : '⚠ No model'}</Text>;
}
```

### `useTranscriptionEngine()`

```typescript
import { useTranscriptionEngine } from '@/hooks/useServices';

function EngineSelector() {
  const engineService = useTranscriptionEngine();
  const [engine, setEngine] = useState<string>('whisper');

  useEffect(() => {
    const loadEngine = async () => {
      const selected = await engineService.getSelectedEngineType();
      setEngine(selected);
    };
    loadEngine();
  }, [engineService]);

  return <Text>Using: {engine}</Text>;
}
```

### `useSyncService()`

Service optionnel (Epic 6).

```typescript
import { useSyncService } from '@/hooks/useServices';

function SyncButton() {
  const syncService = useSyncService();

  if (!syncService) {
    return <Text>Sync coming soon</Text>;
  }

  const handleSync = async () => {
    await syncService.syncCaptures();
  };

  return <Button onPress={handleSync}>Sync Now</Button>;
}
```

## 3. Hooks Métier (High-Level)

Encapsulent la logique métier complète.

### `useCaptureAudioPlayer()`

Gère tout le cycle de vie de lecture audio.

```typescript
import { useCaptureAudioPlayer } from '@/hooks';

function AudioPlayer({ capture }: { capture: Capture }) {
  const {
    playingCaptureId,
    playerStatus,
    handlePlayPause,
    handleStop,
  } = useCaptureAudioPlayer();

  const isPlaying = playingCaptureId === capture.id && playerStatus.playing;

  return (
    <View>
      <Button onPress={() => handlePlayPause(capture)}>
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      {isPlaying && (
        <Button onPress={() => handleStop(capture)}>Stop</Button>
      )}
    </View>
  );
}
```

### `useCaptureTranscription()`

Gère la transcription avec vérification de modèle et retry.

```typescript
import { useCaptureTranscription } from '@/hooks';

function TranscriptionManager({ capture }: { capture: Capture }) {
  const {
    hasModelAvailable,
    handleTranscribe,
    handleRetry,
  } = useCaptureTranscription();

  const handleTranscribeClick = () => {
    handleTranscribe(capture, () => {
      alert('Please download a model first');
    });
  };

  return (
    <View>
      {hasModelAvailable === false && (
        <Text>⚠ Model required</Text>
      )}
      {capture.state === 'captured' && (
        <Button onPress={handleTranscribeClick}>Transcribe</Button>
      )}
      {capture.state === 'failed' && (
        <Button onPress={() => handleRetry(capture)}>Retry</Button>
      )}
    </View>
  );
}
```

### `useCaptureActions()`

Actions CRUD sur les captures.

```typescript
import { useCaptureActions } from '@/hooks';

function CaptureActions({ capture }: { capture: Capture }) {
  const { handleDelete, handleShare, handlePin } = useCaptureActions();

  return (
    <View>
      <Button onPress={() => handleShare(capture)}>Share</Button>
      <Button onPress={() => handlePin(capture)}>Pin</Button>
      <Button onPress={() => handleDelete(capture.id)}>Delete</Button>
    </View>
  );
}
```

### `useDialogState()`

Gère l'état des dialogs.

```typescript
import { useDialogState } from '@/hooks';

function MyScreen() {
  const dialogs = useDialogState();

  return (
    <View>
      <Button onPress={dialogs.modelDialog.open}>
        Show Model Dialog
      </Button>

      <AlertDialog
        visible={dialogs.modelDialog.visible}
        onClose={dialogs.modelDialog.close}
        title="Download Model"
        message="Please download a transcription model"
      />
    </View>
  );
}
```

## Bonnes Pratiques

### ✅ À FAIRE

```typescript
// 1. Utiliser les hooks de services pour les dépendances courantes
const repository = useCaptureRepository();
const queueService = useTranscriptionQueue();

// 2. Utiliser les hooks métier pour la logique complète
const { handleTranscribe, hasModelAvailable } = useCaptureTranscription();

// 3. Utiliser useOptionalDI pour les services optionnels
const syncService = useOptionalDI<ISyncService>(TOKENS.ISyncService);

// 4. Memoizer les services dans les hooks personnalisés
const service = useMemo(() => new MyService(), []);
```

### ❌ À ÉVITER

```typescript
// 1. N'utilisez PAS container.resolve directement dans les composants
import { container } from 'tsyringe';
const service = container.resolve(MyService); // ❌ Mauvais

// 2. N'utilisez PAS try/catch pour les services optionnels
try {
  const service = container.resolve(MyService);
} catch {} // ❌ Mauvais - utilisez useOptionalDI

// 3. Ne résolvez PAS les services dans le render
function MyComponent() {
  const service = useDI(TOKENS.MyService); // ❌ Mauvais si fait plusieurs fois
  const service2 = useDI(TOKENS.MyService); // Résolution dupliquée
}

// ✅ Bon - résoudre une fois
function MyComponent() {
  const service = useDI(TOKENS.MyService);
  // Réutiliser service partout
}
```

## Tests

Les hooks DI facilitent les tests en permettant de mocker facilement les dépendances.

```typescript
import { renderHook } from '@testing-library/react-hooks';
import * as DIModule from '@/hooks/useDI';

describe('MyComponent', () => {
  it('should use repository', () => {
    const mockRepository = {
      save: jest.fn(),
      delete: jest.fn(),
    };

    jest.spyOn(DIModule, 'useDI').mockReturnValue(mockRepository);

    const { result } = renderHook(() => useCaptureActions());

    expect(result.current.handleDelete).toBeDefined();
  });
});
```

## Architecture

```
┌─────────────────────────────────────┐
│         Composants React            │
│  (CapturesListScreen, CaptureCard)  │
└──────────────┬──────────────────────┘
               │
               │ utilisent
               ▼
┌─────────────────────────────────────┐
│        Hooks Métier (Level 3)       │
│  useCaptureTranscription,           │
│  useCaptureActions, etc.            │
└──────────────┬──────────────────────┘
               │
               │ utilisent
               ▼
┌─────────────────────────────────────┐
│      Hooks Services (Level 2)       │
│  useCaptureRepository,              │
│  useTranscriptionQueue, etc.        │
└──────────────┬──────────────────────┘
               │
               │ utilisent
               ▼
┌─────────────────────────────────────┐
│      Hooks Génériques (Level 1)     │
│  useDI, useOptionalDI               │
└──────────────┬──────────────────────┘
               │
               │ utilisent
               ▼
┌─────────────────────────────────────┐
│         Container Helper            │
│  DI.resolve, DI.resolveOptional     │
└──────────────┬──────────────────────┘
               │
               │ encapsule
               ▼
┌─────────────────────────────────────┐
│          tsyringe Container         │
└─────────────────────────────────────┘
```
