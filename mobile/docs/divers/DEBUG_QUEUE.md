# Debug Transcription Queue - Guide Rapide

## 🚀 Option 1: Voir la queue dans les logs (PLUS SIMPLE)

Ajoutez cette fonction dans n'importe quel fichier et appelez-la:

```typescript
import { database } from './src/database';

function debugQueue() {
  const db = database.getDatabase();

  console.log('\n=== TRANSCRIPTION QUEUE ===');

  // Items en queue
  const itemsResult = db.executeSync(
    `SELECT
      id,
      capture_id,
      status,
      audio_duration,
      created_at
     FROM transcription_queue
     ORDER BY created_at ASC`
  );
  const items = itemsResult.rows || [];

  console.log('Items:', items);

  // Stats
  const statsResult = db.executeSync(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM transcription_queue`
  );
  const stats = statsResult.rows?.[0];

  console.log('Stats:', stats);

  // État de pause
  const pauseResult = db.executeSync(
    `SELECT value FROM app_settings WHERE key = 'transcription_queue_paused'`
  );
  const pauseState = pauseResult.rows?.[0];
  console.log('Paused:', pauseState?.value === '1');

  console.log('===========================\n');
}

// Appelez-la quand vous voulez voir l'état:
debugQueue();
```

## 🎨 Option 2: UI de Debug (VISUEL)

Ajoutez le composant `TranscriptionQueueDebug` à votre écran:

```typescript
// Dans src/screens/CaptureScreen.tsx
import { TranscriptionQueueDebug } from '../components/dev/TranscriptionQueueDebug';

export function CaptureScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Debug UI - affiche la queue en temps réel */}
      {__DEV__ && <TranscriptionQueueDebug />}

      {/* Votre UI normale */}
      <Text>Ma capture screen...</Text>
    </View>
  );
}
```

**Features:**
- ✅ Affichage en temps réel (refresh 1s)
- ✅ Stats: pending/processing/completed/failed
- ✅ Liste des items avec détails
- ✅ Status pause/running
- ✅ Collapsible (clic pour réduire/agrandir)

## 📊 Option 3: Requêtes SQL directes

Si vous avez accès à la DB via un outil externe:

```sql
-- Voir tous les items en queue
SELECT * FROM transcription_queue ORDER BY created_at ASC;

-- Stats rapides
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM transcription_queue;

-- État de pause
SELECT value FROM app_settings WHERE key = 'transcription_queue_paused';

-- Voir les captures avec leur statut de transcription
SELECT
  c.id,
  c.type,
  c.normalized_text,
  tq.status as transcription_status,
  tq.created_at as queued_at
FROM captures c
LEFT JOIN transcription_queue tq ON c.id = tq.capture_id
WHERE c.type = 'audio'
ORDER BY c.created_at DESC;
```

## 🔍 Comment vérifier si le background task fonctionne?

Le background task ne s'exécute que quand:
1. L'app est en background (bouton Home)
2. iOS le déclenche (max toutes les 15 min)
3. Il y a des items pending en queue

**Pour tester:**
1. Créez 2-3 captures audio
2. Vérifiez qu'elles sont en queue: `debugQueue()`
3. Mettez l'app en background (Home)
4. Attendez 1-2 minutes
5. Rouvrez l'app
6. Vérifiez les logs pour voir:
   ```
   [BackgroundTask] 🔙 Starting background transcription task
   [BackgroundTask] ✅ Successfully processed one item
   ```

**Note:** Le background task NE FONCTIONNERA PAS tant que vous n'aurez pas rebuild l'app avec:
```bash
npx expo prebuild --clean
npm run ios  # ou android
```

## 🎯 Ce que vous devez voir actuellement

**Avec foreground worker (déjà actif):**
```
[CaptureRepository] Published CaptureRecorded event: <id>
[TranscriptionQueueProcessor] ✅ Auto-enqueued capture <id>
[TranscriptionWorker] 🎙️  Processing capture <id>
[TranscriptionWorker] ✅ Transcribed capture <id>: "[STUB]..."
```

**Quand l'app passe en background:**
```
[App] App backgrounding - pausing transcription worker
[TranscriptionWorker] ⏸️  Paused (app backgrounding)
```

**Quand l'app revient en foreground:**
```
[App] App foregrounding - resuming transcription worker
[TranscriptionWorker] ▶️  Resumed
```

## 💡 Tips

1. **Voir la queue en continu:** Utilisez `TranscriptionQueueDebug` UI component
2. **Voir les logs détaillés:** Cherchez `[TranscriptionWorker]` dans Metro
3. **Inspecter la DB:** Utilisez les requêtes SQL ci-dessus
4. **Tester le cycle complet:** Suivez les scénarios dans `TESTING_TRANSCRIPTION.md`
