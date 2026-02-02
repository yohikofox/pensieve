# Spotify-Style Player Components

Composants de player audio inspirés de l'exemple StackOverflow, adaptés pour expo-audio.

## Source
Basé sur https://stackoverflow.com/a/56914186 par ANKIT DETROJA (CC BY-SA 4.0)

## Composants

- **Player** - Composant principal avec gestion de l'état audio
- **AlbumArt** - Affichage de l'artwork (ou icône micro par défaut)
- **TrackDetails** - Titre et artiste
- **SeekBar** - Barre de progression avec temps (utilise Slider)
- **Controls** - Boutons play/pause/skip
- **PlayerWrapper** - Wrapper pour intégration facile avec Capture

## Utilisation

### Option 1 : Dans CaptureDetailScreen

Remplacer l'AudioPlayer actuel par :

```tsx
import { PlayerWrapper } from '../../components/audio/spotify-style/PlayerWrapper';

// Dans le render, remplacer AudioPlayer par :
{isAudio && capture.rawContent && (
  <PlayerWrapper
    audioUri={capture.rawContent}
    title="Audio Capture"
    artist={formatDate(capture.createdAt)}
  />
)}
```

### Option 2 : Utilisation directe

```tsx
import { Player } from '../../components/audio/spotify-style';

const tracks = [
  {
    title: 'Ma capture audio',
    artist: 'Pensieve',
    audioUrl: 'file:///path/to/audio.m4a',
    albumArtUrl: undefined,
  },
];

<Player tracks={tracks} />
```

## Différences avec l'AudioPlayer actuel

**Avantages :**
- Design "carte" élégant comme Spotify
- Artwork visuel (placeholder avec icône micro)
- Layout centré et aéré
- Approche simple : pas d'animation prédictive, juste affichage direct de currentTime

**Points à noter :**
- Utilise `@react-native-community/slider` (réinstallé)
- Pas de boutons rewind/forward ±15s (mais skip entre tracks si plusieurs)
- Pas de support dark mode (pour l'instant)

## Test

Un screen de test est disponible :
```tsx
import { SpotifyPlayerTest } from '../../screens/__tests__/SpotifyPlayerTest';
```
