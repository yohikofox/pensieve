# Test Macros

Ce dossier contient les macros de test pour l'application mobile Pensieve.

## Structure

```
.macros/
├── navigate-to-captures.json
├── click-voix-button.json
├── example-macro.json          # Template de macro
└── README.md                   # Ce fichier
```

## Format de macro

```json
{
  "name": "macro-name",
  "description": "What this macro does",
  "dependencies": [
    "other-macro-name"
  ],
  "steps": [
    {
      "action": "detect_element",
      "label": "ElementLabel",
      "description": "Find element by label"
    },
    {
      "action": "click_center",
      "description": "Click center of detected element"
    },
    {
      "action": "wait",
      "duration": 500
    },
    {
      "action": "screenshot",
      "description": "Verify result"
    }
  ]
}
```

## Système de dépendances

Les macros peuvent dépendre d'autres macros pour composer des comportements complexes.

### Exemple

**Macro de base** (navigation) :
```json
{
  "name": "navigate-to-capturer",
  "dependencies": [],
  "steps": [
    {"action": "click_target", "target": "capturer_tab"},
    {"action": "wait", "duration": 500}
  ]
}
```

**Macro dépendante** (utilise la navigation) :
```json
{
  "name": "start-recording",
  "dependencies": ["navigate-to-capturer"],
  "steps": [
    {"action": "detect_element", "label": "Voix"},
    {"action": "click_center"}
  ]
}
```

### Exécution

Quand on exécute `start-recording` :
1. Le système vérifie les dépendances
2. Exécute `navigate-to-capturer` d'abord
3. Puis exécute les steps de `start-recording`

### Avantages

- ✅ **Réutilisabilité** : Navigation définie une seule fois
- ✅ **Composition** : Construire des macros complexes depuis des simples
- ✅ **Maintenance** : Modifier la navigation une fois, tout bénéficie
- ✅ **Sécurité** : Préconditions garanties via dépendances

### Dépendances récursives

Les dépendances peuvent avoir leurs propres dépendances :
```
macro-c (depends on macro-b)
  → macro-b (depends on macro-a)
    → macro-a (no dependencies)
```

Exécution : `a` → `b` → `c`

## Actions disponibles

### detect_element
Trouve un élément par son label dans la hiérarchie.
```json
{"action": "detect_element", "label": "Voix"}
```

### click_center
Clique au centre de l'élément détecté précédemment.
```json
{"action": "click_center"}
```

### click_coords
Clique à des coordonnées spécifiques (window).
```json
{"action": "click_coords", "x": 79, "y": 361}
```

### click_target
Clique sur un target nommé depuis la calibration.
```json
{"action": "click_target", "target": "captures_tab"}
```

### swipe
Effectue un swipe dans une direction.
```json
{"action": "swipe", "direction": "right", "distance": 200}
```

### type
Tape du texte.
```json
{"action": "type", "text": "Hello", "submit": false}
```

### wait
Attend un délai.
```json
{"action": "wait", "duration": 500}
```

### screenshot
Prend un screenshot de vérification.
```json
{"action": "screenshot", "description": "Verify screen"}
```

### press_button
Appuie sur un bouton système.
```json
{"action": "press_button", "button": "BACK"}
```

## Utilisation

Avec le skill `/mobile-test` :

```bash
# Créer une macro (interactif)
/mobile-test create-macro my-test

# Éditer une macro
/mobile-test edit-macro my-test

# Exécuter une macro
/mobile-test run-macro my-test

# Lister les macros
/mobile-test list
```

## Exemples

### Navigate to Captures
```json
{
  "name": "navigate-to-captures",
  "description": "Navigate to Captures tab from any screen",
  "steps": [
    {"action": "click_target", "target": "captures_tab"},
    {"action": "wait", "duration": 500},
    {"action": "screenshot", "description": "Verify on Captures screen"}
  ]
}
```

### Click Voix Button
```json
{
  "name": "click-voix-button",
  "description": "Click Voix button in Capturer screen",
  "steps": [
    {"action": "detect_element", "label": "Voix"},
    {"action": "click_center"},
    {"action": "wait", "duration": 500}
  ]
}
```

---

**Note** : Les macros sont gitignorées par défaut. Committez les exemples utiles avec le préfixe `example-`.
