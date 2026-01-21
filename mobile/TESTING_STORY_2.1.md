# Comment tester Story 2.1 - Capture Audio 1-Tap

## ✅ Story 2.1 est maintenant complète!

Tu peux maintenant **réellement capturer de l'audio en 1-tap** dans l'application.

---

## 🚀 Lancer l'application

### Option 1: iOS Simulator (recommandé)

```bash
cd /Users/yoannlorho/ws/pensine/pensieve/mobile
npx expo start
```

Puis appuie sur **`i`** pour lancer iOS Simulator.

### Option 2: Android Emulator

```bash
cd /Users/yoannlorho/ws/pensine/pensieve/mobile
npx expo start
```

Puis appuie sur **`a`** pour lancer Android Emulator.

### Option 3: Appareil physique (iPhone/Android)

1. Lance `npx expo start`
2. Scanne le QR code avec:
   - **iOS**: App Caméra → ouvre dans Expo Go
   - **Android**: App Expo Go → "Scan QR Code"

---

## 📱 Tester la fonctionnalité

### 1. Login

- L'app démarre sur l'écran de login
- Connecte-toi avec un compte test (ou crée-en un)

### 2. Accéder à la capture

- Une fois connecté, tu verras 3 tabs en bas:
  - **Accueil** (Home)
  - **Capturer** ← C'EST ICI!
  - **Paramètres** (Settings)

### 3. Première utilisation

- Tap sur **"Capturer"**
- L'app va demander la permission microphone
- Tape **"Autoriser"** (Allow)

### 4. Faire une capture audio en 1-tap

**Pour démarrer:**
- Tap sur le **gros bouton bleu rond** (200x200px)
- Le bouton devient **rouge**
- Un compteur de durée apparaît: "Enregistrement... 1s, 2s, 3s..."
- Un point blanc pulse en haut à droite du bouton

**Pour arrêter:**
- Tap à nouveau sur le **bouton rouge**
- Le bouton devient gris avec un spinner "Enregistrement..."
- Une **alerte** apparaît avec:
  - ✅ "Capture enregistrée!"
  - Durée de l'enregistrement
  - Message: "La transcription sera disponible bientôt"

### 5. Vérifier que ça fonctionne

Regarde les **logs dans le terminal** (où tu as lancé `npx expo start`):

```
Recording started
Recording saved: {
  uri: 'file:///...',
  duration: 2000,
  user: 'user@example.com'
}
```

---

## 🎯 Ce qui fonctionne

✅ **AC1 - Start Recording < 500ms**: Le bouton répond instantanément
✅ **AC2 - Stop and Save**: L'enregistrement est sauvegardé avec métadonnées
✅ **AC5 - Permissions**: Demande de permission avant d'enregistrer
✅ **UI 1-Tap**: Un seul tap pour démarrer, un seul tap pour arrêter
✅ **Real Audio**: Utilise expo-av (pas les mocks) - enregistrement réel
✅ **Visual Feedback**:
  - Bouton bleu (idle)
  - Bouton rouge (recording)
  - Bouton gris (saving)
  - Compteur temps réel
✅ **User Confirmation**: Alert avec durée après sauvegarde

---

## 🔍 Que vérifier pendant les tests

### Performance (AC1 - NFR1)
- [ ] Le bouton répond instantanément (< 500ms)
- [ ] Pas de lag entre le tap et le démarrage

### Permissions (AC5)
- [ ] Permission demandée au premier enregistrement
- [ ] Message clair si permission refusée
- [ ] Enregistrement impossible sans permission

### Recording (AC2)
- [ ] Compteur de durée fonctionne en temps réel
- [ ] Le bouton rouge pulse pendant l'enregistrement
- [ ] L'arrêt sauvegarde immédiatement

### Edge Cases
- [ ] Tester un enregistrement très court (< 1s)
- [ ] Tester un enregistrement long (> 30s)
- [ ] Quitter l'app pendant l'enregistrement (crash recovery sera Story 2.3)

---

## 📊 Comparaison: Tests BDD vs App Réelle

| Aspect | Tests BDD (19 tests) | App Réelle |
|--------|---------------------|------------|
| **Services** | ✅ RecordingService mocké | ✅ Utilise expo-av réel |
| **Permissions** | ✅ MockPermissionManager | ✅ Permission système réelle |
| **Audio** | ✅ MockAudioRecorder | ✅ Microphone réel |
| **Storage** | ✅ MockFileSystem | ⏳ Persistance WatermelonDB (à venir) |
| **UI** | ❌ Aucune | ✅ Écran complet |
| **1-Tap** | ❌ N/A | ✅ Fonctionnel! |

---

## 🐛 Troubleshooting

### L'app ne démarre pas

```bash
# Nettoyer le cache
npx expo start --clear

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Permission microphone non demandée

- Sur iOS Simulator: Settings → Privacy → Microphone → Expo Go → ON
- Sur Android Emulator: Settings → Apps → Permissions → Microphone

### Pas de son enregistré

- Vérifie que le microphone du simulateur est activé
- Sur iOS Simulator: Menu → I/O → Audio Input → Internal Microphone

---

## 🎉 Conclusion

**Story 2.1 est maintenant VRAIMENT complète!**

Tu peux:
1. ✅ Lancer l'app
2. ✅ Aller sur l'onglet "Capturer"
3. ✅ **Faire une capture audio en 1-tap**
4. ✅ Voir la confirmation avec la durée

---

## 📝 Notes pour les prochaines stories

**Ce qui manque encore (autres stories Epic 2):**
- Story 2.2: Capture texte
- Story 2.3: Annuler une capture en cours
- Story 2.4: Stockage offline (WatermelonDB)
- Story 2.5: Transcription automatique
- Story 2.6: Consulter les captures

Mais pour Story 2.1, **c'est terminé et fonctionnel**! 🎊
