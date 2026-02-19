# language: fr
@story-1.3 @epic-1
Fonctionnalité: Conformité RGPD (Export de données & Suppression de compte)
  En tant qu'utilisateur de Pensieve
  Je veux pouvoir exporter toutes mes données personnelles et supprimer mon compte définitivement
  Afin de respecter mes droits RGPD (Articles 15 & 17) et contrôler mes données

  # ============================================================================
  # AC1: Data Export (Article 15 RGPD)
  # ============================================================================

  @AC1 @rgpd @data-export
  Scénario: Export de données simple (< 100 MB)
    Étant donné que je suis connecté
    Et que j'ai moins de 100 MB de données
    Quand je tape sur "Exporter mes données" dans les paramètres
    Et je confirme l'export dans le dialog
    Alors un fichier ZIP est généré contenant toutes mes données
    Et le ZIP contient les fichiers:
      | fichier              | description                    |
      | user-profile.json    | Profil utilisateur Better Auth |
      | captures.json        | Métadonnées des captures       |
      | transcriptions.json  | Toutes les transcriptions      |
      | ai-digests.json      | Résultats du traitement IA     |
      | actions.json         | Actions/todos extraits         |
      | audios/*.m4a         | Tous les fichiers audio        |
    Et le fichier ZIP est téléchargé sur mon appareil
    Et je peux partager le ZIP via le share sheet iOS/Android

  @AC1 @rgpd @data-export @large-dataset
  Scénario: Export de données volumineuses (> 100 MB)
    Étant donné que je suis connecté
    Et que j'ai plus de 100 MB de données
    Quand je demande un export de données
    Alors l'export est traité en tâche asynchrone (queue)
    Et un message "Préparation en cours" est affiché
    Et je reçois une notification quand l'export est prêt
    Et je reçois un email avec un lien de téléchargement
    Et le lien de téléchargement expire après 24 heures

  @AC1 @rgpd @data-export @content-validation
  Scénario: Validation du contenu du fichier user-profile.json
    Étant donné que j'ai exporté mes données
    Quand j'ouvre le fichier user-profile.json
    Alors je vois les métadonnées d'export:
      | champ           | présent |
      | export_date     | oui     |
      | user_id         | oui     |
      | format_version  | oui     |
    Et je vois mes données utilisateur:
      | champ         | présent |
      | id            | oui     |
      | email         | oui     |
      | created_at    | oui     |
      | last_sign_in  | oui     |
      | auth_provider | oui     |

  @AC1 @rgpd @data-export @empty-data
  Scénario: Export sans données (nouveau compte)
    Étant donné que je suis un nouvel utilisateur
    Et que je n'ai aucune capture
    Quand je demande un export de données
    Alors un fichier ZIP est quand même généré
    Et le ZIP contient uniquement user-profile.json
    Et les autres fichiers JSON sont vides ou absents
    Et le dossier audios/ est vide

  # ============================================================================
  # AC2: Account Deletion (Article 17 RGPD - Droit à l'oubli)
  # ============================================================================

  @AC2 @rgpd @account-deletion
  Scénario: Suppression de compte avec confirmation
    Étant donné que je suis connecté
    Quand je tape sur "Supprimer mon compte" dans les paramètres
    Alors un dialog d'avertissement RGPD est affiché
    Et le dialog explique que la suppression est IRRÉVERSIBLE
    Et je dois saisir mon password pour confirmer
    Quand je saisis mon password correct
    Et je confirme la suppression
    Alors mon compte d'authentification est supprimé
    Et toutes mes données PostgreSQL sont supprimées
    Et tous mes fichiers audio MinIO sont supprimés
    Et mes données locales WatermelonDB sont supprimées
    Et je suis déconnecté et redirigé vers l'écran de login

  @AC2 @rgpd @account-deletion @wrong-password
  Scénario: Tentative de suppression avec mauvais password
    Étant donné que je suis sur l'écran de suppression de compte
    Quand je saisis un password incorrect
    Et je tente de confirmer la suppression
    Alors une erreur "Password incorrect" est affichée
    Et mon compte n'est PAS supprimé
    Et je reste connecté

  @AC2 @rgpd @account-deletion @data-cleanup
  Scénario: Vérification du nettoyage complet des données
    Étant donné que j'ai supprimé mon compte
    Quand je vérifie les sources de données
    Alors aucune trace de mes données n'existe dans:
      | source                  | statut     |
      | Better Auth             | supprimé   |
      | PostgreSQL Homelab      | supprimé   |
      | MinIO Homelab (audios)  | supprimé   |
      | WatermelonDB (local)    | supprimé   |

  @AC2 @rgpd @account-deletion @cascade
  Scénario: Suppression en cascade de toutes les entités liées
    Étant donné que j'ai:
      | entité          | quantité |
      | Captures        | 50       |
      | Transcriptions  | 50       |
      | AI Digests      | 25       |
      | Actions/Todos   | 100      |
      | Audio files     | 50       |
    Quand je supprime mon compte
    Alors toutes ces entités sont supprimées en cascade
    Et aucun orphelin ne reste dans la base de données

  # ============================================================================
  # AC3: RGPD Compliance Audit Trail
  # ============================================================================

  @AC3 @rgpd @audit-log @export
  Scénario: Log d'export de données
    Étant donné que je demande un export de données
    Quand l'export est généré
    Alors une entrée de log est créée avec:
      | champ          | valeur                     |
      | event_type     | RGPD_DATA_EXPORT           |
      | user_id        | mon user_id                |
      | timestamp      | date/heure de l'export     |
      | export_size_mb | taille du ZIP généré       |
      | ip_address     | mon adresse IP             |

  @AC3 @rgpd @audit-log @deletion
  Scénario: Log de suppression de compte
    Étant donné que je supprime mon compte
    Quand la suppression est confirmée
    Alors une entrée de log est créée avec:
      | champ       | valeur                        |
      | event_type  | RGPD_ACCOUNT_DELETION         |
      | user_id     | mon user_id (avant suppression) |
      | timestamp   | date/heure de la suppression  |
      | ip_address  | mon adresse IP                |
    Et ce log est conservé 5 ans pour conformité légale
    Et le log ne contient AUCUNE donnée personnelle (sauf user_id et IP)

  # ============================================================================
  # Edge Cases & Security
  # ============================================================================

  @edge-case @export @concurrent
  Scénario: Demande d'export multiple simultanée
    Étant donné que j'ai déjà une demande d'export en cours
    Quand je demande un nouvel export
    Alors un message "Export déjà en cours" est affiché
    Et la demande précédente continue
    Et aucune duplication n'est créée

  @edge-case @deletion @oauth
  Scénario: Suppression de compte OAuth (Google/Apple)
    Étant donné que je suis connecté via Google OAuth
    Quand je supprime mon compte Pensieve
    Alors mon compte Pensieve est supprimé
    Mais mon compte Google reste inchangé
    Et un message informe que le compte Google n'est pas affecté

  @edge-case @deletion @offline
  Scénario: Tentative de suppression hors ligne
    Étant donné que l'appareil est hors ligne
    Quand je tente de supprimer mon compte
    Alors une erreur "Connexion Internet requise" est affichée
    Et la suppression n'est pas effectuée
    Et mes données locales restent intactes

  @edge-case @export @failed-generation
  Scénario: Échec de génération du ZIP d'export
    Étant donné que je demande un export
    Et que le serveur MinIO est indisponible
    Quand l'export échoue
    Alors un message d'erreur clair est affiché
    Et je peux réessayer plus tard
    Et une notification m'informe de l'échec

  # ============================================================================
  # RGPD Timing Requirements
  # ============================================================================

  @rgpd @timing @export
  Scénario: Délai maximum pour export de données (Article 15)
    Étant donné que je demande un export de données
    Alors l'export DOIT être disponible sous 30 jours maximum
    Et idéalement sous 24 heures pour datasets < 1 GB

  @rgpd @timing @deletion
  Scénario: Délai maximum pour suppression de compte (Article 17)
    Étant donné que je demande la suppression de mon compte
    Alors la suppression DOIT être effective sous 30 jours maximum
    Et idéalement immédiate (< 5 minutes) pour la plupart des cas

  # ============================================================================
  # User Communication
  # ============================================================================

  @rgpd @communication @export-email
  Scénario: Email de notification d'export prêt
    Étant donné que j'ai demandé un export (> 100 MB, async)
    Quand l'export est terminé
    Alors je reçois un email contenant:
      | élément            | présent |
      | Lien de téléchargement | oui  |
      | Date d'expiration (24h) | oui |
      | Taille du fichier       | oui |
      | Instructions RGPD       | oui |

  @rgpd @communication @deletion-confirmation
  Scénario: Confirmation de suppression de compte
    Étant donné que mon compte a été supprimé
    Alors je reçois un email de confirmation contenant:
      | élément                      | présent |
      | Confirmation de suppression  | oui     |
      | Date de suppression          | oui     |
      | Rappel droit de recours      | oui     |
      | Contact DPO si questions     | oui     |
