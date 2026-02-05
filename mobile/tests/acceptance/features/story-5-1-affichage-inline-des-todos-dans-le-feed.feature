# language: fr
Fonctionnalité: Story 5.1 - Affichage Inline des Todos dans le Feed

  En tant qu'utilisateur
  Je veux voir mes todos extraites des captures affichées inline dans le feed
  Afin de visualiser immédiatement les actions à faire sans navigation supplémentaire

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que l'app mobile est lancée
    Et que j'ai des captures avec des todos extraites

  Scénario: Affichage inline des todos sous les idées (AC1)
    Étant donné une idée a 2 todos associées
    Quand je consulte le feed de captures
    Alors je vois l'idée affichée avec son texte
    Et je vois la liste des 2 todos affichée inline sous l'idée
    Et chaque todo montre une checkbox, description, deadline et priorité
    Et les todos sont groupées visuellement sous l'idée parent

  Scénario: Tri des todos par priorité (AC2)
    Étant donné une idée a 5 todos avec différentes priorités
      | description          | priority | status    |
      | Todo haute priorité  | high     | active    |
      | Todo moyenne #1      | medium   | active    |
      | Todo complétée       | low      | completed |
      | Todo moyenne #2      | medium   | active    |
      | Todo basse           | low      | active    |
    Quand je consulte le feed
    Alors les todos actives sont affichées avant les complétées
    Et les todos actives sont triées par priorité: high → medium → low
    Et l'ordre exact est:
      | ordre | description          |
      | 1     | Todo haute priorité  |
      | 2     | Todo moyenne #1      |
      | 3     | Todo moyenne #2      |
      | 4     | Todo basse           |
      | 5     | Todo complétée       |

  Scénario: Affichage propre quand aucune action (AC3)
    Étant donné une idée n'a aucune todo associée
    Quand je consulte le feed
    Alors je vois l'idée affichée normalement
    Et aucune section de todos n'est affichée sous l'idée
    Et le feed reste propre et sans espace vide

  Scénario: Détails complets d'une todo (AC4)
    Étant donné une todo avec deadline "demain 14h" et priorité "high"
    Quand je consulte le feed
    Alors je vois la description de la todo
    Et je vois l'icône horloge avec "Dans 1 jour" en texte relatif
    Et je vois le badge de priorité "🔴 Haute" en rouge
    Et tous les détails sont lisibles sans scrolling horizontal

  Scénario: Deadline dépassée mise en évidence (AC4)
    Étant donné une todo avec deadline dépassée de 3 jours
    Quand je consulte le feed
    Alors la deadline affiche "En retard de 3 jours" en rouge
    Et l'icône horloge est rouge également
    Et la todo reste visible (pas cachée)

  Scénario: État visuel todo complétée (AC5)
    Étant donné une todo avec status "completed"
    Quand je consulte le feed
    Alors la checkbox affiche une checkmark
    Et la description a un strikethrough (ligne barrée)
    Et la todo entière est dimmed (opacité réduite)
    Et elle reste visible mais visuellement secondaire

  Scénario: Interaction avec une todo - Ouverture du popover (AC6)
    Étant donné une todo est affichée dans le feed
    Quand je tap sur la todo
    Alors un popover modal s'ouvre avec les détails complets
    Et je peux éditer la description, deadline et priorité
    Et je peux marquer la todo comme complétée/active
    Et je vois un bouton "📍 View Origin Capture" (FR20)

  Scénario: Navigation vers capture source (AC6, FR20)
    Étant donné le popover d'une todo est ouvert
    Quand je tap sur "View Origin Capture"
    Alors le popover se ferme
    Et je navigue vers CaptureDetailScreen avec captureId
    Et un feedback haptique léger confirme l'action

  Scénario: Styling cohérent à travers le feed (AC7)
    Étant donné j'ai 3 captures avec différentes idées et todos
    Quand je scroll le feed
    Alors toutes les todos utilisent le même style visuel
    Et les icônes, couleurs et espacements sont constants
    Et la taille de texte est identique partout
    Et l'expérience est cohérente et prévisible

  Scénario: Toggle checkbox avec animation (AC8, FR19)
    Étant donné une todo active est affichée
    Quand je tap sur la checkbox pour marquer complétée
    Alors un feedback haptique medium est déclenché
    Et une animation de complétion apparaît (scale pulse + glow)
    Et l'animation dure ~400ms et reste fluide (60fps)
    Et la todo passe à status "completed" immédiatement (optimistic update)
    Et la todo se déplace en bas de la liste (après les actives)

  Scénario: Uncheck todo - pas d'animation
    Étant donné une todo complétée est affichée
    Quand je tap sur la checkbox pour la réactiver
    Alors un feedback haptique medium est déclenché
    Et AUCUNE animation de complétion n'apparaît
    Et la todo passe à status "active" immédiatement
    Et la todo remonte dans le tri par priorité

  Scénario: Édition rapide depuis le popover
    Étant donné le popover d'une todo est ouvert
    Quand je change la description de "Appeler John" à "Appeler John - urgent"
    Et je change la priorité de "low" à "high"
    Et je change la deadline à "demain 10h"
    Et je tap "Save"
    Alors le popover se ferme
    Et la todo est mise à jour immédiatement dans le feed
    Et les changements sont visibles sans refresh
    Et un feedback haptique confirme la sauvegarde

  Scénario: Annulation d'édition sans changements
    Étant donné le popover d'une todo est ouvert
    Et je n'ai fait aucun changement
    Quand je tap "Cancel" ou le backdrop
    Alors le popover se ferme
    Et aucune requête de sauvegarde n'est envoyée
    Et la todo reste inchangée

  Scénario: Détection des changements
    Étant donné le popover d'une todo est ouvert
    Quand je modifie la description
    Alors le bouton "Save" devient enabled
    Et quand je reviens à la valeur originale
    Alors le bouton "Save" devient disabled à nouveau

  Scénario: Performance avec nombreuses todos
    Étant donné une idée a 20 todos
    Quand je consulte le feed
    Alors la liste se charge sans lag (<100ms)
    Et le scroll est fluide (60fps constant)
    Et les animations de complétion restent smooth
