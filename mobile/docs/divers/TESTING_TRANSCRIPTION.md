# Guide de Test - Infrastructure de Transcription (Story 2.5)

## ✅ Ce qui est implémenté (avec STUB)

L'infrastructure complète de transcription est en place et fonctionnelle, **mais utilise un stub** (fausse transcription) en attendant l'intégration Whisper.rn.

### Services actifs :
- ✅ **TranscriptionQueueService** - Queue persistante en DB (crash-proof)
- ✅ **EventBus** - Pub/sub pour événements domaine
- ✅ **TranscriptionQueueProcessor** - Auto-enqueue des captures audio
- ✅ **TranscriptionWorker** - Traitement foreground + background
- ✅ **Background Task** - Tâche expo-task-manager (15min iOS)

## 🧪 Comment tester

### 1. Démarrer l'application

```bash
npm start
```

Au démarrage, vous devriez voir dans les logs :

```
[App] Initializing transcription services...
[TranscriptionQueueProcessor] ✅ Started listening for Capture events
[TranscriptionWorker] ✅ Started foreground processing loop
[BackgroundTask] ✅ Background transcription task registered
```

### 2. Créer une capture audio

Utilisez l'app pour enregistrer un audio :
1. Appuyez sur le bouton d'enregistrement
2. Parlez quelques secondes
3. Arrêtez l'enregistrement

**Attendu dans les logs :**
```
[CaptureRepository] Published CaptureRecorded event: <capture-id>
[TranscriptionQueueProcessor] ✅ Auto-enqueued capture <capture-id> for transcription (Xs)
[TranscriptionWorker] 🎙️  Processing capture <capture-id> (Xs)
[TranscriptionWorker] ✅ Transcribed capture <capture-id>: "[STUB] This is a placeholder transcription..."
```

### 3. Tester le cycle foreground/background

#### 3a. Passer l'app en background

Appuyez sur le bouton Home de votre téléphone.

**Attendu dans les logs :**
```
[App] App backgrounding - pausing transcription worker
[TranscriptionWorker] ⏸️  Paused (app backgrounding)
```

#### 3b. Revenir en foreground

Rouvrez l'app.

**Attendu dans les logs :**
```
[App] App foregrounding - resuming transcription worker
[TranscriptionWorker] ▶️  Resumed
```

### 4. Supprimer une capture

Supprimez une capture depuis l'UI.

**Attendu dans les logs :**
```
[CaptureRepository] Published CaptureDeleted event: <capture-id>
[TranscriptionQueueProcessor] ✅ Removed deleted capture <capture-id> from queue
```

## 📊 Vérifier la queue en DB

Vous pouvez inspecter la queue directement en DB :

```sql
-- Voir les captures en attente de transcription
SELECT * FROM transcription_queue WHERE status = 'pending';

-- Voir l'état de pause
SELECT * FROM app_settings WHERE key = 'transcription_queue_paused';

-- Compter les captures en queue
SELECT COUNT(*) FROM transcription_queue;
```

## 🔍 Logs à surveiller

### Logs de succès ✅

```
[TranscriptionQueueProcessor] ✅ Auto-enqueued capture ...
[TranscriptionWorker] 🎙️  Processing capture ...
[TranscriptionWorker] ✅ Transcribed capture ...
```

### Logs d'avertissement ⚠️

```
[TranscriptionWorker] Already running, ignoring start()
[TranscriptionWorker] Cannot pause - worker is stopped
[TranscriptionQueueProcessor] Skipping text capture ... (no transcription needed)
```

### Logs d'erreur ❌

```
[TranscriptionWorker] ❌ Error processing item: ...
[TranscriptionQueueProcessor] ❌ Failed to enqueue capture ...
[BackgroundTask] ❌ Background task failed: ...
```

## 🎯 Comportements attendus

### ✅ Fonctionnement normal

1. **Audio capturé** → Auto-enqueued → Transcrit en ~100ms (stub) → "[STUB] This is a placeholder..."
2. **Texte capturé** → Ignoré (pas besoin de transcription)
3. **Queue vide** → Worker attend passivement (poll toutes les 2s)
4. **App en background** → Worker en pause + tâche background active
5. **App en foreground** → Worker reprend le traitement

### ❌ Cas d'erreur gérés

- Duplicate enqueue → Silencieusement ignoré
- Audio sans audioPath → Log error, skip
- Queue en pause → Items non traités
- Background task fail → Log error, retry au prochain cycle

## 📱 Tests manuels recommandés

### Scénario 1 : Enregistrement simple
1. ✅ Créer capture audio
2. ✅ Vérifier auto-enqueue dans logs
3. ✅ Vérifier transcription (stub) dans logs
4. ✅ Vérifier queue vide après traitement

### Scénario 2 : Multiples captures
1. ✅ Créer 3 captures audio rapidement
2. ✅ Vérifier FIFO (first-in-first-out) dans logs
3. ✅ Vérifier toutes transcrites

### Scénario 3 : Background/Foreground
1. ✅ Créer capture
2. ✅ Mettre app en background immédiatement
3. ✅ Vérifier worker pausé
4. ✅ Revenir en foreground
5. ✅ Vérifier worker reprend et traite

### Scénario 4 : Suppression capture
1. ✅ Créer capture (enqueued)
2. ✅ Supprimer capture avant transcription
3. ✅ Vérifier retrait de la queue

### Scénario 5 : Crash recovery
1. ✅ Créer capture (enqueued)
2. ✅ Tuer l'app (force quit)
3. ✅ Redémarrer l'app
4. ✅ Vérifier queue persiste en DB
5. ✅ Vérifier worker traite l'item après redémarrage

## ⚠️ Limitations actuelles (STUB)

- ❌ Pas de vraie transcription (texte factice)
- ❌ Pas de mise à jour du champ `normalizedText` dans Capture
- ❌ Pas de retry logic en cas d'échec
- ❌ Pas d'UI de progression
- ❌ Pas de détection de langue
- ❌ Pas d'optimisation Whisper

## ➡️ Prochaine étape

Une fois l'infrastructure validée, nous intégrerons **Whisper.rn** pour la transcription réelle.

---

**Tests automatisés disponibles :**
```bash
# Queue service (20 tests)
npm test -- --testPathPatterns="TranscriptionQueueService.test.ts"

# Queue processor (11 tests)
npm test -- --testPathPatterns="TranscriptionQueueProcessor.test.ts"

# Worker (14 tests)
npm test -- --testPathPatterns="TranscriptionWorker.test.ts"

# Total: 45 tests ✅
```
