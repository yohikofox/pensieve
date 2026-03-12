# language: fr

Fonctionnalité: Story 3.5 - Vue Détail Capture Texte — Layout Dédié & Édition Inline

  @AC1
  Scénario: AC1 - Layout dédié pour les captures texte
    Étant donné une capture de type texte avec du contenu
    Quand l'écran de détail se charge
    Alors la capture est identifiée comme non-audio
    Et la capture n'a pas de fichier audio associé
    Et la section Analyse est visible sans navigation par onglets

  @AC2
  Scénario: AC2 - Mode lecture par défaut
    Étant donné une capture de type texte avec du contenu
    Quand l'écran de détail se charge
    Alors le mode édition est inactif par défaut
    Et le texte de la capture est accessible en lecture

  @AC3
  Scénario: AC3 - Passage en mode édition
    Étant donné une capture de type texte affichée en mode lecture
    Quand l'utilisateur active le mode édition
    Alors le mode édition est actif
    Et l'ActionBar affiche Annuler et Enregistrer

  @AC4
  Scénario: AC4 - Sauvegarde de la modification
    Étant donné une capture de type texte en mode édition avec du texte modifié
    Quand l'utilisateur sauvegarde les modifications
    Alors le texte modifié est persisté dans la base de données
    Et le mode édition est désactivé

  @AC5
  Scénario: AC5 - Annulation de la modification
    Étant donné une capture de type texte en mode édition avec du texte modifié
    Quand l'utilisateur annule les modifications
    Alors le texte original est restauré
    Et le mode édition est désactivé
    Et aucune modification n'est persistée

  @AC6
  Scénario: AC6 - Pas de régression sur les captures audio
    Étant donné une capture de type audio avec transcription
    Quand l'écran de détail se charge
    Alors la capture est identifiée comme audio
    Et la capture possède un fichier audio et une durée
