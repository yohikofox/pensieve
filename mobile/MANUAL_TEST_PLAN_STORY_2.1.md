# Plan de Test Manuel - Story 2.1: Capture Audio 1-Tap

**Story**: Capture Audio 1-Tap
**Plateforme**: Android (Custom Dev Client)
**Date**: 2026-01-21
**Testeur**: @yoannlorho

---

## ✅ Pré-requis

- [ ] Application installée sur Android avec custom dev client
- [ ] Base de données WatermelonDB initialisée (version 2)
- [ ] DevTools accessibles via bouton "🔍 DB"
- [ ] Réseau WiFi disponible pour tests online/offline

---

## 🧪 Tests à Exécuter

### Test 1: Permission Microphone (AC5)

**Objectif**: Vérifier la gestion des permissions microphone

#### Cas 1.0: Révoquer permission via DevTools (nouveau)
1. **Action**: Taper "🔍 DB" (DevTools)
2. **Vérification**: Observer le badge permission
   - [ ] Badge "🎤 Microphone OK" (vert) si accordée
   - [ ] Badge "🔇 Micro refusé" (rouge) si refusée
3. **Action**: Taper "⚙️ Ouvrir Paramètres"
4. **Vérification popup**:
   - [ ] Affiche statut actuel: "Permission microphone: ✅ Accordée" ou "❌ Refusée"
   - [ ] Instructions claires pour modifier
   - [ ] Boutons "Annuler" / "Ouvrir Paramètres"
5. **Action**: Taper "Ouvrir Paramètres"
6. **Résultat attendu**:
   - [ ] App Paramètres Android s'ouvre sur la page Pensieve
   - [ ] Section "Autorisations" visible
7. **Action**: Aller dans Autorisations → Microphone → Désactiver
8. **Action**: Retourner dans l'app Pensieve
9. **Action**: Pull to refresh dans DevTools
10. **Vérification**:
    - [ ] Badge passe à "🔇 Micro refusé" (rouge)

#### Cas 1.1: Permission non accordée
1. **Setup**: Utiliser Cas 1.0 pour révoquer la permission OU désinstaller/réinstaller l'app
2. **Action**: Taper "📱 Retour UI" → Taper "Capturer"
3. **Résultat attendu**:
   - [ ] Popup système demandant permission microphone
   - [ ] Message clair expliquant pourquoi la permission est nécessaire
   - [ ] Boutons "Autoriser" / "Refuser"

#### Cas 1.2: Permission refusée
1. **Action**: Refuser la permission dans la popup
2. **Action**: Re-taper "Capturer"
3. **Résultat attendu**:
   - [ ] Alert "Permission refusée"
   - [ ] Message indiquant comment activer dans Réglages
   - [ ] Enregistrement ne démarre PAS

#### Cas 1.3: Permission accordée
1. **Action**: Accorder la permission (ou dans Paramètres Android)
2. **Action**: Taper "Capturer"
3. **Résultat attendu**:
   - [ ] Enregistrement démarre immédiatement
   - [ ] Pas de popup supplémentaire

---

### Test 2: Enregistrement Audio Basique (AC1 & AC2)

**Objectif**: Vérifier le flux complet d'enregistrement

#### Cas 2.1: Enregistrement court (5-10 secondes)
1. **Action**: Taper "Capturer"
2. **Observation pendant l'enregistrement**:
   - [ ] Bouton change de couleur (bleu → rouge)
   - [ ] Texte change "Capturer" → "Arrêter"
   - [ ] Timer de durée s'affiche et s'incrémente
   - [ ] Indicateur visuel pulsant visible
   - [ ] Feedback haptique au tap (vibration légère)
3. **Action**: Parler pendant 5-10 secondes
4. **Action**: Taper "Arrêter"
5. **Résultat attendu**:
   - [ ] Alert "Capture enregistrée!"
   - [ ] Durée affichée correcte (~5-10s)
   - [ ] Message "sauvegardée localement"
   - [ ] Bouton revient à l'état initial (bleu, "Capturer")

#### Cas 2.2: Vérification en base de données
1. **Action**: Taper "🔍 DB" (bouton DevTools en bas à droite)
2. **Vérification dans DevTools**:
   - [ ] 1 capture visible dans la liste
   - [ ] Type: "audio" (badge violet)
   - [ ] État: "captured" (badge vert)
   - [ ] Sync: "pending" (badge jaune)
   - [ ] Durée affichée (ex: "5s")
   - [ ] Taille fichier affichée (ex: "500 KB")
   - [ ] Chemin fichier commence par "file://...audio/capture_"
3. **Action**: Taper "📱 Retour UI"

#### Cas 2.3: Latence démarrage < 500ms (NFR1)
1. **Préparation**: Ouvrir chronomètre sur téléphone ou avoir montre
2. **Action**: Taper "Capturer" et observer
3. **Vérification subjective**:
   - [ ] Enregistrement démarre "instantanément" (< 1 seconde perceptible)
   - [ ] Pas de lag ou délai notable
   - [ ] Réactivité fluide

---

### Test 3: Fonctionnalité Offline (AC3)

**Objectif**: Vérifier que la capture fonctionne sans réseau

#### Cas 3.1: Capture en mode avion
1. **Setup**: Activer mode avion sur Android (swipe down → icône avion)
2. **Vérification**: Badge réseau dans DevTools affiche "✈️ Offline" (rouge)
3. **Action**: Faire un enregistrement complet (5-10s)
4. **Résultat attendu**:
   - [ ] Enregistrement fonctionne normalement
   - [ ] Aucun message d'erreur
   - [ ] Alert "Capture enregistrée!" s'affiche
5. **Vérification DB**:
   - [ ] Capture présente dans DevTools
   - [ ] Sync status: "pending" (jaune) ← IMPORTANT
   - [ ] Metadata correctes (durée, taille)

#### Cas 3.2: Statistiques de synchronisation
1. **Action**: Dans DevTools, observer section "Statistiques Sync"
2. **Vérification**:
   - [ ] "En attente: X" (nombre de captures offline)
   - [ ] "Synchronisées: 0" (pas de backend encore)
   - [ ] "Total: X"

#### Cas 3.3: Retour online
1. **Action**: Désactiver mode avion
2. **Attendre** 3-5 secondes (polling du network status)
3. **Vérification**:
   - [ ] Badge réseau passe à "📶 Online" (vert) ou "📱 Online"
   - [ ] Captures restent en "pending" (backend pas implémenté encore)

---

### Test 4: Crash Recovery (AC4)

**Objectif**: Vérifier la récupération après crash/interruption

#### Cas 4.1: Simulation de crash via DevTools
1. **Action**: Taper "🔍 DB"
2. **Action**: Taper "💥 Simuler crash"
3. **Vérification DB**:
   - [ ] Nouvelle capture avec état "recording" (rouge) apparaît
   - [ ] Fichier temporaire "/temp/crash_test.m4a"
4. **Action**: Taper "📱 Retour UI"

#### Cas 4.2: Forcer fermeture de l'app
1. **Action**: Swipe up → Fermer l'app complètement (kill process)
2. **Action**: Relancer l'app
3. **Résultat attendu**:
   - [ ] Alert de récupération s'affiche automatiquement
   - [ ] Message: "🔄 Récupération après interruption"
   - [ ] Indique nombre de captures récupérées
   - [ ] Indique nombre d'échecs s'il y en a

#### Cas 4.3: Vérification post-recovery
1. **Action**: Taper "🔍 DB"
2. **Vérification**:
   - [ ] Capture précédemment en "recording" est maintenant "captured" OU "failed"
   - [ ] Si "captured": état vert, peut être lu
   - [ ] Si "failed": état orange, marqué comme non récupérable

#### Cas 4.4: Recovery manuelle (bonus)
1. **Action**: Dans DevTools, taper "🔄 Récupération crash"
2. **Résultat attendu**:
   - [ ] Alert affichant résultat
   - [ ] "✅ Aucune récupération nécessaire" OU statistiques de recovery

---

### Test 5: Enregistrements Multiples

**Objectif**: Vérifier la gestion de plusieurs captures

#### Cas 5.1: 3 enregistrements successifs
1. **Action**: Faire 3 enregistrements de 5-10s chacun
2. **Vérification après chaque**:
   - [ ] Bouton revient à "Capturer" entre chaque
   - [ ] Alert de confirmation à chaque
3. **Vérification DB finale**:
   - [ ] 3 captures visibles
   - [ ] Toutes avec état "captured"
   - [ ] Toutes avec sync "pending"
   - [ ] Fichiers différents (noms avec timestamp différent)

#### Cas 5.2: Tentative d'enregistrement pendant enregistrement
1. **Action**: Démarrer un enregistrement
2. **Action**: Pendant l'enregistrement, taper plusieurs fois sur le bouton "Arrêter"
3. **Résultat attendu**:
   - [ ] Un seul enregistrement s'arrête
   - [ ] Pas de double-stop ou erreur
   - [ ] État cohérent

---

### Test 6: Durées Variables

**Objectif**: Vérifier différentes durées d'enregistrement

#### Cas 6.1: Enregistrement très court (< 2 secondes)
1. **Action**: Taper "Capturer" puis immédiatement "Arrêter"
2. **Résultat attendu**:
   - [ ] Capture enregistrée
   - [ ] Durée ~0-1s
   - [ ] Fichier créé avec petite taille

#### Cas 6.2: Enregistrement moyen (30-60 secondes)
1. **Action**: Enregistrer pendant ~30-60 secondes
2. **Résultat attendu**:
   - [ ] Timer continue jusqu'à l'arrêt
   - [ ] Durée finale correcte (~30-60s)
   - [ ] Taille fichier ~500KB-1MB

#### Cas 6.3: Enregistrement long (2-5 minutes) - Optionnel
1. **Action**: Enregistrer pendant 2-5 minutes
2. **Observation**:
   - [ ] App reste responsive
   - [ ] Pas de freeze ou crash
   - [ ] Timer continue normalement
3. **Vérification finale**:
   - [ ] Fichier sauvegardé correctement
   - [ ] Taille ~2-5MB

---

### Test 7: Stockage et Métadonnées (Task 3)

**Objectif**: Vérifier le stockage permanent et les métadonnées

#### Cas 7.1: Vérification chemin de fichier
1. **Action**: Faire un enregistrement
2. **Vérification DevTools**:
   - [ ] Chemin fichier contient "capture_" + ID + "_" + timestamp
   - [ ] Extension ".m4a"
   - [ ] Chemin dans répertoire permanent (pas /temp/)
   - [ ] Format: `file:///data/.../audio/capture_xxx_xxx.m4a`

#### Cas 7.2: Métadonnées complètes
1. **Vérification pour chaque capture dans DevTools**:
   - [ ] Durée affichée (ex: "5s", "30s", "2m")
   - [ ] Taille fichier affichée (ex: "500 KB", "1 MB")
   - [ ] Date/heure de capture
   - [ ] ID unique visible

---

### Test 8: DevTools Interface (Bonus)

**Objectif**: Vérifier l'interface de debug

#### Cas 8.1: Navigation DevTools
1. **Action**: Taper "🔍 DB"
2. **Vérification UI**:
   - [ ] Liste des captures s'affiche
   - [ ] Scroll fonctionne si > 5 captures
   - [ ] Bouton "📱 Retour UI" visible en bas
   - [ ] Badge réseau visible en haut à droite
   - [ ] Badge permission microphone visible en haut à droite
   - [ ] Statistiques de sync affichées
   - [ ] Boutons "💥 Simuler crash" et "🔄 Récupération crash" présents
   - [ ] Bouton "⚙️ Ouvrir Paramètres" présent

#### Cas 8.2: Pull to refresh
1. **Action**: Dans DevTools, swipe down pour refresh
2. **Résultat attendu**:
   - [ ] Animation de refresh
   - [ ] Liste se recharge
   - [ ] Nouvelles captures apparaissent

#### Cas 8.3: Badges colorés et statuts
1. **Vérification des badges d'état**:
   - [ ] État "recording": rouge
   - [ ] État "captured": vert
   - [ ] État "failed": orange
   - [ ] Sync "pending": jaune
   - [ ] Sync "synced": vert
   - [ ] Type "audio": violet

2. **Vérification des badges système**:
   - [ ] Réseau "Online" (WiFi): 📶 vert
   - [ ] Réseau "Online" (Cellulaire): 📱 vert
   - [ ] Réseau "Offline": ✈️ rouge
   - [ ] Permission "Microphone OK": 🎤 vert
   - [ ] Permission "Micro refusé": 🔇 rouge

---

## 📋 Checklist Globale

### Avant les tests
- [ ] App compilée et installée
- [ ] Permissions réinitialisées (si test depuis zéro)
- [ ] Base de données vide OU migration réussie (v1 → v2)

### Pendant les tests
- [ ] Prendre notes des anomalies
- [ ] Screenshot si bug visuel
- [ ] Noter les timings perçus
- [ ] Vérifier logs console si erreur

### Après les tests
- [ ] Tous les tests passent ✅
- [ ] Aucun crash rencontré
- [ ] Pas de perte de données
- [ ] Performance satisfaisante (< 500ms perçu)

---

## 🐛 Template de Bug Report

Si un test échoue, documenter ainsi:

```
**Test échoué**: [Numéro du cas de test]
**Étapes pour reproduire**:
1. ...
2. ...

**Résultat attendu**:
...

**Résultat obtenu**:
...

**Screenshot**: [Si applicable]

**Logs console**: [Si disponible]
```

---

## ✅ Validation Finale

Une fois tous les tests passés:

- [ ] 106 tests unitaires/intégration/performance passent ✅
- [ ] Tests manuels sur device passent ✅
- [ ] Aucun bug bloquant
- [ ] Performance satisfaisante
- [ ] Ready to commit Task 4 🚀

---

**Note**: Ce plan couvre tous les AC (Acceptance Criteria) de la Story 2.1 et toutes les Tasks (1-4).
