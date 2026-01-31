# Device Calibrations

Ce dossier contient les fichiers de calibration par device pour le framework de test mobile.

## Qu'est-ce qu'une calibration ?

Une calibration établit la **correspondance entre coordonnées** de deux systèmes:
- **Window coordinates** (React Native) - système logique utilisé dans le code
- **Pixel coordinates** (Android/iOS) - système physique du device

### Pourquoi c'est nécessaire ?

Quand on teste via MCP mobile:
- `mobile_click_on_screen_at_coordinates(x, y)` attend des **pixel coordinates**
- `mobile_list_elements_on_screen` retourne des **pixel bounds**
- Mais notre code React Native utilise des **window coordinates**

La calibration fournit le **ratio de conversion** pour traduire entre les deux.

## Format de fichier

```json
{
  "device_id": "56251FDCH00APM",
  "device_name": "Pixel 10 Pro",
  "device_type": "android",
  "screen": {
    "window_width": 411.43,     // React Native dimensions
    "window_height": 918.10,
    "pixel_width": 1080,        // Android dimensions
    "pixel_height": 2410,
    "ratio_x": 2.625,           // pixel / window
    "ratio_y": 2.625,
    "avg_ratio": 2.625
  },
  "reference_points": {
    "top_left": {
      "theoretical": {"x": 41, "y": 92},
      "detected": {"x": 41, "y": 92},
      "color": "#FF0000",
      "label": "TL",
      "inset": "10%"
    }
    // ... autres points (TR, BL, BR, C)
  },
  "conversion": {
    "pixel_to_window": {
      "formula": "window = pixel / ratio",
      "ratio": 2.625
    },
    "window_to_pixel": {
      "formula": "pixel = window * ratio",
      "ratio": 2.625
    }
  },
  "targets": {
    // Targets applicatifs à ajouter manuellement
    "captures_tab": {"x": 145, "y": 1027},
    "capturer_tab": {"x": 241, "y": 1027}
  },
  "calibrated_at": "2026-01-31T21:00:00Z",
  "calibration_method": "automatic_element_detection"
}
```

## Calibration Automatique

### Processus

1. **Afficher CalibrationGrid** dans l'app React Native (déjà intégré en dev mode)
2. **List elements** via MCP mobile → obtient labels + bounds
3. **Run script** `auto-calibrate.js` qui:
   - Parse les labels pour extraire window coords: "TL (41,92)"
   - Parse les bounds pour extraire pixel coords
   - Calcule le ratio: `pixel / window`
   - Génère le fichier JSON

### Commande

```bash
/mobile-test init-calibration
```

Ou manuellement:
```bash
node .claude/mobile-test-framework/scripts/auto-calibrate.js <device-id> <elements.json>
```

## Utilisation

### Symlink current-device.json

Pour faciliter l'usage, créer un symlink vers la calibration active:

```bash
cd pensieve/mobile/.calibrations
ln -sf 56251FDCH00APM-auto.json current-device.json
```

Les macros peuvent alors charger `current-device.json` sans connaître le device ID.

### Ajouter des Targets

Après calibration automatique, éditer le fichier pour ajouter des targets applicatifs:

```json
{
  "targets": {
    "captures_tab": {"x": 145, "y": 1027},
    "capturer_tab": {"x": 241, "y": 1027},
    "actualites_tab": {"x": 48, "y": 1027},
    "projets_tab": {"x": 338, "y": 1027},
    "reglages_tab": {"x": 434, "y": 1027},
    "voix_button": {"x": 79, "y": 361}
  }
}
```

Ces targets peuvent ensuite être utilisés dans les macros via `click_target`.

## Exemple de Conversion

Device: Pixel 10 Pro (ratio 2.625)

**Window → Pixel**:
```
Button center (window): (79, 361)
Button center (pixel):  (79 × 2.625, 361 × 2.625) = (207, 948)
```

**Pixel → Window**:
```
Element bounds (pixel): x=150, y=2000
Element position (window): (150 / 2.625, 2000 / 2.625) = (57, 762)
```

## Structure

```
.calibrations/
├── README.md                        # Ce fichier
├── current-device.json             # Symlink → calibration active
├── 56251FDCH00APM-auto.json        # Pixel 10 Pro
├── emulator-5554-auto.json         # Android Emulator
└── <device-id>-auto.json           # Autres devices
```

## Maintenance

- **Re-calibrer** si changements de résolution, orientation, ou version React Native
- **Vérifier** les reference_points pour détecter drift
- **Backup** avant modifications manuelles
- **Committer** les calibrations stables pour partage d'équipe
