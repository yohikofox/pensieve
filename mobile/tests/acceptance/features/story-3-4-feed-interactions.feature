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

  Scénario: AC6 - Gestes de navigation spécifiques à la plateforme
    Étant donné je suis sur l'écran de détail d'une capture
    Quand j'utilise un geste de retour spécifique à la plateforme
    Alors la navigation respecte les conventions de la plateforme
    Et la transition de retour est fluide et prévisible
