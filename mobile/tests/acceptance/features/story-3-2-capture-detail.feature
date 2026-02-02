# language: fr

Fonctionnalité: Story 3.2 - Vue Détail d'une Capture

  Scénario: AC1 - Transition fluide depuis le feed
    Étant donné que je suis sur l'écran du feed des captures
    Quand je tape sur une carte de capture
    Alors l'écran de détail s'ouvre avec une animation fluide
    Et le contenu complet de la capture est affiché

  Scénario: AC2 - Affichage détail capture audio avec transcription
    Étant donné une capture audio avec transcription disponible
    Quand je consulte l'écran de détail de cette capture
    Alors je vois le lecteur audio avec contrôles play/pause
    Et je vois une visualisation waveform de l'audio
    Et je vois la transcription complète
    Et je vois le timestamp et la durée
    Et je vois les badges de statut

  Scénario: AC2 - Contrôles du lecteur audio
    Étant donné que je suis sur l'écran de détail d'une capture audio
    Quand j'appuie sur le bouton play
    Alors l'audio commence à jouer
    Et le bouton affiche pause
    Quand j'appuie sur le bouton pause
    Alors l'audio se met en pause
    Et le bouton affiche play

  Scénario: AC2 - Synchronisation lecture audio et transcription
    Étant donné que je suis sur l'écran de détail d'une capture audio
    Quand je lance la lecture audio
    Alors la position actuelle dans la transcription est mise en évidence
    Et la transcription défile automatiquement pour suivre la lecture
    Quand je tape sur un mot dans la transcription
    Alors l'audio saute à la position correspondante

  Scénario: AC3 - Affichage détail capture texte
    Étant donné une capture de type texte
    Quand je consulte l'écran de détail de cette capture
    Alors je vois le contenu texte complet avec formatage
    Et je vois le nombre de caractères et de mots
    Et je vois le timestamp de capture
    Et l'interface n'affiche pas de lecteur audio

  Scénario: AC4 - Accès hors ligne au détail
    Étant donné que je suis hors ligne
    Et qu'une capture est en cache local
    Quand je consulte l'écran de détail de cette capture
    Alors la vue se charge instantanément depuis le cache local
    Et toutes les fonctionnalités sont disponibles comme en ligne
    Et aucune erreur réseau n'est affichée

  Scénario: AC5 - Mise à jour live de la transcription
    Étant donné que je consulte une capture audio en cours de transcription
    Et que la transcription se termine en arrière-plan
    Quand la transcription devient disponible
    Alors le texte de transcription apparaît automatiquement sans rafraîchir
    Et une animation subtile indique le nouveau contenu disponible
    Et un feedback haptique confirme la mise à jour

  Scénario: AC6 - Navigation swipe vers capture suivante
    Étant donné que je suis sur l'écran de détail d'une capture
    Et qu'il existe une capture suivante dans le feed
    Quand je swipe vers la gauche
    Alors la capture suivante s'affiche
    Et la transition est fluide avec animation horizontale

  Scénario: AC6 - Navigation swipe vers capture précédente
    Étant donné que je suis sur l'écran de détail d'une capture
    Et qu'il existe une capture précédente dans le feed
    Quand je swipe vers la droite
    Alors la capture précédente s'affiche
    Et la transition est fluide avec animation horizontale

  Scénario: AC6 - Pas de navigation si première/dernière capture
    Étant donné que je suis sur l'écran de détail de la première capture
    Quand je swipe vers la droite
    Alors la capture reste affichée sans navigation
    Étant donné que je suis sur l'écran de détail de la dernière capture
    Quand je swipe vers la gauche
    Alors la capture reste affichée sans navigation

  Scénario: AC7 - Retour au feed avec position préservée
    Étant donné que je suis sur l'écran de détail d'une capture
    Quand je tape sur le bouton retour
    Alors je retourne à l'écran du feed
    Et le feed défile automatiquement vers la capture consultée
    Et la transition est fluide

  Scénario: AC7 - Retour au feed par swipe down
    Étant donné que je suis sur l'écran de détail d'une capture
    Quand je swipe vers le bas
    Alors je retourne à l'écran du feed
    Et le feed défile automatiquement vers la capture consultée
    Et la transition est fluide

  Scénario: AC8 - Menu contextuel par appui long
    Étant donné que je suis sur l'écran de détail d'une capture
    Quand je fais un appui long sur la zone de contenu
    Alors un menu contextuel apparaît avec les actions disponibles
    Et un feedback haptique confirme l'activation du menu
    Et je peux voir les actions: partager, supprimer, éditer

  Scénario: AC8 - Action partager depuis menu contextuel
    Étant donné que le menu contextuel est ouvert
    Quand je sélectionne l'action "partager"
    Alors le dialogue de partage système s'ouvre
    Et je peux partager le contenu de la capture

  Scénario: AC8 - Action supprimer depuis menu contextuel
    Étant donné que le menu contextuel est ouvert
    Quand je sélectionne l'action "supprimer"
    Alors une confirmation de suppression est demandée
    Quand je confirme la suppression
    Alors la capture est supprimée
    Et je retourne au feed
