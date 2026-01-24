# language: fr
@story-2.2 @epic-2
Fonctionnalité: Capture Texte Rapide
  En tant qu'utilisateur de Pensieve
  Je veux capturer mes pensées textuelles rapidement
  Afin de sauvegarder mes idées qui conviennent mieux au clavier qu'à la voix

  # ============================================================================
  # AC1: Open Text Input Field Immediately
  # ============================================================================

  @AC1 @performance @UX
  Scénario: Ouvrir le champ texte immédiatement
    Étant donné que l'utilisateur "user-123" est sur l'écran principal
    Quand l'utilisateur tape sur le bouton de capture texte
    Alors le champ texte apparaît en moins de 300ms
    Et le clavier s'ouvre automatiquement
    Et le curseur est focalisé dans le champ texte

  @AC1 @keyboard
  Scénario: Auto-focus du clavier
    Quand l'utilisateur ouvre la capture texte
    Alors le clavier virtuel s'affiche immédiatement
    Et l'utilisateur peut commencer à taper sans action supplémentaire

  @AC1 @multiline
  Scénario: Supporter le texte multi-lignes
    Quand l'utilisateur tape du texte avec des retours à la ligne
    Alors le champ texte s'agrandit pour afficher plusieurs lignes
    Et le texte reste lisible sans défilement horizontal

  # ============================================================================
  # AC2: Save Text Capture with Metadata
  # ============================================================================

  @AC2 @data-driven
  Plan du scénario: Sauvegarder différentes longueurs de texte
    Quand l'utilisateur tape "<texte>" dans le champ
    Et l'utilisateur tape sur le bouton sauvegarder
    Alors une Capture est créée avec:
      | champ        | valeur                  |
      | type         | TEXT                    |
      | state        | CAPTURED                |
    Et la capture est dans la queue de synchronisation
    Et le rawContent contient "<texte>"
    Et le normalizedText est égal au rawContent
    Et le champ texte est vidé pour la prochaine capture

    Exemples:
      | texte                                          |
      | Idée courte                                    |
      | Une idée un peu plus longue avec des détails   |
      | Un paragraphe complet avec plusieurs phrases. Cela peut contenir des retours à la ligne et de la ponctuation complexe : virgules, points-virgules ; et même des émojis 🚀 |
      | 42                                             |

  @AC2 @metadata
  Scénario: Stocker les métadonnées complètes
    Quand l'utilisateur crée une capture texte "Ma pensée importante"
    Et l'utilisateur sauvegarde la capture
    Alors la Capture contient les métadonnées:
      | champ         | type     | contrainte  |
      | type          | string   | TEXT        |
      | rawContent    | string   | non vide    |
      | normalizedText| string   | non vide    |
      | capturedAt    | datetime | aujourd'hui |
      | state         | string   | CAPTURED    |
    Et la capture est dans la queue de synchronisation

  @AC2 @clear-input
  Scénario: Vider le champ après sauvegarde
    Étant donné que l'utilisateur a tapé "Première pensée"
    Quand l'utilisateur sauvegarde la capture
    Alors le champ texte est vide
    Et le curseur reste focalisé dans le champ
    Et l'utilisateur peut immédiatement taper une nouvelle pensée

  # ============================================================================
  # AC3: Cancel Unsaved Text with Confirmation
  # ============================================================================

  @AC3 @confirmation
  Scénario: Demander confirmation avant de supprimer du texte non sauvegardé
    Étant donné que l'utilisateur a tapé "Texte non sauvegardé"
    Quand l'utilisateur tape sur annuler
    Alors un dialog de confirmation s'affiche avec le message "Discard unsaved text?"
    Et les options "Discard" et "Keep Editing" sont disponibles

  @AC3 @discard
  Scénario: Supprimer le texte si l'utilisateur confirme
    Étant donné que l'utilisateur a tapé "Texte à supprimer"
    Et l'utilisateur tape sur annuler
    Et le dialog de confirmation s'affiche
    Quand l'utilisateur confirme "Discard"
    Alors le texte est supprimé
    Et aucune Capture n'est créée
    Et l'écran de capture texte se ferme

  @AC3 @keep-editing
  Scénario: Continuer l'édition si l'utilisateur annule la suppression
    Étant donné que l'utilisateur a tapé "Texte à conserver"
    Et l'utilisateur tape sur annuler
    Et le dialog de confirmation s'affiche
    Quand l'utilisateur choisit "Keep Editing"
    Alors le texte reste dans le champ
    Et le curseur reste focalisé
    Et l'utilisateur peut continuer à éditer

  @AC3 @no-confirmation
  Scénario: Pas de confirmation si le champ est vide
    Étant donné que le champ texte est vide
    Quand l'utilisateur tape sur annuler
    Alors aucun dialog de confirmation n'est affiché
    Et l'écran de capture texte se ferme immédiatement

  # ============================================================================
  # AC4: Offline Text Capture Functionality
  # ============================================================================

  @AC4 @offline @NFR7
  Scénario: Capturer du texte en mode hors ligne
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée une capture texte "Pensée offline"
    Et l'utilisateur sauvegarde la capture
    Alors la capture fonctionne de manière identique au mode en ligne
    Et la capture est dans la queue de synchronisation
    Et aucune erreur réseau n'est levée

  @AC4 @sync-queue
  Scénario: Ajouter à la queue de synchronisation
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée 3 captures texte
    Alors les 3 captures sont dans la queue de synchronisation
    Et elles seront synchronisées quand le réseau reviendra

  @AC4 @mixed-types
  Scénario: Capturer texte et audio en mode offline
    Étant donné que l'appareil est hors ligne
    Quand l'utilisateur crée 2 captures audio
    Et l'utilisateur crée 3 captures texte
    Alors les 5 captures sont dans la queue de synchronisation
    Et elles sont triées par capturedAt dans la queue de sync

  # ============================================================================
  # AC5: Empty Text Validation
  # ============================================================================

  @AC5 @validation
  Scénario: Valider le texte vide
    Étant donné que le champ texte est vide
    Quand l'utilisateur tape sur sauvegarder
    Alors un message d'erreur "Please enter some text" s'affiche
    Et aucune Capture n'est créée
    Et le champ reste focalisé

  @AC5 @whitespace
  Plan du scénario: Rejeter le texte contenant uniquement des espaces
    Étant donné que l'utilisateur tape "<texte_invalide>"
    Quand l'utilisateur tape sur sauvegarder
    Alors un message d'erreur "Please enter some text" s'affiche
    Et aucune Capture n'est créée

    Exemples:
      | texte_invalide |
      |                |
      |      |
      | 	 |
      |
  |

  @AC5 @button-disabled
  Scénario: Désactiver le bouton sauvegarder quand le texte est vide
    Étant donné que le champ texte est vide
    Alors le bouton "Sauvegarder" est désactivé
    Et l'utilisateur ne peut pas taper sur le bouton

  @AC5 @enable-on-input
  Scénario: Activer le bouton quand l'utilisateur tape du texte
    Étant donné que le champ texte est vide
    Et le bouton "Sauvegarder" est désactivé
    Quand l'utilisateur tape "Texte"
    Alors le bouton "Sauvegarder" est activé

  @AC5 @re-disable
  Scénario: Re-désactiver si le texte est supprimé
    Étant donné que l'utilisateur a tapé "Texte"
    Et le bouton "Sauvegarder" est activé
    Quand l'utilisateur supprime tout le texte
    Alors le bouton "Sauvegarder" est désactivé

  # ============================================================================
  # AC6: Haptic Feedback on Save
  # ============================================================================

  @AC6 @haptics @UX
  Scénario: Déclencher le retour haptique au succès
    Quand l'utilisateur crée une capture texte "Test haptic"
    Et l'utilisateur sauvegarde la capture
    Alors un feedback haptique subtil est déclenché
    Et une animation de sauvegarde s'affiche

  @AC6 @animation
  Scénario: Afficher l'animation de sauvegarde
    Quand l'utilisateur sauvegarde une capture texte
    Alors une animation montre la capture ajoutée au fil
    Et l'animation dure moins de 500ms
    Et l'animation disparaît après affichage

  @AC6 @confirmation-toast
  Scénario: Afficher une confirmation visuelle
    Quand l'utilisateur sauvegarde une capture texte
    Alors un toast "Saved" s'affiche brièvement
    Et le toast disparaît automatiquement après 2 secondes

  # ============================================================================
  # Edge Cases & Bug Prevention
  # ============================================================================

  @edge-case @character-limit
  Plan du scénario: Gérer les textes très longs
    Quand l'utilisateur tape un texte de <longueur> caractères
    Et l'utilisateur sauvegarde la capture
    Alors la Capture est créée avec succès
    Et tout le texte est préservé

    Exemples:
      | longueur |
      | 500      |
      | 1000     |
      | 5000     |
      | 10000    |

  @edge-case @special-characters
  Plan du scénario: Préserver les caractères spéciaux
    Quand l'utilisateur tape "<texte_special>"
    Et l'utilisateur sauvegarde la capture
    Alors le rawContent contient exactement "<texte_special>"

    Exemples:
      | texte_special                                |
      | Hello "World" with 'quotes'                  |
      | Text with\nnewlines\nand\ttabs               |
      | Émojis 🚀 👋 💡 et accents éàü               |
      | Code snippet: const x = { y: 'z' };          |
      | XML/HTML: <div class="test">Content</div>    |

  @edge-case @rapid-saves
  Scénario: Sauvegarder plusieurs captures rapidement
    Quand l'utilisateur sauvegarde "Première pensée"
    Et immédiatement l'utilisateur tape "Deuxième pensée"
    Et immédiatement l'utilisateur sauvegarde
    Et immédiatement l'utilisateur tape "Troisième pensée"
    Et immédiatement l'utilisateur sauvegarde
    Alors 3 Captures distinctes sont créées
    Et chacune a son propre ID unique
    Et chacune a son propre timestamp capturedAt

  @edge-case @navigation-interruption
  Scénario: Gérer l'interruption par navigation système
    Étant donné que l'utilisateur tape "Texte en cours"
    Quand l'application passe en arrière-plan (home button)
    Et l'utilisateur revient à l'application
    Alors le texte "Texte en cours" est toujours présent
    Et le curseur est toujours focalisé

  @edge-case @crash-recovery
  Scénario: Récupérer le texte après un crash
    Étant donné que l'utilisateur tape "Texte avant crash"
    Quand l'application crash avant la sauvegarde
    Et l'utilisateur relance l'application
    Alors un draft du texte "Texte avant crash" est récupéré
    Et l'utilisateur est invité à sauvegarder ou supprimer
