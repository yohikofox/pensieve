# DevPanel - Contextual Development Tools

## 🎯 Concept

**DevPanel** est un système de debug contextuel :
- **Bouton flottant global** `🔍` accessible de n'importe quel écran
- **Onglet Logs** toujours disponible (global)
- **Onglets contextuels** ajoutés/retirés automatiquement selon l'écran actif

## 📍 Accès

**Bouton flottant** `🔍` en bas à droite - **Visible partout** (mode DEV uniquement)

## 🎨 Comportement Contextuel

### Sur CaptureScreen
Onglets disponibles : **📦 DB** | **🎙️ Queue** | **📋 Logs**

### Sur autres écrans (Home, Settings, etc.)
Onglets disponibles : **📋 Logs** (seulement)

### Quand vous naviguez
Les onglets **s'ajoutent/retirent automatiquement** selon l'écran actif !

## 🛠️ Onglets Disponibles

### 📦 DB (Captures Database Inspector)
**Contextuel** - Disponible sur **CaptureScreen uniquement**

**Fonctionnalités :**
- Liste toutes les captures en DB (audio + texte)
- Affiche les métadonnées : state, duration, syncStatus, timestamps
- Stats sync : pending/synced/total
- Playback audio directement
- Delete captures
- Simulate crash (pour tester recovery)
- Run crash recovery
- Sync manually
- Network status indicator
- Mic permission status

**Cas d'usage :**
- Vérifier qu'une capture a bien été créée
- Inspecter les métadonnées (duration, file path)
- Tester le crash recovery
- Vérifier l'état de sync offline
- Debug les permissions microphone

### 🎙️ Queue (Transcription Queue Monitor)
**Contextuel** - Disponible sur **CaptureScreen uniquement**

**Fonctionnalités :**
- **In Queue** : Nombre d'items actuellement en queue
- **Total Processed** : Compteur persistant (ne reset jamais)
- **Pending/Processing/Completed/Failed** : Stats détaillées
- **Status** : ▶️ RUNNING ou ⏸️ PAUSED
- **Liste des items** : ID, status, duration, timestamps
- **Auto-refresh** : Toutes les 100ms

**Cas d'usage :**
- Voir si captures sont bien auto-enqueued
- Vérifier l'ordre FIFO (first in, first out)
- Monitorer le traitement en temps réel
- Debug les pauses/reprises (background/foreground)
- Compter combien de transcriptions ont été faites

### 📋 Logs (Console Logs Viewer)
**Global** - Disponible **partout, tout le temps**

**Fonctionnalités :**
- Capture tous les `console.log`, `console.error`, `console.warn`
- Affiche dans l'app (pratique quand Metro disconnected)
- Filtrage par niveau (log/error/warn)
- Toggle sniffing ON/OFF
- Clear logs
- Auto-scroll to bottom

**Cas d'usage :**
- Voir les logs offline (pas de Metro)
- Chercher des erreurs spécifiques
- Monitorer le flow d'événements
- Debug en production (si activé)

## 🏗️ Architecture Technique

```
App.tsx
└── <DevPanelProvider>               ← Context global
    ├── NavigationContainer
    │   ├── CaptureScreen
    │   │   └── useDevPanel()         ← Enregistre tabs DB + Queue
    │   ├── HomeScreen
    │   │   └── (pas de tabs)         ← Uniquement Logs
    │   └── SettingsScreen
    │       └── (pas de tabs)         ← Uniquement Logs
    └── <DevPanel />                  ← Bouton flottant global
```

### Composants

**DevPanelContext.tsx** - Context Provider
- State management pour les tabs
- API: `registerTab()`, `unregisterTab()`

**DevPanel.tsx** - UI Component
- Bouton flottant global
- Modal fullscreen avec tabs
- Consume le context pour afficher les tabs

**Screens** - Register leurs tabs via `useDevPanel()`
```tsx
const CaptureScreen = () => {
  const { registerTab, unregisterTab } = useDevPanel();

  useEffect(() => {
    registerTab({
      id: 'my-tool',
      label: '🔧 Tool',
      component: <MyDebugTool />,
      priority: 100, // Optional: lower = left-most
    });

    return () => unregisterTab('my-tool');
  }, []);
};
```

## 💡 Tips

**Workflow de debug typique :**

1. **Sur n'importe quel écran** → Ouvrir DevPanel (bouton `🔍`)
2. **Tab Logs visible** → Chercher erreurs
3. **Naviguer vers CaptureScreen**
4. **Tabs DB + Queue apparaissent automatiquement** ✨
5. **Enregistrer un audio**
6. **Tab Queue** → Vérifier Total Processed incrémente
7. **Tab DB** → Vérifier capture présente
8. **Naviguer ailleurs** → Tabs DB + Queue disparaissent
9. **Tab Logs reste disponible** → Continuer à monitorer

**Performance :**
- Queue refresh rapide (100ms) pour voir items en temps réel
- DB refresh manuel (pull-to-refresh)
- Logs sniffing peut être désactivé si trop de logs

## 🚀 Ajouter vos propres outils

**Exemple** - Ajouter un onglet "Network" sur un écran :

```tsx
// MyScreen.tsx
import { useDevPanel } from '../components/dev/DevPanelContext';
import { MyNetworkDebugTool } from '../components/dev/MyNetworkDebugTool';

const MyScreen = () => {
  const { registerTab, unregisterTab } = useDevPanel();

  useEffect(() => {
    registerTab({
      id: 'network-monitor',
      label: '🌐 Network',
      component: <MyNetworkDebugTool />,
      priority: 300, // After DB (100) and Queue (200)
    });

    return () => unregisterTab('network-monitor');
  }, [registerTab, unregisterTab]);

  return <View>...</View>;
};
```

## 📝 Conventions

**Tab IDs** : kebab-case (`captures-db`, `transcription-queue`)
**Labels** : Emoji + Text (`📦 DB`, `🎙️ Queue`)
**Priority** :
- 100-199 : Data/Storage tools
- 200-299 : Processing/Queue tools
- 300-399 : Network tools
- 900-999 : System tools
- 1000+ : Logs (toujours en dernier)

## 🔮 Prochaines améliorations possibles

- [ ] Export DB as JSON
- [ ] Export logs as file
- [ ] Filter captures by type/state
- [ ] Search in logs
- [ ] Stats dashboard (graphiques)
- [ ] Network request inspector
- [ ] Redux/State inspector (si on utilise Redux)
- [ ] Tab "Sync Status" sur écran de sync
- [ ] Tab "User Profile" sur écran settings

---

**Date création** : 2026-01-24
**Dernière mise à jour** : 2026-01-24
**Story** : 2.5 - Transcription Infrastructure
**Architecture** : Contextual Dev Tools Pattern
