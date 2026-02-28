# language: fr
Fonctionnalité: Transcription Live avec Waveform
  En tant qu'utilisateur souhaitant capturer une pensée rapidement
  Je veux voir ma parole transcrite en temps réel avec une visualisation audio
  Afin de confirmer que le micro m'écoute et sauvegarder le texte instantanément

  Scénario: Démarrage avec moteur natif active les événements de volume
    Étant donné un moteur de transcription native initialisé
    Quand je démarre la transcription live avec les événements volume activés
    Alors ExpoSpeechRecognitionModule.start est appelé avec volumeChangeEventOptions
    Et le moteur est en état d'écoute active

  Scénario: Sans enableVolumeEvents le callback volumeChange n'est pas appelé
    Étant donné un moteur de transcription native initialisé
    Quand je démarre la transcription live sans les événements volume
    Et un événement volumechange est émis avec valeur 5.0
    Alors le callback onVolumeChange n'est pas déclenché

  Scénario: Résultat partiel déclenche le callback onPartialResult
    Étant donné un moteur de transcription native en écoute
    Quand un résultat partiel avec le texte "bonjour" arrive
    Alors le callback onPartialResult reçoit le texte "bonjour"
    Et le texte accumulé reste vide

  Scénario: Résultat final accumule le texte confirmé
    Étant donné un moteur de transcription native en écoute
    Quand un résultat final avec le texte "bonjour monde" arrive
    Alors le callback onFinalResult reçoit le texte "bonjour monde"
    Et le texte accumulé vaut "bonjour monde"

  Scénario: Stop avec texte accumulé appelle createTextCapture
    Étant donné un moteur de transcription native avec le texte accumulé "Penser à rappeler Marie demain"
    Quand je stoppe la transcription et récupère le texte accumulé
    Alors createTextCapture est appelé avec "Penser à rappeler Marie demain"
    Et le résultat est un succès

  Scénario: Stop sans texte n'appelle pas createTextCapture
    Étant donné un moteur de transcription native sans texte accumulé
    Quand je stoppe la transcription et vérifie le texte accumulé
    Alors createTextCapture n'est pas appelé
    Et le moteur n'est plus en écoute

  Scénario: Cancel efface le texte accumulé et arrête l'écoute
    Étant donné un moteur de transcription native avec le texte accumulé "du texte en cours"
    Quand j'annule la transcription
    Alors le texte accumulé est vide après annulation
    Et createTextCapture n'est pas appelé après annulation

  Scénario: Moteur Whisper sélectionné — la transcription live ne démarre pas
    Étant donné le moteur de transcription préféré est "whisper"
    Quand je tente de démarrer la transcription live via le hook
    Alors startRealTime n'est pas appelé
    Et un toast informatif "liveTranscription.nativeRequired" est affiché
