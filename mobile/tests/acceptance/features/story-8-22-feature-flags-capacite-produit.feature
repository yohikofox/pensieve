# language: fr
Fonctionnalité: Feature flags orientés capacité produit
  En tant qu'administrateur
  Je veux contrôler chaque capacité produit indépendamment
  Afin de faire des déploiements progressifs et granulaires

  Scénario: Aucun flag activé — comportement identique à avant la migration
    Étant donné aucune feature n'est activée pour l'utilisateur
    Quand l'utilisateur ouvre CaptureScreen
    Alors seuls les boutons "Voice" et "Text" sont affichés
    Et les boutons "URL", "Photo", "Document" et "Presse-papier" ne sont pas visibles

  Scénario: Tab Actualités contrôlée par "news"
    Étant donné la feature "news" est activée pour l'utilisateur
    Quand l'utilisateur consulte la liste des tabs
    Alors la clé de feature du tab News vaut "news"

  Scénario: Tab Projets contrôlée par "projects"
    Étant donné la feature "projects" est activée pour l'utilisateur
    Quand l'utilisateur consulte la liste des tabs
    Alors la clé de feature du tab Projects vaut "projects"

  Scénario: Activation granulaire — URL capture uniquement
    Étant donné seule la feature "url_capture" est activée
    Quand l'utilisateur ouvre CaptureScreen
    Alors le bouton "URL" est visible
    Et les boutons "Photo", "Document" et "Presse-papier" ne sont pas visibles

  Scénario: Activation granulaire — Photo et Document sans URL
    Étant donné les features "photo_capture" et "document_capture" sont activées
    Et "url_capture" et "clipboard_capture" sont désactivées
    Quand l'utilisateur ouvre CaptureScreen
    Alors les boutons "Photo" et "Document" sont visibles
    Et les boutons "URL" et "Presse-papier" ne sont pas visibles

  Scénario: Tous les flags capture média activés — hors live transcription
    Étant donné les features "url_capture", "photo_capture", "document_capture" et "clipboard_capture" sont toutes activées
    Quand l'utilisateur ouvre CaptureScreen
    Alors les boutons "Voice", "Text", "URL", "Photo", "Document" et "Presse-papier" sont tous visibles
