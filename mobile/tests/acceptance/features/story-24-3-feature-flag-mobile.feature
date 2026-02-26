# language: fr
# Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating

Fonctionnalité: Feature Flag System — Adaptation Mobile & UI Gating
  En tant qu'utilisateur de l'application mobile
  Je veux que l'application affiche uniquement les fonctionnalités auxquelles j'ai accès selon mes feature flags
  Afin que l'expérience soit propre et cohérente, sans onglets ou boutons inaccessibles

  # AC1 + AC3: Tab Actualités masqué quand news_tab = false
  @AC1 @AC3
  Scénario: Le tab Actualités est masqué quand news_tab est false
    Étant donné les feature flags suivants: "news_tab=false"
    Quand j'affiche la navigation par tabs
    Alors le tab "Actualités" n'est pas rendu

  @AC1 @AC3
  Scénario: Le tab Actualités est visible quand news_tab est true
    Étant donné les feature flags suivants: "news_tab=true"
    Quand j'affiche la navigation par tabs
    Alors le tab "Actualités" est rendu

  # AC1 + AC4: Tab Projets masqué quand projects_tab = false
  @AC1 @AC4
  Scénario: Le tab Projets est masqué quand projects_tab est false
    Étant donné les feature flags suivants: "projects_tab=false"
    Quand j'affiche la navigation par tabs
    Alors le tab "Projets" n'est pas rendu

  @AC1 @AC4
  Scénario: Le tab Projets est visible quand projects_tab est true
    Étant donné les feature flags suivants: "projects_tab=true"
    Quand j'affiche la navigation par tabs
    Alors le tab "Projets" est rendu

  # AC5: Boutons capture média masqués quand capture_media_buttons = false
  @AC1 @AC5
  Scénario: Les boutons capture média sont masqués quand capture_media_buttons est false
    Étant donné les feature flags suivants: "capture_media_buttons=false"
    Quand j'ouvre l'écran Capturer
    Alors les boutons "photo", "url", "document" et "clipboard" ne sont pas rendus
    Et le bouton d'enregistrement audio reste visible

  @AC1 @AC5
  Scénario: Les boutons capture média sont visibles quand capture_media_buttons est true
    Étant donné les feature flags suivants: "capture_media_buttons=true"
    Quand j'ouvre l'écran Capturer
    Alors les boutons "photo", "url", "document" et "clipboard" sont rendus

  # AC6: Comportement offline — cache expiré → toutes features false
  @AC6
  Scénario: Offline avec cache expiré — toutes les features retournent false
    Étant donné les feature flags suivants: "{}"
    Quand les feature flags sont vides (cache expiré offline)
    Alors getFeature retourne false pour "news_tab"
    Et getFeature retourne false pour "projects_tab"
    Et getFeature retourne false pour "capture_media_buttons"
    Et getFeature retourne false pour "debug_mode"

  # AC2: Double gate debug mode — préservé
  @AC2
  Scénario: Le double gate debug mode est préservé après setFeatures
    Étant donné les feature flags suivants: "debug_mode=true"
    Quand le toggle debugMode est activé par l'utilisateur
    Alors isDebugModeEnabled retourne true
    Quand les feature flags sont mis à jour avec "debug_mode=false"
    Alors isDebugModeEnabled retourne false
