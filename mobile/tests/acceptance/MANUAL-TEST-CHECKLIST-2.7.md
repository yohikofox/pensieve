# ✅ Checklist de Validation Manuelle - Story 2.7
## Guide Configuration Modèle Whisper

**Story**: Story 2-7 - Guide Configuration Modèle Whisper
**Date**: 2026-01-31
**Testeur**: ___________
**Device**: ___________
**OS Version**: ___________

---

## 🎯 Prérequis

- [ ] Application installée sur device/simulateur
- [ ] Aucun modèle Whisper téléchargé (état initial)
- [ ] Permissions microphone accordées
- [ ] Connexion internet disponible

---

## 📋 AC1-2: Check Proactif + Modal Prompt

### ✅ Test 1: Modal s'affiche sans modèle
**Étapes**:
1. Naviguer vers l'écran Capture (onglet central)
2. Taper sur le bouton de capture vocale (icône micro)

**Résultat attendu**:
- [ ] Modal "Modèle de transcription requis" s'affiche
- [ ] Message affiché: "Download a Whisper model to enable audio transcription..."
- [ ] Bouton "Go to Settings" visible
- [ ] Bouton "Continue without transcription" visible
- [ ] Icône warning/download visible

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 2: Navigation vers Settings
**Étapes**:
1. Modal affiché (depuis Test 1)
2. Taper sur "Go to Settings"

**Résultat attendu**:
- [ ] Modal se ferme
- [ ] Écran WhisperSettings s'affiche
- [ ] Liste des 5 modèles Whisper visible (tiny, base, small, medium, large-v3)

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 3: Continue sans transcription
**Étapes**:
1. Revenir à Capture (si nécessaire, réinitialiser)
2. Taper sur bouton vocal → Modal s'affiche
3. Taper sur "Continue without transcription"

**Résultat attendu**:
- [ ] Modal se ferme
- [ ] Interface d'enregistrement s'affiche (overlay rouge)
- [ ] Timer démarre (00:00, 00:01...)
- [ ] Bouton Stop visible
- [ ] Bouton Cancel visible

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 4: Enregistrement complet sans modèle
**Étapes**:
1. Depuis Test 3, enregistrer pendant 3-5 secondes
2. Appuyer sur Stop
3. Naviguer vers Captures List

**Résultat attendu**:
- [ ] Capture sauvegardée visible dans la liste
- [ ] Durée affichée correctement
- [ ] État = "captured"
- [ ] Pas de texte transcrit affiché

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 5: Pas de modal avec modèle disponible
**Prérequis**: Télécharger d'abord le modèle "tiny" (via WhisperSettings)

**Étapes**:
1. Naviguer vers Capture
2. Taper sur bouton vocal

**Résultat attendu**:
- [ ] Modal NE s'affiche PAS
- [ ] Enregistrement commence immédiatement
- [ ] Interface d'enregistrement visible directement

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📋 AC4-5: Message + Bouton dans Detail View

### ✅ Test 6: Badge "Modèle requis" dans detail
**Prérequis**:
- Supprimer le modèle "tiny" si téléchargé
- Avoir une capture audio sans transcription (depuis Test 4)

**Étapes**:
1. Ouvrir Captures List
2. Taper sur une capture audio (state=captured, pas de texte)

**Résultat attendu**:
- [ ] Badge rouge "Modèle de transcription requis" visible
- [ ] Icône alert-circle rouge
- [ ] Bouton "Télécharger un modèle" visible
- [ ] Bouton de couleur secondaire (gris/subtle)
- [ ] Icône download sur le bouton

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 7: Navigation depuis bouton "Télécharger"
**Étapes**:
1. Depuis Test 6, capture detail affichée
2. Taper sur "Télécharger un modèle"

**Résultat attendu**:
- [ ] Navigation vers WhisperSettings
- [ ] Liste des modèles visible

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 8: Status normal avec modèle disponible
**Prérequis**: Télécharger le modèle "tiny"

**Étapes**:
1. Ouvrir une capture audio (state=captured)
2. Observer les badges

**Résultat attendu**:
- [ ] Badge "En attente de transcription" (jaune/warning)
- [ ] PAS de badge rouge "Modèle requis"
- [ ] PAS de bouton "Télécharger un modèle"
- [ ] Bouton "Transcrire maintenant" visible (si auto-transcription désactivée)

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📋 AC6: Auto-Resume Transcription

### ✅ Test 9: Auto-resume après download
**Prérequis**:
- Supprimer le modèle "tiny"
- Avoir 2-3 captures audio sans transcription (créer si nécessaire)

**Étapes**:
1. Noter le nombre de captures en attente: _____
2. Aller dans WhisperSettings
3. Télécharger le modèle "tiny"
4. Attendre fin du download (barre à 100%)
5. Retourner à Captures List immédiatement

**Résultat attendu**:
- [ ] Les captures passent à "Transcription en cours" automatiquement
- [ ] Aucune action manuelle nécessaire
- [ ] Après quelques secondes, transcription complète
- [ ] Badge change pour "Transcription terminée" (vert)
- [ ] Texte transcrit visible dans le detail

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 10: Auto-resume ignore captures déjà transcrites
**Prérequis**:
- 1 capture avec transcription (state=ready)
- 2 captures sans transcription (state=captured)
- Supprimer le modèle "tiny"

**Étapes**:
1. Télécharger modèle "tiny"
2. Observer les badges

**Résultat attendu**:
- [ ] Capture déjà transcrite: Pas de changement
- [ ] Captures non transcrites: Auto-resume démarre
- [ ] Console log: "AC6: Auto-resumed 2/3 capture(s)" (ou similaire)

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📋 AC7: Badge "Pending Model" dans Liste

### ✅ Test 11: Badge "Modèle requis" dans liste
**Prérequis**:
- Supprimer le modèle "tiny"
- Avoir 2 captures audio sans transcription

**Étapes**:
1. Naviguer vers Captures List
2. Observer les badges sur les captures

**Résultat attendu**:
- [ ] Badge rouge "Modèle requis" visible sur chaque capture
- [ ] Icône alert-circle rouge
- [ ] Badge à gauche de l'écran
- [ ] PAS de badge "En attente de transcription"

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 12: Badge change quand modèle disponible
**Étapes**:
1. Depuis Test 11, observer badges actuels
2. Télécharger modèle "tiny"
3. Retourner à Captures List

**Résultat attendu**:
- [ ] Badge change de rouge → jaune/warning
- [ ] Texte change de "Modèle requis" → "En attente de transcription"
- [ ] Icône change de alert-circle → clock
- [ ] Transcription démarre automatiquement

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 13: Captures transcrites n'ont pas badge "Modèle requis"
**Prérequis**: Avoir une capture avec transcription complète

**Étapes**:
1. Naviguer vers Captures List
2. Observer les captures transcrites

**Résultat attendu**:
- [ ] Badge vert "Transcription terminée"
- [ ] PAS de badge rouge "Modèle requis"
- [ ] Texte transcrit visible en preview

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📋 Workflow Complet (AC3)

### ✅ Test 14: Workflow end-to-end
**Prérequis**: Reset complet (supprimer modèle + captures)

**Étapes**:
1. Taper bouton vocal → Modal s'affiche
2. "Continue without transcription"
3. Enregistrer 5 secondes → Stop
4. Aller à Captures List → Badge "Modèle requis"
5. Ouvrir capture → Badge + bouton "Télécharger"
6. Télécharger modèle "tiny"
7. Retourner à Liste

**Résultat attendu**:
- [ ] Étape 1: Modal affiché ✓
- [ ] Étape 2: Enregistrement commence ✓
- [ ] Étape 3: Capture sauvegardée ✓
- [ ] Étape 4: Badge rouge visible ✓
- [ ] Étape 5: Detail affiche message + bouton ✓
- [ ] Étape 6: Download OK ✓
- [ ] Étape 7: Auto-resume + transcription complète ✓

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📋 Edge Cases & Robustesse

### ✅ Test 15: Erreur network gracieuse
**Étapes**:
1. Activer mode avion
2. Tenter de capturer audio

**Résultat attendu**:
- [ ] Enregistrement fonctionne quand même
- [ ] Aucun crash
- [ ] Aucun modal d'erreur bloquant
- [ ] Capture sauvegardée localement

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

### ✅ Test 16: Badge priorité correcte
**Prérequis**: Pas de modèle, capture audio non transcrite

**Étapes**:
1. Voir Captures List
2. Observer les badges

**Résultat attendu**:
- [ ] Badge "Modèle requis" affiché (priorité haute)
- [ ] PAS de badge "En attente" en même temps
- [ ] Un seul badge par capture

**Résultat**: ☐ PASS ☐ FAIL
**Notes**: ___________________________________________

---

## 📊 Résumé Final

**Tests Passés**: ___ / 16
**Tests Échoués**: ___ / 16
**Bloquants**: ___________________________________________

**Statut Story 2.7**: ☐ VALIDÉE ☐ BESOINS CORRECTIONS

**Signature Testeur**: ___________
**Date**: ___________

---

## 📝 Bugs Trouvés

| # | Sévérité | Description | Steps to Reproduce |
|---|----------|-------------|-------------------|
| 1 |          |             |                   |
| 2 |          |             |                   |
| 3 |          |             |                   |

**Sévérité**: 🔴 Bloquant / 🟡 Majeur / 🟢 Mineur

---

## ✨ Améliorations Suggérées

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
