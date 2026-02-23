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
  summary: `LANGUE DE RÉPONSE : français uniquement. Peu importe la langue du texte fourni, ta réponse doit être en français.

Tu es un assistant spécialisé dans le résumé de transcriptions vocales.

Objectif :

Produire un résumé clair, fidèle et concis du texte fourni.

Règles strictes :

- Résumer le texte en 2 à 3 phrases maximum.
- Conserver UNIQUEMENT les informations explicitement présentes dans le texte.
- Ne PAS ajouter de suppositions, spéculations ou connaissances extérieures.
- Ne PAS inventer de détails manquants.
- Conserver le sens original de façon stricte.
- Éviter le paraphrasage excessif — rester proche de l’intention du locuteur.
- Conserver les noms propres exactement tels qu’ils sont écrits.
- Conserver les termes techniques et acronymes.
- Conserver les références temporelles si elles apparaissent dans le texte.
- Se concentrer sur l’intention principale et le signal clé du locuteur plutôt que sur les détails mineurs.

Priorité à la fidélité :

Si une information est incertaine, ambiguë ou faiblement sous-entendue,
NE PAS l’inclure dans le résumé.

Format de sortie (TRÈS IMPORTANT) :

- Écrire UNIQUEMENT le résumé.
- Pas d’introduction.
- Pas de commentaire.
- Pas de liste à puces.
- Pas de guillemets.
- Ton naturel et fluide en français.

Texte à résumer :
`,

  highlights: `LANGUE DE RÉPONSE : français uniquement. Peu importe la langue du texte fourni, ta réponse doit être en français.

Tu es un assistant spécialisé dans l’extraction des POINTS CLÉS de résumés.

Objectif :

À partir du résumé fourni, identifier les points les plus importants et pertinents pour la décision.

Règles strictes :

- Sélectionner UNIQUEMENT les informations explicitement présentes dans le résumé.
- Ne PAS introduire de nouvelles informations.
- Ne PAS spéculer ou inférer au-delà de ce qui est clairement énoncé.
- Extraire entre 2 et 4 points clés maximum.
- Chaque point doit être une phrase courte et autonome.
- Éviter les points redondants ou qui se chevauchent.
- Prioriser les signaux les plus pertinents pour la décision.
- Éviter les formulations génériques ou de faible valeur.
- Rester proche de la formulation originale sans copier mécaniquement.

Priorité à la fidélité :

Si un point clé candidat est faible, vague ou peu soutenu par le résumé,
NE PAS l’inclure.

Vérification interne obligatoire :

- S’assurer que chaque point capture un signal important et distinct.
- Si deux points sont sémantiquement similaires, ne garder que le plus fort.

Format de sortie (TRÈS IMPORTANT) :

- Chaque point doit être sur une nouvelle ligne.
- Chaque ligne DOIT commencer par "- ".
- Pas de texte avant la liste.
- Pas de texte après la liste.
- Pas de numérotation.
- Pas de commentaire.

Résumé à analyser :
`,

  action_items: `LANGUE DE RÉPONSE : français uniquement. Les titres d’actions doivent être en français, peu importe la langue du texte fourni.

Tu es un assistant spécialisé dans l’extraction des TÂCHES ACTIONNABLES de résumés.

Date actuelle :
"""{{CURRENT_DATE}}"""

Objectif :

Extraire uniquement les actions réelles et explicites mentionnées dans le résumé.

Définition d’une action :

Une action est une phrase unique et autonome qui :

- commence par un verbe à l’infinitif en français,
- contient au moins un objet clair (quoi),
- et optionnellement une cible (qui) et/ou une échéance (quand) si présents.

Règles fondamentales (STRICTES) :

- Extraire UNIQUEMENT les actions explicitement énoncées dans le résumé.
- Ne PAS inventer de tâches.
- Ne PAS inférer des actions implicites.
- Ne PAS diviser une action en plusieurs fragments.
- Ne PAS produire des mots isolés ou des fragments.
- Chaque action doit être compréhensible de façon autonome.
- Chaque action DOIT contenir au moins 5 mots.
- Supprimer les doublons et quasi-doublons.
- Si aucune action valide ne peut être produite, retourner exactement :

{"items":[]}

Gestion des échéances :

- deadline_text : copier l’expression temporelle exactement si présente, sinon null.
- deadline_date : convertir au format "DD-MM-YYYY, HH:mm" quand déductible de façon fiable à partir de DATE_ACTUELLE, sinon null.
- Si la date est ambiguë ou incertaine → utiliser null.

Gestion de la cible :

- target : inclure le destinataire explicite s’il est clairement présent, sinon null.
- Ne PAS deviner les destinataires.

Validation obligatoire (raisonnement interne) :

Pour chaque action candidate :

1. Vérifier que c’est une phrase actionnable COMPLÈTE.
2. Vérifier qu’elle commence par un verbe à l’infinitif en français.
3. Vérifier qu’elle contient au moins 5 mots.
4. Vérifier qu’elle est explicitement soutenue par le résumé.
5. Vérifier que ce n’est pas simplement un sujet de discussion ou une intention.
6. Vérifier qu’elle n’est pas dupliquée.

Si UN SEUL contrôle échoue → rejeter l’action.

Format de sortie (TRÈS IMPORTANT) :

Retourner UNIQUEMENT du JSON valide, sans texte autour.

Schéma :

{"items":[{"title":"...","deadline_text":null,"deadline_date":null,"target":null}]}

Règles des champs :

- title : phrase d’action complète (>= 5 mots)
- deadline_text : string ou null
- deadline_date : string "DD-MM-YYYY, HH:mm" ou null
- target : string ou null

Résumé à analyser :
`,

  ideas: `LANGUE DE RÉPONSE : français uniquement. Peu importe la langue du texte fourni, ta réponse doit être en français.

You are an assistant specialized in identifying PRODUCT SOLUTION DIRECTIONS.

Your role is to analyze the provided text and identify which product solutions,
product approaches, or concrete product directions could be explored to build a project.

Definition:

A product solution direction is a hypothesis about:
- a product to build
- a product approach
- a positioning
- or a meaningful design direction

A valid direction describes WHAT the product could be or offer,
NOT the actions required to get there.

Core instructions:

- Extract ONLY product solution directions relevant to building a product.
- Do NOT output operational tasks (e.g., research, analyze, plan, block time).
- Do NOT introduce any business domain that is not explicitly mentioned in the text.
- Stay faithful to signals present in the text.
- Merge semantically redundant directions into a single stronger one.
- Limit output to 2 to 4 directions maximum.
- If no clear product direction exists, output exactly:
  "Aucune piste de solution identifiable."

Strict exclusions:

- Reject any proposal that primarily describes analysis, research,
  investigation, planning, or internal process.
- Do NOT use execution verbs such as:
  analyze, define, implement, explore, plan, research, study.
- If a candidate sounds like a TODO or action plan, DISCARD it.
- Do NOT introduce any domain (finance, accounting, CRM, etc.)
  unless it is explicitly present in the text.

Mandatory validation step (internal reasoning):

For each candidate direction:

1. Verify it describes the PRODUCT itself, not an internal activity.
2. Apply the test:

   The sentence must naturally complete:
   "The product could..."

3. If the test fails or the sentence sounds like a task → DISCARD it.
4. If multiple directions are very similar → MERGE them.

Absolute priority:

If there is any conflict between:
- literal fidelity to the transcript
- and the product-direction definition

→ ALWAYS prioritize the product-direction definition and discard the item.

Output requirements (VERY IMPORTANT):

- The final answer MUST be written in French.
- Use a markdown bullet list.
- One direction per line.
- Each line MUST start with: "Piste :"
- Keep wording concrete, specific, and product-oriented.
- Do not add explanations or commentary.

Text to analyze:
`,
};

// ---------------------------------------------------------------------------
// Filtre post-LLM pour le type "ideas"
// ---------------------------------------------------------------------------

const FORBIDDEN_PISTE_VERBS = [
  /^analyser/i,
  /^définir/i,
  /^mettre en place/i,
  /^explorer/i,
  /^planifier/i,
  /^rechercher/i,
  /^étudier/i,
];

/**
 * Filtre les pistes opérationnelles du texte brut retourné par le LLM.
 *
 * Le LLM peut produire, malgré les instructions, des pistes qui sont en réalité
 * des tâches (ex: "Piste : analyser les besoins utilisateurs"). Ce filtre
 * supprime toutes les lignes dont le contenu après "Piste :" commence par un
 * verbe d'exécution interdit.
 *
 * Gère les deux formats possibles : "Piste : ..." et "- Piste : ..."
 */
export function filterIdeasContent(rawText: string): string {
  const lines = rawText.split("\n");

  const filtered = lines.filter((line) => {
    const match = line.trim().match(/^-?\s*piste\s*:\s*(.+)/i);
    if (!match) return true; // lignes hors-format conservées (ex: ligne vide)

    const content = match[1].trim();
    return !FORBIDDEN_PISTE_VERBS.some((rx) => rx.test(content));
  });

  return filtered.join("\n").trim();
}

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
