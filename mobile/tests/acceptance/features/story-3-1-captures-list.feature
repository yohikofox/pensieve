# language: fr
# Story 3.1: Liste Chronologique des Captures

Fonctionnalité: Liste Chronologique des Captures
  En tant qu'utilisateur
  Je veux voir une liste chronologique de toutes mes captures sur l'écran principal
  Afin de pouvoir parcourir rapidement mes pensées récentes et y accéder instantanément, même hors ligne

  Contexte:
    Étant donné un utilisateur connecté

  # AC1: Display Captures in Reverse Chronological Order
  @AC1
  Scénario: Affichage des captures en ordre chronologique inversé
    Étant donné les captures suivantes existent:
      | id    | type  | state | createdAt           | normalizedText      |
      | cap-1 | audio | ready | 2026-02-01T10:00:00 | Première pensée     |
      | cap-2 | text  | ready | 2026-02-01T11:00:00 | Deuxième pensée     |
      | cap-3 | audio | ready | 2026-02-01T12:00:00 | Troisième pensée    |
    Quand j'ouvre l'écran des captures
    Alors les captures sont affichées dans l'ordre suivant:
      | id    |
      | cap-3 |
      | cap-2 |
      | cap-1 |
    Et chaque carte de capture affiche:
      | élément         |
      | icône de type   |
      | horodatage      |
      | texte de prévisualisation |
      | indicateur de statut |

  @AC1 @NFR4
  Scénario: Le feed se charge en moins d'une seconde
    Étant donné 20 captures existent dans la base de données
    Quand j'ouvre l'écran des captures
    Alors le feed se charge en moins de 1000 millisecondes

  # AC2: Show Preview Text Based on Capture Type
  @AC2
  Scénario: Prévisualisation pour capture audio avec transcription
    Étant donné une capture audio avec id "cap-audio-1" et normalizedText "Ceci est une longue transcription qui dépasse cent caractères et devrait être tronquée pour l'affichage dans la liste des captures"
    Quand j'ouvre l'écran des captures
    Alors la prévisualisation de "cap-audio-1" affiche "Ceci est une longue transcription qui dépasse cent caractères et devrait être tronquée pour l'affich..."

  @AC2
  Scénario: Prévisualisation pour capture audio sans transcription en cours
    Étant donné une capture audio avec id "cap-audio-2" et state "processing" et sans normalizedText
    Quand j'ouvre l'écran des captures
    Alors la prévisualisation de "cap-audio-2" affiche "Transcription en cours..."

  @AC2
  Scénario: Prévisualisation pour capture audio en attente
    Étant donné une capture audio avec id "cap-audio-3" et state "captured" et duration 45000 et sans normalizedText
    Quand j'ouvre l'écran des captures
    Alors la prévisualisation de "cap-audio-3" affiche la durée "45s"

  @AC2
  Scénario: Prévisualisation pour capture texte
    Étant donné une capture texte avec id "cap-text-1" et rawContent "Ma pensée importante du jour"
    Quand j'ouvre l'écran des captures
    Alors la prévisualisation de "cap-text-1" affiche "Ma pensée importante du jour"

  # AC3: Offline Feed Access
  @AC3
  Scénario: Accès au feed hors ligne
    Étant donné 10 captures existent dans la base de données
    Et l'appareil est hors ligne
    Quand j'ouvre l'écran des captures
    Alors toutes les 10 captures sont affichées
    Et aucune erreur réseau n'est affichée
    Et un indicateur hors ligne est visible dans l'en-tête

  @AC3
  Scénario: Le feed fonctionne identiquement hors ligne
    Étant donné 5 captures existent dans la base de données
    Et l'appareil est hors ligne
    Quand j'ouvre l'écran des captures
    Et je fais défiler la liste
    Alors le défilement est fluide
    Et les captures restent accessibles

  # AC4: Infinite Scroll for Large Lists
  @AC4
  Scénario: Chargement paresseux avec scroll infini
    Étant donné 60 captures existent dans la base de données
    Quand j'ouvre l'écran des captures
    Alors les 20 premières captures sont affichées
    Quand je fais défiler vers le bas jusqu'à la fin
    Alors 20 captures supplémentaires sont chargées
    Et un indicateur de chargement est affiché pendant le chargement

  @AC4 @performance
  Scénario: Performance de défilement à 60fps
    Étant donné 100 captures existent dans la base de données
    Quand j'ouvre l'écran des captures
    Et je fais défiler rapidement la liste
    Alors le défilement maintient 60fps

  # AC5: Pull-to-Refresh
  @AC5
  Scénario: Pull-to-refresh recharge les données
    Étant donné 5 captures existent dans la base de données
    Et j'ouvre l'écran des captures
    Quand je tire vers le bas pour rafraîchir
    Alors une animation de rafraîchissement est affichée
    Et les captures sont rechargées depuis la base de données

  @AC5
  Scénario: Nouvelles captures apparaissent après refresh
    Étant donné 3 captures existent dans la base de données
    Et j'ouvre l'écran des captures
    Et une nouvelle capture "new-cap" est créée
    Quand je tire vers le bas pour rafraîchir
    Alors la capture "new-cap" apparaît en haut de la liste

  # AC6: Empty State
  @AC6
  Scénario: État vide avec message d'accueil
    Étant donné aucune capture n'existe
    Quand j'ouvre l'écran des captures
    Alors un message d'état vide est affiché avec:
      | élément                  | valeur                                    |
      | titre                    | Votre jardin d'idées est prêt à germer    |
      | description              | Capturez votre première pensée            |
      | illustration             | jardin-idees                              |

  @AC6
  Scénario: Boutons de capture mis en avant sur état vide
    Étant donné aucune capture n'existe
    Quand j'ouvre l'écran des captures
    Alors les boutons de capture sont visibles et mis en avant

  # AC7: Skeleton Loading
  @AC7
  Scénario: Affichage du skeleton pendant le chargement
    Étant donné 10 captures existent dans la base de données
    Et la base de données est lente à répondre
    Quand j'ouvre l'écran des captures
    Alors des cartes skeleton sont affichées
    Et les cartes skeleton ont une animation de shimmer

  @AC7
  Scénario: Transition fluide du skeleton au contenu
    Étant donné 5 captures existent dans la base de données
    Et la base de données est lente à répondre
    Quand j'ouvre l'écran des captures
    Et les données arrivent
    Alors la transition du skeleton au contenu est fluide
    Et le contenu s'affiche avec une animation de fondu
