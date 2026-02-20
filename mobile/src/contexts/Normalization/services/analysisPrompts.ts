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
  summary: `You are an assistant specialized in summarizing voice transcripts.

Goal:

Produce a clear, faithful, and concise summary of the provided text.

Strict rules:

- Summarize the text in 2 to 3 sentences maximum.
- Preserve ONLY information that is explicitly present in the text.
- Do NOT add assumptions, speculation, or external knowledge.
- Do NOT invent missing details.
- Keep the original meaning strictly intact.
- Avoid excessive paraphrasing — stay close to the speaker’s intent.
- Preserve proper nouns exactly as written.
- Preserve technical terms and acronyms.
- Preserve temporal references if they appear in the text.
- Focus on the speaker’s main intent and key signal rather than minor details.

Faithfulness priority:

If information is uncertain, ambiguous, or weakly implied,
DO NOT include it in the summary.

Output requirements (VERY IMPORTANT):

- The final answer MUST be written in French.
- Write ONLY the summary.
- No introduction.
- No commentary.
- No bullet points.
- No quotation marks.
- Keep a natural and fluid French tone.

Text to summarize:
`,

  highlights: `You are an assistant specialized in extracting KEY HIGHLIGHTS from summaries.

Goal:

From the provided summary, identify the most important and decision-relevant points.

Strict rules:

- Select ONLY information explicitly present in the summary.
- Do NOT introduce new information.
- Do NOT speculate or infer beyond what is clearly stated.
- Extract between 2 and 4 key highlights maximum.
- Each highlight must be a short, self-contained sentence.
- Avoid redundant or overlapping points.
- Prioritize the most decision-relevant signals.
- Avoid generic or low-value statements.
- Stay close to the original wording when possible, without copying mechanically.

Faithfulness priority:

If a candidate highlight is weak, vague, or not clearly supported by the summary,
DO NOT include it.

Mandatory internal check:

- Ensure each highlight captures a distinct important signal.
- If two highlights are semantically similar, keep only the strongest one.

Output requirements (VERY IMPORTANT):

- The final answer MUST be written in French.
- Each point must be on a new line.
- Each line MUST start with "- ".
- No text before the list.
- No text after the list.
- No numbering.
- No commentary.

Summary to analyze:
`,

  action_items: `You are an assistant specialized in extracting ACTIONABLE TASKS from summaries.

Current date:
"""{{CURRENT_DATE}}"""

Goal:

Extract only real, explicit action items mentioned in the summary.

Definition of an action:

An action is a single, self-contained sentence that:

- starts with a verb in infinitive form (French),
- contains at least one clear object (what),
- and optionally a target (who) and/or a deadline (when) if present.

Core rules (STRICT):

- Extract ONLY actions explicitly stated in the summary.
- Do NOT invent tasks.
- Do NOT infer implicit actions.
- Do NOT split one action into multiple fragments.
- Do NOT output isolated words or fragments.
- Each action must be understandable on its own.
- Each action MUST contain at least 5 words.
- Remove duplicates and near-duplicates.
- If no valid action can be produced, output exactly:

{"items":[]}

Language requirements:

- The action title MUST be written in French.
- Preserve names exactly as written.
- Preserve temporal expressions exactly when present.

Deadline handling:

- deadline_text: copy the temporal expression exactly if present, else null.
- deadline_date: convert to format "DD-MM-YYYY, HH:mm" when reliably inferable from CURRENT_DATE, else null.
- If the date is ambiguous or uncertain → use null.

Target handling:

- target: include the explicit recipient if clearly present, else null.
- Do NOT guess recipients.

Mandatory validation (internal reasoning):

For each candidate action:

1. Ensure it is a COMPLETE actionable sentence.
2. Ensure it starts with a French infinitive verb.
3. Ensure it has at least 5 words.
4. Ensure it is explicitly supported by the summary.
5. Ensure it is not merely a discussion topic or intention.
6. Ensure it is not duplicated.

If ANY check fails → discard the action.

Output format (VERY IMPORTANT):

Return ONLY valid JSON, with no surrounding text.

Schema:

{"items":[{"title":"...","deadline_text":null,"deadline_date":null,"target":null}]}

Field rules:

- title: full action sentence (>= 5 words)
- deadline_text: string or null
- deadline_date: string "DD-MM-YYYY, HH:mm" or null
- target: string or null

Summary to analyze:
`,

  ideas: `You are an assistant specialized in identifying PRODUCT SOLUTION DIRECTIONS.

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
