# language: fr
Fonctionnalité: Story 3.4 - Navigation et Interactions dans le Feed

  Scénario: AC1 - Performance 60fps et feedback haptique
    Étant donné j'interagis avec le feed
    Quand je fais un geste (tap, swipe, scroll)
    Alors toutes les animations tournent à 60fps
    Et un feedback haptique est déclenché pour les actions clés

  Scénario: AC2 - Transition hero vers détail
    Étant donné je tape sur une carte de capture
    Quand la vue détail s'ouvre
    Alors une transition hero fluide transforme la carte en vue détail
    Et la transition se termine en 250-350ms

  Scénario: AC3 - Actions contextuelles au swipe
    Étant donné je suis sur l'écran de feed avec des captures
    Quand je swipe horizontalement une carte de capture vers la gauche
    Alors des actions contextuelles apparaissent (partager)
    Et le swipe révèle les options avec une physique spring
    Et un feedback haptique confirme le seuil d'action
    Quand je swipe horizontalement une carte vers la droite
    Alors l'action de suppression apparaît
    Et un feedback haptique confirme l'action

  Scénario: AC4 - Animations de scroll
    Étant donné je suis sur l'écran de feed avec 10+ captures
    Quand je fais défiler le feed vers le bas
    Alors les nouvelles captures apparaissent avec un fondu et glissement subtil
    Et l'animation est décalée de 50ms par item pour un effet organique
    Et la performance de scroll reste à 60fps

  Scénario: AC5 - Menu contextuel appui long
    Étant donné je suis sur l'écran de feed avec des captures
    Quand je maintiens un appui long de 300ms sur une carte
    Alors un menu contextuel apparaît avec une animation d'échelle
    Et un feedback haptique moyen signale l'activation du menu
    Et l'arrière-plan est légèrement flouté (effet Liquid Glass)
    Et les options du menu sont: Partager, Supprimer, Épingler, Favoris

  Scénario: AC6 - Gestes de navigation spécifiques à la plateforme
    Étant donné je suis sur l'écran de détail d'une capture
    Quand j'utilise un geste de retour spécifique à la plateforme
    Alors la navigation respecte les conventions de la plateforme
    Et la transition de retour est fluide et prévisible

  Scénario: AC7 - Évolution visuelle "Jardin d'idées"
    Étant donné je consulte le feed avec des captures d'âges différents
    Quand je vois une capture récente (< 1 jour)
    Alors elle affiche un indicateur de maturité "nouvelle" avec une lueur verte subtile
    Quand je vois une capture en croissance (1-7 jours)
    Alors elle affiche un indicateur de maturité "en croissance" avec une lueur bleue subtile
    Quand je vois une capture mature (> 7 jours)
    Alors elle affiche un indicateur de maturité "mature" avec une lueur ambrée subtile
    Et l'esthétique globale est calme et contemplative

  Scénario: AC8 - États vides animés avec "Jardin d'idées"
    Étant donné aucune capture n'existe dans la base de données
    Quand j'ouvre l'écran de feed des captures
    Alors je vois une illustration "feather" avec couleur verte calming
    Et l'icône a une animation de respiration lente (3000ms cycle)
    Et je vois le titre "Votre jardin d'idées est prêt à germer"
    Et je vois la description "Capturez votre première pensée"
    Et je vois un bouton "Commencer"
    Et des micro-animations Lottie ajoutent de la vie à l'écran
    Et l'esthétique est calming et contemplative

  Scénario: AC8b - Respect de Reduce Motion
    Étant donné l'utilisateur a activé "Reduce Motion" dans les réglages
    Et aucune capture n'existe
    Quand j'ouvre l'écran de feed
    Alors l'état vide s'affiche sans animations
    Et les informations restent accessibles
