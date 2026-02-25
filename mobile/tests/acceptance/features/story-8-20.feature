# language: fr
@story-8.20 @epic-8 @bug-fix
Fonctionnalité: Transcription native — texte complet pour enregistrements longs
  En tant qu'utilisateur enregistrant une note vocale de plus de ~15 secondes
  Je veux que la transcription native retourne le texte complet de mon enregistrement
  Afin de ne pas perdre le début de mes idées

  # ============================================================================
  # AC1 — transcribeFile accumule tous les segments isFinal
  # ============================================================================

  @AC1 @transcribeFile @bug-fix
  Scénario: Transcription d'un fichier audio long avec 3 segments isFinal
    Étant donné un moteur de transcription native prêt
    Quand je transcris un fichier audio qui génère 3 segments isFinal successifs
    Alors le texte final est la concaténation des 3 segments
    Et les segments sont séparés par un espace simple

  @AC1 @transcribeFile @bug-fix
  Scénario: Transcription d'un fichier audio avec 2 segments isFinal
    Étant donné un moteur de transcription native prêt
    Quand je transcris un fichier audio qui génère 2 segments isFinal successifs
    Alors le texte final est la concaténation des 2 segments

  # ============================================================================
  # AC2 — startRealTime accumule les segments isFinal dans accumulatedText
  # ============================================================================

  @AC2 @startRealTime @bug-fix
  Scénario: Mode temps réel accumule plusieurs segments isFinal
    Étant donné un moteur de transcription native en mode temps réel
    Quand 2 segments isFinal sont émis successivement
    Alors le texte accumulé contient les 2 segments concaténés

  # ============================================================================
  # AC3 — Non-régression sur enregistrement court
  # ============================================================================

  @AC3 @regression @transcribeFile
  Scénario: Un seul segment isFinal retourne un résultat identique à avant
    Étant donné un moteur de transcription native prêt
    Quand je transcris un fichier audio qui génère 1 seul segment isFinal
    Alors le texte final est identique au texte du segment

  @AC3 @regression @startRealTime
  Scénario: Mode temps réel avec un seul segment isFinal
    Étant donné un moteur de transcription native en mode temps réel
    Quand 1 seul segment isFinal est émis
    Alors le texte accumulé est identique au texte du segment

  # ============================================================================
  # AC4 — Séparateur espace simple
  # ============================================================================

  @AC4 @separator
  Scénario: Les segments sont séparés par un espace simple sans doublon
    Étant donné un moteur de transcription native prêt
    Quand je transcris un fichier audio qui génère 2 segments isFinal
    Alors le texte final ne contient pas de doubles espaces
    Et les segments sont bien séparés par un seul espace

  # ============================================================================
  # Cohérence — résultats partiels ne corrompent pas l'accumulation
  # ============================================================================

  @coherence @startRealTime @regression
  Scénario: Les résultats partiels ne modifient pas l'accumulation isFinal
    Étant donné un moteur de transcription native en mode temps réel
    Quand un segment isFinal puis un résultat partiel puis un segment isFinal sont émis
    Alors le texte accumulé ne contient que les 2 segments isFinal
