# Story 27.2: PAT Mobile — Écran Gestion des Personal Access Tokens
Feature: Gestion des Personal Access Tokens depuis l'application mobile

  Background:
    Given l'utilisateur est authentifié avec un token valide

  # === AC1: Navigation depuis Settings ===
  Scenario: Navigation vers l'écran PAT depuis les paramètres
    Given l'écran Settings est affiché
    When l'utilisateur appuie sur "Accès API"
    Then l'écran "Personal Access Tokens" est affiché
    And la liste des PATs est chargée depuis l'API

  # === AC2: Création d'un PAT avec affichage du token unique ===
  Scenario: Création d'un PAT avec affichage du token une seule fois
    Given l'écran "Personal Access Tokens" est affiché
    And la connexion réseau est disponible
    When l'utilisateur appuie sur "Créer"
    And l'utilisateur saisit le nom "Mon client API"
    And l'utilisateur sélectionne les scopes "captures:read" et "todos:read"
    And l'utilisateur appuie sur "Créer le token"
    Then le token est créé avec succès
    And la modale d'affichage du token s'ouvre
    And le token complet est affiché dans la modale

  # === AC3: Copie du token dans le presse-papier ===
  Scenario: Copie du token dans le presse-papier
    Given la modale d'affichage du token est ouverte avec le token "pns_TestToken123456"
    When l'utilisateur appuie sur "Copier le token"
    Then le token "pns_TestToken123456" est copié dans le presse-papier
    And le bouton affiche "Copié !" en retour visuel

  # === AC5: Renouvellement d'un PAT ===
  Scenario: Renouvellement d'un PAT actif
    Given l'écran "Personal Access Tokens" est affiché
    And un PAT actif "Mon token" existe dans la liste
    And la connexion réseau est disponible
    When l'utilisateur appuie sur "Renouveler" pour "Mon token"
    Then une confirmation est demandée avec le message d'impact
    When l'utilisateur confirme le renouvellement
    Then le PAT est renouvelé avec succès
    And la modale d'affichage du nouveau token s'ouvre

  # === AC6: Révocation d'un PAT ===
  Scenario: Révocation d'un PAT actif
    Given l'écran "Personal Access Tokens" est affiché
    And un PAT actif "Mon token" existe dans la liste
    And la connexion réseau est disponible
    When l'utilisateur appuie sur "Révoquer" pour "Mon token"
    Then une confirmation est demandée avec le message de révocation
    When l'utilisateur confirme la révocation
    Then le PAT est révoqué avec succès
    And le PAT apparaît dans la section "Archivés"

  # === AC4: Modification d'un PAT (nom et scopes) ===
  Scenario: Ouverture du formulaire pré-rempli pour modification
    Given l'écran "Personal Access Tokens" est affiché
    And un PAT actif "Mon token" avec les scopes "captures:read" existe dans la liste
    And la connexion réseau est disponible
    When l'utilisateur appuie sur "Modifier" pour "Mon token"
    Then le formulaire de modification s'ouvre pré-rempli avec le nom "Mon token"
    And les scopes actuels "captures:read" sont présélectionnés
    And le sélecteur de durée n'est pas affiché (immutable)

  Scenario: Modification du nom et des scopes d'un PAT
    Given le formulaire de modification est ouvert avec le PAT "Mon token"
    When l'utilisateur modifie le nom en "Token renommé"
    And l'utilisateur ajoute le scope "todos:read"
    And l'utilisateur appuie sur "Enregistrer"
    Then le PAT est mis à jour avec succès
    And la liste affiche le token avec le nouveau nom "Token renommé"

  # === AC8: Mode offline — liste read-only ===
  Scenario: Mode offline — liste en lecture seule
    Given l'écran "Personal Access Tokens" est affiché
    And la connexion réseau est indisponible
    Then un bandeau "Connexion requise pour modifier les tokens" est affiché
    And le bouton "Créer" est désactivé
    And les actions "Modifier", "Renouveler" et "Révoquer" sont désactivées
