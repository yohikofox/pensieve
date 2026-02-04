# Story 4.3: Extraction Automatique d'Actions
# BDD Acceptance Tests with jest-cucumber

Fonctionnalité: Extraction automatique de todos depuis les captures

  Scénario: Extraction unique action avec deadline et priorité (AC1, AC2, AC3, AC4)
    Étant donné une capture texte "Faut que je pense à envoyer la facture à Mme Micheaux avant vendredi. C'est urgent."
    Quand le worker de digestion traite la capture
    Alors GPT-4o-mini extrait 1 todo dans le même appel que résumé + idées
    Et le todo contient : description="Envoyer facture Mme Micheaux", deadline="vendredi", priority="high"
    Et une entité Todo est créée avec thoughtId, status="todo"
    Et le deadline est parsé en Date (prochain vendredi)
    Et l'événement TodosExtracted est publié avec 1 todoId

  Scénario: Extraction multiples actions d'une seule capture (AC5)
    Étant donné une capture "Envoyer facture avant vendredi. Analyser Pennylane. Acheter lait."
    Quand le worker de digestion traite la capture
    Alors GPT-4o-mini extrait 3 todos distincts
    Et 3 entités Todo sont créées liées au même Thought
    Et l'événement TodosExtracted contient todoIds avec 3 IDs

  Scénario: Capture sans action (AC6)
    Étant donné une capture "J'ai observé un pattern intéressant sur le marché."
    Quand le worker de digestion traite la capture
    Alors GPT-4o-mini retourne todos=[]
    Et aucune entité Todo n'est créée
    Et la digestion se termine avec succès

  Scénario: Parsing deadline null (AC3)
    Étant donné un todo extrait avec deadline=null
    Quand le todo est créé
    Alors le champ deadline est NULL dans la base de données

  Scénario: Suppression false positive (AC7)
    Étant donné un todo créé "id-123"
    Quand l'utilisateur appelle DELETE /api/todos/id-123
    Alors le todo est supprimé de la base de données
    Et le statut HTTP est 204 No Content
