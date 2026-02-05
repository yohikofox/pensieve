# language: fr
Fonctionnalité: Story 4.4 - Notifications de Progression IA

  En tant qu'utilisateur
  Je veux être notifié de la progression des processus IA long-running
  Afin de ne jamais attendre sans feedback et savoir quand mes insights sont prêts

  Contexte:
    Étant donné que je suis un utilisateur authentifié
    Et que l'app mobile est lancée

  Scénario: Notification de mise en queue (AC1)
    Étant donné un job de digestion est ajouté à la queue RabbitMQ
    Quand le job entre dans la queue
    Alors une notification locale "Processing your thought..." est affichée
    Et la carte capture dans le feed montre un indicateur de progression
    Et le badge status affiche "Queued"
    Et si la queue est chargée, le temps d'attente estimé est affiché

  Scénario: Indicateur de traitement actif avec "Still processing..." (AC2)
    Étant donné la digestion est en cours depuis 12 secondes
    Quand le worker traite le job
    Alors le status capture est mis à jour en temps réel vers "Digesting..."
    Et une animation de progression est affichée (pulsing/shimmer)
    Et une notification "Still processing..." est envoyée
    Et un feedback haptique subtil pulse toutes les 5 secondes (si activé)

  Scénario: Notification de complétion avec aperçu insights (AC3)
    Étant donné la digestion se termine avec succès (2 ideas, 3 todos)
    Quand le Thought, Ideas et Todos sont persistés
    Alors si l'app est en arrière-plan, une push notification "New insights from your thought!" est envoyée
    Et si l'app est au premier plan, une notification locale est affichée
    Et le feed se met à jour en temps réel avec animation de germination
    Et un feedback haptique fort célèbre la complétion (single pulse)
    Et la notification inclut un aperçu des insights (summary preview)

  Scénario: Deep link vers capture digérée (AC4)
    Étant donné j'ai reçu une notification de complétion
    Quand je tap sur la notification
    Alors l'app s'ouvre directement sur la vue détail de la capture digérée
    Et les insights sont surlignés avec un effet glow subtil
    Et la transition est fluide et immédiate

  Scénario: Notification d'échec avec retry (AC5)
    Étant donné la digestion échoue après 3 retries
    Quand la capture est marquée "digestion_failed"
    Alors je reçois une notification d'erreur "Unable to process thought. Tap to retry."
    Et la carte capture montre un badge d'erreur avec option retry
    Et taper sur la notification ou le bouton retry re-queue le job

  Scénario: Suivi progression multi-captures (AC6)
    Étant donné 5 captures sont en cours de traitement simultanément
    Quand je consulte le feed
    Alors chaque capture montre son status individuel de traitement
    Et un indicateur global affiche "Processing 5 thoughts"
    Et je peux taper pour voir les détails de la queue (ordre, temps estimés)

  Scénario: Respect des paramètres de notification (AC7)
    Étant donné j'ai désactivé les notifications dans les paramètres
    Quand une digestion se termine
    Alors aucune push ou notification locale n'est envoyée
    Et le feed se met toujours à jour en temps réel avec indicateurs visuels uniquement
    Et les paramètres de notification sont respectés

  Scénario: Notification queue offline (AC8)
    Étant donné l'app est offline pendant le traitement
    Quand des jobs de digestion sont en queue pour le retour réseau
    Alors je vois le status "Queued for when online"
    Et une notification m'informe quand la connectivité revient et le traitement démarre
    Et la transition de queue offline → online processing est seamless

  Scénario: Notification d'avertissement timeout (AC9)
    Étant donné le traitement dure plus que prévu (>30s)
    Quand le seuil de timeout est approché
    Alors je reçois une notification "This is taking longer than usual..."
    Et on me propose des options : "Keep waiting" ou "Cancel and retry later"
    Et le système log le traitement lent pour monitoring

  Scénario: Haptic feedback respecte les préférences utilisateur (AC2, AC3, AC7)
    Étant donné j'ai désactivé le feedback haptique dans les paramètres
    Quand une digestion se termine avec succès
    Alors aucun haptic feedback n'est déclenché
    Et toutes les autres notifications (locale/push) fonctionnent normalement
    Et les préférences haptiques sont respectées
