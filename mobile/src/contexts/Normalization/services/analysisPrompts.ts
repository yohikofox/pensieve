/**
 * Analysis Prompts - French prompts for LLM-based capture analysis
 *
 * Provides system prompts for different types of analysis:
 * - Summary: Concise 2-3 sentence summary
 * - Highlights: 3-5 key points
 * - Action Items: Extracted tasks and actions
 */

import type { AnalysisType } from "../../capture/domain/CaptureAnalysis.model";

/**
 * System prompts for each analysis type
 */
export const ANALYSIS_PROMPTS: Record<AnalysisType, string> = {
  summary: `Tu es un assistant spécialisé dans la synthèse de transcriptions vocales.

Objectif :
Produire un résumé clair et fidèle du texte fourni.

Règles strictes :
- Résume le texte en 2 à 3 phrases maximum
- Conserve uniquement les informations réellement présentes dans le texte
- Ne fais aucune supposition ni interprétation
- Ne reformule pas excessivement
- Ne change pas le sens original
- Utilise la même langue que le texte d'entrée
- Conserve les noms propres tels quels
- Conserve les termes techniques et acronymes
- Conserve les marques temporelles si présentes

Sortie :
- Écris uniquement le résumé
- Sans introduction
- Sans commentaire

TEXTE À RÉSUMER :
`,

  highlights: `Tu es un assistant spécialisé dans l'extraction de points clés.

Objectif :
À partir du résumé fourni, identifier les éléments les plus importants.

Règles strictes :
- Sélectionne uniquement les informations explicitement mentionnées dans le résumé
- Identifie entre 2 et 4 points clés maximum
- Une phrase courte par point
- Ne reformule pas inutilement
- Ne fais aucune supposition
- Utilise la même langue que le résumé

Format de sortie :
- Chaque point sur une nouvelle ligne
- Commence chaque ligne par un tiret (-)
- Aucun texte avant ou après la liste

RÉSUMÉ À ANALYSER :
`,

  action_items: `Tu extrais des actions (tâches) à partir d'un résumé.

Paramètres:
- date actuelle: """{{CURRENT_DATE}}"""

Définition d'une action :
- Une action est UNE phrase complète, compréhensible seule.
- Elle commence par un verbe à l'infinitif.
- Elle contient au minimum un objet (quoi) et si possible un destinataire (à qui) et/ou une échéance (quand) si présents.

Règles STRICTES :
- Extrais uniquement les actions mentionnées dans le résumé
- Interdit de répondre avec des mots isolés (ex: "Envoyer", "Jeudi", "Avant", "Madame Michu").
- Interdit de répéter la même action.
- Interdit de découper une action en fragments.
- Si tu ne peux pas produire une phrase complète, réponds exactement : "Aucune action identifiée"

Contraintes de format :
- 1 action par ligne
- Chaque ligne commence par "- "
- Chaque action doit contenir AU MOINS 5 mots.
- Aucune ligne ne doit être un seul mot.

Exemples :
Résumé: "La réunion a conclu qu'il faut envoyer la facture à Madame Michu avant jeudi prochain."

Sortie correcte:
Retourne UNIQUEMENT un JSON valide, sans texte autour, format :

{"items":[{"title":"...","deadline_text":null,"deadline_date":null,"target":null}]}

- title: action complète (>=5 mots)
- deadline_text: échéance recopiée si présente (ex: "avant jeudi prochain") sinon null
- deadline_date: échéance au format "JJ-MM-AAAA, HH:mm" si identifiable sinon null, déduite par rapport à la date actuelle
- target: destinataire si présent (ex: "Madame Michu") sinon null

Sorties incorrectes (à NE PAS faire):
- Envoyer
- Madame Michu
- Jeudi

RÉSUMÉ À ANALYSER :
`,

  ideas: `Tu es un assistant spécialisé dans l'extraction d'idées créatives et novatrices.

Ton rôle est d'analyser le texte suivant et d'identifier toutes les idées, concepts, propositions ou réflexions intéressantes qui y sont exprimées.

Instructions :
- Extrais UNIQUEMENT les idées présentes dans le texte (pas d'interprétation excessive)
- Identifie les idées explicites ET implicites
- Garde les formulations originales autant que possible
- Organise les idées de manière claire et structurée
- Une idée = une ligne/bullet point
- Si aucune idée n'est présente, réponds : "Aucune idée identifiable."

Format de sortie :
- Liste à puces (markdown)
- Une idée par ligne
- Courte et concise

Texte à analyser :
`,
};

/**
 * Format a date in French format for prompts
 * Example: "dimanche 26 janvier 2025, 14:30"
 *
 * @param date - The date to format (defaults to current date)
 */
function formatDateFrench(date: Date = new Date()): string {
  const days = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
  ];
  const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${dayName} ${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Prepare a prompt by replacing template variables
 *
 * Supported variables:
 * - {{CURRENT_DATE}} - Reference date in French format
 *
 * @param prompt - The raw prompt template
 * @param referenceDate - The date to use for {{CURRENT_DATE}} (e.g., capture creation date)
 * @returns The prompt with variables replaced
 */
function preparePrompt(prompt: string, referenceDate?: Date): string {
  const dateStr = formatDateFrench(referenceDate);
  return prompt.replace(/\{\{CURRENT_DATE\}\}/g, dateStr);
}

/**
 * Get the full prompt for a specific analysis type
 *
 * @param type - The type of analysis
 * @param text - The text to analyze
 * @param referenceDate - The reference date for {{CURRENT_DATE}} (e.g., capture creation date)
 * @returns The complete prompt including the text
 */
export function getAnalysisPrompt(
  type: AnalysisType,
  text: string,
  referenceDate?: Date,
): string {
  const preparedPrompt = preparePrompt(ANALYSIS_PROMPTS[type], referenceDate);
  return preparedPrompt + text;
}

/**
 * Get the system prompt for a specific analysis type (with variables replaced)
 *
 * @param type - The type of analysis
 * @param referenceDate - The reference date for {{CURRENT_DATE}} (e.g., capture creation date)
 * @returns The prepared system prompt
 */
export function getPreparedSystemPrompt(
  type: AnalysisType,
  referenceDate?: Date,
): string {
  return preparePrompt(ANALYSIS_PROMPTS[type], referenceDate);
}

/**
 * Labels for each analysis type (French)
 */
export const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  summary: "Resume",
  highlights: "Points cles",
  action_items: "Actions",
  ideas: "Idees",
};

/**
 * Icons for each analysis type
 */
export const ANALYSIS_ICONS: Record<AnalysisType, string> = {
  summary: "\uD83D\uDCDD",
  highlights: "\uD83D\uDCA1",
  action_items: "\u2705",
  ideas: "\uD83E\uDDE0",
};
