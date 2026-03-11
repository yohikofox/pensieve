# Reproduction : capture bloquée en transcription

## Contexte du bug

Une capture peut rester bloquée indéfiniment dans l'état `processing` si le moteur de
transcription natif (`ExpoSpeechRecognitionModule`) ne déclenche jamais l'événement `end`.

Symptôme visible : le spinner "En cours" tourne sans fin sur une capture.
À chaque kill/relance de l'app, `resetStuckItems()` remet l'item en `pending`, le worker
le reprend immédiatement → même blocage → boucle infinie.

**Fix implémenté (migration v29)** : compteur `reset_count` sur `transcription_queue`.
Après 3 resets sans succès, la capture est marquée `stuck` (nouveau state).

---

## Prérequis

- App dev (`com.pensine.app.dev`) lancée sur le device
- Accès à **Settings → Console SQL**
- Mac connecté au même réseau que le homelab (`10.0.0.12`)
- `adb` et `mc` (MinIO client) installés sur le Mac

---

## Procédure avec le vrai audio de prod (recommandée)

### Étape 1 — Identifier la capture bloquée dans le backend

```bash
PGPASSWORD="your-secure-postgres-password-here" psql \
  -h 10.0.0.12 -p 5432 -U pensine -d pensine \
  -c "SELECT c.id, c.\"clientId\", c.\"rawContent\", c.duration, c.\"fileSize\"
      FROM captures c
      WHERE c.\"stateId\" = 'b0000000-0000-7000-8000-000000000004'
      ORDER BY c.created_at DESC LIMIT 10;"
```

**Capture identifiée lors du premier incident :**
- `id` backend : `019cdc95-473d-768f-870e-91e15c3b023d`
- `clientId` (= ID local mobile) : `54a0e5f8-3b4c-4b59-876d-a23ed2d40d29`
- `rawContent` (chemin MinIO) : `audio/019c8c15-2222-75b8-ae35-892e0da08262/54a0e5f8-3b4c-4b59-876d-a23ed2d40d29.m4a`
- Durée : 7 secondes — Taille : 123 959 octets

### Étape 2 — Télécharger l'audio depuis MinIO

```bash
# Configurer mc (MinIO client) — à faire une seule fois
mc alias set pensine-homelab http://10.0.0.12:9002 minioadmin "your-secure-minio-password-here"

# Télécharger le fichier
mc cp "pensine-homelab/pensine-audios/audio/019c8c15-2222-75b8-ae35-892e0da08262/54a0e5f8-3b4c-4b59-876d-a23ed2d40d29.m4a" \
   /tmp/stuck_audio.m4a
```

### Étape 3 — Copier l'audio dans la dev app via ADB

```bash
# Pousser vers /data/local/tmp (accessible par run-as)
adb push /tmp/stuck_audio.m4a /data/local/tmp/stuck_audio.m4a
adb shell chmod 644 /data/local/tmp/stuck_audio.m4a

# Copier dans le répertoire privé de la dev app
adb shell run-as com.pensine.app.dev mkdir files/captures
adb shell run-as com.pensine.app.dev \
  cp /data/local/tmp/stuck_audio.m4a files/captures/stuck_audio.m4a

# Vérifier
adb shell run-as com.pensine.app.dev ls -la files/captures/stuck_audio.m4a
# → /data/user/0/com.pensine.app.dev/files/captures/stuck_audio.m4a
```

> L'audio est déjà en place sur le device depuis la première exécution de cette procédure.

### Étape 4 — Injecter la capture et la queue via Console SQL

Dans **Settings → Console SQL** de la dev app :

```sql
-- 1. Capture en état processing avec le vrai audio
INSERT INTO captures (
  id, type, state, raw_content, duration, file_size,
  created_at, updated_at, sync_version, _changed, _status
) VALUES (
  '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29',
  'audio',
  'processing',
  '/data/user/0/com.pensine.app.dev/files/captures/stuck_audio.m4a',
  7000,
  123959,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000,
  0, 0, 'active'
);

-- 2. Item de queue correspondant
INSERT INTO transcription_queue (
  id, capture_id, audio_path, status, retry_count, reset_count, created_at, updated_at
) VALUES (
  'queue-' || lower(hex(randomblob(8))),
  '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29',
  '/data/user/0/com.pensine.app.dev/files/captures/stuck_audio.m4a',
  'processing',
  0,
  0,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
);
```

### Étape 5 — Observer le comportement

Kill l'app et relance pour déclencher `resetStuckItems()` :

- **Relance 1** : `reset_count` → 1, item remis en `pending`, capture → `captured`, worker retente
- **Relance 2** : `reset_count` → 2, même comportement
- **Relance 3** : `reset_count >= 3` → item marqué `failed`, capture marquée `stuck`

---

## Accélération : sauter au 3ème reset directement

Pour ne pas faire 3 kill/relances, simuler 2 resets déjà passés :

```sql
UPDATE transcription_queue SET reset_count = 2, status = 'processing'
WHERE capture_id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';

UPDATE captures SET state = 'processing'
WHERE id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';
```

Puis un seul kill/relance → marquage `stuck` immédiat.

---

## Vérification du résultat attendu

```sql
SELECT id, state FROM captures
WHERE id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';
-- → state = 'stuck'

SELECT status, reset_count, last_error FROM transcription_queue
WHERE capture_id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';
-- → status = 'failed'
-- → reset_count = 3
-- → last_error = 'Permanently stuck: transcription engine never completed after 3 resets'
```

**Settings → File de transcription** : l'item doit apparaître avec statut `Échoué`
et les compteurs `Tentatives : 0 · Resets : 3`.

---

## Test du kill manuel (forceAbortCapture)

Remettre en `processing` pour avoir le bouton "Annuler" disponible :

```sql
UPDATE transcription_queue
SET status = 'processing', reset_count = 0
WHERE capture_id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';

UPDATE captures SET state = 'processing'
WHERE id = '54a0e5f8-3b4c-4b59-876d-a23ed2d40d29';
```

Puis **Settings → File de transcription** → bouton "Annuler".

Résultat attendu :
```
captures.state = 'stuck'
transcription_queue.status = 'failed'
transcription_queue.last_error = 'Manually aborted by user'
```

---

## Procédure alternative (sans audio réel)

Si le homelab n'est pas accessible, remplacer l'audio par un faux chemin.
Le comportement de blocage sera identique (fichier inexistant → moteur natif ne répond jamais).

```sql
INSERT INTO captures (id, type, state, raw_content, duration, file_size,
  created_at, updated_at, sync_version, _changed, _status)
VALUES ('test-stuck-capture-001', 'audio', 'processing', '/fake/path/audio.m4a',
  7000, 123959, strftime('%s','now') * 1000, strftime('%s','now') * 1000, 0, 0, 'active');

INSERT INTO transcription_queue (id, capture_id, audio_path, status, retry_count, reset_count, created_at, updated_at)
VALUES ('test-queue-item-001', 'test-stuck-capture-001', '/fake/path/audio.m4a',
  'processing', 0, 0, strftime('%s','now') * 1000, strftime('%s','now') * 1000);
```

---

## Nettoyage après test

```sql
DELETE FROM transcription_queue
WHERE capture_id IN ('54a0e5f8-3b4c-4b59-876d-a23ed2d40d29', 'test-stuck-capture-001');

DELETE FROM captures
WHERE id IN ('54a0e5f8-3b4c-4b59-876d-a23ed2d40d29', 'test-stuck-capture-001');
```
