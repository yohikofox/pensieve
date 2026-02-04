# Prompt Engineering Documentation
## Story 4.2 - Digestion IA - Résumé et Idées Clés
## Story 4.3 - Extraction Automatique d'Actions

**Subtask 2.5 (Story 4.2): Document prompt engineering decisions and examples**
**Subtask 1.5 (Story 4.3): Document todo extraction guidelines**

## Overview

This document describes the prompt engineering strategy for GPT-4o-mini digestion of user captures. The goal is to extract concise summaries, key ideas, and actionable todos from both text and audio captures while maintaining the user's voice and intent.

**Story 4.3 Enhancement:** Single LLM call now extracts summary + ideas + todos in one API request (ADR-004 compliance).

## Model Configuration

- **Model:** `gpt-4o-mini`
- **Temperature:** `0.7` - Balanced between creativity and consistency
- **Max Tokens:** `500` - Enforces concise summaries (may need increase for todos)
- **Timeout:** `30s` (NFR3 requirement)
- **Response Format:** JSON mode for structured output
- **Story 4.3:** Single call extracts summary + ideas + todos (ADR-004)

## System Prompt Design

### Design Principles

1. **Clarity of Role:** Define the AI as a specialized assistant for personal thought analysis
2. **Explicit Instructions:** Provide clear guidelines on output format and constraints
3. **Quality over Quantity:** Emphasize concise, high-quality insights (1-5 ideas max)
4. **User Voice Preservation:** Instruct to maintain the user's original intent and voice
5. **Best-Effort for Edge Cases:** Handle unclear or minimal content gracefully
6. **Selective Todo Detection (Story 4.3):** Only extract genuine action items, not forced todos

### System Prompt (Enhanced for Story 4.3)

```
You are an AI assistant specialized in analyzing personal thoughts and ideas.
Your goal is to extract the essence of the user's thought, identify key insights, and detect actionable tasks.

For each thought provided:
1. Generate a concise summary (2-3 sentences maximum) that captures the core message.
2. Extract key ideas as bullet points (1-5 ideas maximum, prioritize quality over quantity).
3. Detect actionable tasks/todos (0-10 maximum, be selective - only real actions).

Guidelines for summary and ideas:
- Be concise and precise.
- Focus on actionable insights and meaningful themes.
- If the thought is unclear or minimal, provide a best-effort summary.
- Preserve the user's voice and intent.
- Do not add information not present in the original thought.

Guidelines for todo extraction:
- A todo is an action the user needs to take (verbs: send, call, buy, finish, etc.)
- Extract deadline if mentioned (e.g., "by Friday", "tomorrow", "in 3 days")
- Infer priority from context:
  - HIGH: urgent, ASAP, critical, deadline-driven
  - MEDIUM: important, should do, need to
  - LOW: maybe, when I have time, nice to have
- If no clear action, do NOT force todo extraction - return empty array
- Preserve the user's voice in todo description

You must respond with valid JSON in this exact format:
{
  "summary": "string",
  "ideas": ["idea 1", "idea 2", ...],
  "todos": [
    {
      "description": "actionable task description",
      "deadline": "deadline text if mentioned (e.g., 'Friday', 'tomorrow') or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high" | "medium" | "low"
}
```

### Rationale

- **Specialization:** Sets context for personal thought analysis (not general Q&A)
- **Constraints:** 2-3 sentences for summary, 1-5 ideas max prevents verbosity
- **Best-Effort Clause:** Handles edge cases (minimal content, unclear thoughts)
- **JSON Format:** Ensures structured, parseable responses
- **Confidence Field:** Optional indicator for low-quality input detection

## User Prompt Template

### Template Structure

```typescript
const userPrompt = `
Analyze the following ${contentType === 'text' ? 'text' : 'transcribed audio'} thought:

"""
${content}
"""

Provide:
1. A concise summary (2-3 sentences)
2. Key ideas (bullet points, 1-5 ideas)

Response format (JSON):
{
  "summary": "string",
  "ideas": ["idea 1", "idea 2", ...],
  "confidence": "high" | "medium" | "low"
}`;
```

### Content Type Adaptation

- **Text Captures:** "text thought" - direct analysis of written content
- **Audio Captures:** "transcribed audio thought" - acknowledges spoken nature, may have informal structure

### Rationale

- **Content Type Label:** Helps model adjust tone/style based on input modality
- **Triple Quotes:** Clearly demarcate user content from instructions
- **Explicit Format Reminder:** Reduces format errors in JSON output

## Response Schema Validation

### Zod Schema

```typescript
export const DigestionResponseSchema = z.object({
  summary: z
    .string()
    .min(10, 'Summary must be at least 10 characters')
    .max(500, 'Summary must not exceed 500 characters')
    .refine((val) => val.trim().length > 0, {
      message: 'Summary cannot be empty or whitespace only',
    }),

  ideas: z
    .array(
      z
        .string()
        .min(5, 'Each idea must be at least 5 characters')
        .max(200, 'Each idea must not exceed 200 characters')
        .refine((val) => val.trim().length > 0, {
          message: 'Idea cannot be empty or whitespace only',
        }),
    )
    .min(1, 'At least one idea is required')
    .max(10, 'Maximum 10 ideas allowed'),

  confidence: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .default('high'),
});
```

### Validation Rules

- **Summary:** 10-500 characters (enforces conciseness, prevents empty responses)
- **Ideas:** 1-10 ideas, each 5-200 characters (quality over quantity)
- **Todos (Story 4.3):** 0-10 todos, each with:
  - **Description:** 3-200 characters (actionable task description)
  - **Deadline:** 0-50 characters or null (natural language deadline text)
  - **Priority:** Enum (low/medium/high) - inferred from content
- **Confidence:** Enum validation (high/medium/low) with default 'high'
- **Whitespace Check:** Prevents empty strings that pass length checks

## Example Inputs and Expected Outputs

### Example 1: Text Capture - Product Idea (No Todos)

**Input:**
```
Je veux créer une app mobile pour gérer mes tâches quotidiennes. Frustré par Todoist qui est trop complexe.
```

**Expected Output:**
```json
{
  "summary": "L'utilisateur souhaite développer une application mobile de gestion de tâches plus simple que Todoist. Il identifie un besoin pour une solution moins complexe.",
  "ideas": [
    "Opportunité de créer une app de todo simplifiée",
    "Pain point: complexité de Todoist",
    "Marché cible: utilisateurs frustrés par les outils existants"
  ],
  "todos": [],
  "confidence": "high"
}
```

**Note (Story 4.3):** No todos extracted because this is an observation/idea, not an actionable task.

### Example 2: Audio Capture - Freelance Observation with Action (Story 4.3)

**Input (transcription):**
```
Hier j'ai croisé un freelance qui galère avec sa compta. C'est le 3ème ce mois-ci. Il y a clairement un truc à faire là-dessus. Faut que je regarde Pennylane et Indy cette semaine.
```

**Expected Output:**
```json
{
  "summary": "L'utilisateur observe un pattern récurrent: trois freelances rencontrés ce mois ont des difficultés avec leur comptabilité. Il identifie une opportunité de marché potentielle et veut explorer des solutions existantes.",
  "ideas": [
    "Pain point récurrent: gestion comptable pour freelances",
    "Validation de marché: 3 occurrences en un mois",
    "Opportunité produit/service pour freelances"
  ],
  "todos": [
    {
      "description": "Regarder Pennylane et Indy",
      "deadline": "cette semaine",
      "priority": "medium"
    }
  ],
  "confidence": "high"
}
```

**Note (Story 4.3):** One todo extracted with deadline "cette semaine" and medium priority (implied by "faut que je" = should do).

### Example 3: Minimal Content - Edge Case

**Input:**
```
Ok cool
```

**Expected Output:**
```json
{
  "summary": "L'utilisateur exprime son approbation de manière concise. Le contexte manquant rend difficile l'extraction d'insights plus détaillés.",
  "ideas": [
    "Réaction positive à quelque chose"
  ],
  "confidence": "low"
}
```

**Note:** Low confidence flag indicates limited insight extraction due to minimal content.

### Example 3b: Multiple Todos with Deadline and Priority (Story 4.3)

**Input:**
```
Faut que je pense à envoyer la facture à Mme Micheaux avant vendredi. C'est urgent. J'ai encore croisé un freelance qui galère avec sa compta, c'est le 3ème ce mois-ci. Acheter du lait en rentrant.
```

**Expected Output:**
```json
{
  "summary": "Reminder de facture urgente, observation récurrente sur pain point compta freelance, course à faire.",
  "ideas": [
    "Pain point compta freelance (récurrence)",
    "Opportunité produit compta simplifiée"
  ],
  "todos": [
    {
      "description": "Envoyer facture Mme Micheaux",
      "deadline": "vendredi",
      "priority": "high"
    },
    {
      "description": "Analyser solutions compta freelance",
      "deadline": null,
      "priority": "medium"
    },
    {
      "description": "Acheter lait",
      "deadline": "aujourd'hui",
      "priority": "low"
    }
  ],
  "confidence": "high"
}
```

**Note (Story 4.3):**
- Three todos extracted from single capture (AC5: 1-to-Many relationship)
- First todo: HIGH priority (keyword "urgent"), specific deadline "vendredi" (AC4)
- Second todo: MEDIUM priority (implied action from observation), no deadline (AC3)
- Third todo: LOW priority (simple errand), deadline inferred as "aujourd'hui" (AC3)

### Example 4: Long Content - Meeting Notes

**Input:**
```
Réunion avec Paul aujourd'hui. Il veut lancer un side project dans la logistique. Problème: les petits transporteurs n'ont pas de système de dispatch moderne. Paul connaît bien le secteur, 15 ans d'expérience. Budget limité pour un MVP. On pourrait commencer avec une simple app mobile pour les chauffeurs. Integration API avec les plateformes existantes type Chronotruck. Potentiel intéressant mais il faut valider le marché.
```

**Expected Output:**
```json
{
  "summary": "Discussion avec Paul sur un projet de système de dispatch pour petits transporteurs. Il possède une expertise de 15 ans dans le secteur. L'approche envisagée: MVP mobile pour chauffeurs avec intégration API aux plateformes existantes.",
  "ideas": [
    "Opportunité: système de dispatch moderne pour petits transporteurs",
    "Atout: expertise de 15 ans de Paul dans la logistique",
    "MVP: app mobile pour chauffeurs",
    "Stratégie technique: intégration API (ex: Chronotruck)",
    "Next step: validation de marché nécessaire"
  ],
  "confidence": "high"
}
```

## Fallback Strategy

### Primary Prompt Failure Scenarios

1. **Malformed JSON:** GPT returns non-JSON content
2. **Validation Failure:** JSON structure doesn't match schema (missing fields, wrong types)
3. **Empty Response:** No content in response choices
4. **Timeout:** API call exceeds 30s limit

### Fallback Approach (Subtask 2.6)

If primary prompt fails after retry:

1. **Simpler Prompt:** Remove JSON formatting requirement, use plain text
2. **Reduced Constraints:** Ask only for summary (no ideas extraction)
3. **Manual Parsing:** Parse plain text response and structure it
4. **Mark Low Confidence:** Flag result with `confidence: 'low'`

**Fallback Prompt Template:**
```
Summarize this thought in 2-3 sentences:

"""
${content}
"""

Just provide a plain text summary.
```

### Rationale

- Some edge cases may confuse JSON formatting instructions
- Plain text responses are more reliable for very short/unclear content
- Degraded functionality is better than complete failure
- Low confidence flag alerts user to review original content

## Todo Extraction Best Practices (Story 4.3)

### What Makes a Good Todo

✅ **Extract:**
- Action verbs: "Send invoice", "Call client", "Buy groceries", "Finish report"
- User's explicit intentions: "Faut que je...", "Je dois...", "N'oublie pas de..."
- Implicit actions from context: "Meeting with Paul tomorrow" → "Prepare for meeting with Paul"

❌ **Don't Extract:**
- Observations without action: "Il fait beau" (no action)
- Completed past actions: "J'ai envoyé l'email" (already done)
- Questions without commitment: "Et si je faisais...?" (speculation)
- Vague intentions: "Il faudrait peut-être..." (no commitment)

### Priority Inference Keywords

**High Priority:**
- "urgent", "ASAP", "critique", "immédiatement", "au plus vite"
- Deadline-driven: "avant vendredi", "today", "demain matin"
- Consequences mentioned: "sinon je rate...", "client important"

**Medium Priority:**
- "important", "faut que je", "je dois", "n'oublie pas"
- "cette semaine", "bientôt", "rapidement"
- Default when no priority indicators

**Low Priority:**
- "peut-être", "quand j'ai le temps", "un jour", "nice to have"
- "si possible", "éventuellement", "pas urgent"

### Deadline Parsing Examples

The AI extracts deadline **text** (not parsed dates - that's done by DeadlineParserService in Task 3):

- "Friday" → `deadline: "Friday"`
- "avant vendredi" → `deadline: "avant vendredi"`
- "tomorrow" → `deadline: "tomorrow"`
- "in 3 days" → `deadline: "in 3 days"`
- "cette semaine" → `deadline: "cette semaine"`
- No mention → `deadline: null`

### Edge Cases

**Multiple actions from single sentence:**
```
"Envoyer facture et appeler client"
→ Todo 1: "Envoyer facture"
→ Todo 2: "Appeler client"
```

**Action embedded in observation:**
```
"J'ai vu Paul, il faudrait qu'on reparle du projet"
→ Todo: "Reparler du projet avec Paul"
```

**No action despite imperative tone:**
```
"Il faut vraiment que quelqu'un fasse quelque chose pour la compta des freelances"
→ No todo (general observation, no specific action for the user)
```

## Performance Considerations

### Token Optimization

- **System Prompt:** ~150 tokens (fixed cost per request)
- **User Prompt Template:** ~50 tokens (fixed)
- **User Content:** Variable (0-4000 tokens per chunk)
- **Response:** ~100-200 tokens average

**Total per request:** ~300-400 tokens for standard captures

### Latency Target

- **NFR3 Requirement:** < 30 seconds per digestion
- **Typical Performance:** 2-5 seconds for standard captures
- **Long Content (>4000 tokens):** Sequential chunking may take 10-20 seconds

## Testing Strategy

### Test Coverage (Subtask 2.4)

1. **Short Text Captures:** <100 characters
2. **Standard Text Captures:** 100-500 characters
3. **Long Text Captures:** >500 characters
4. **Short Audio Transcriptions:** <50 words
5. **Standard Audio Transcriptions:** 50-200 words
6. **Long Audio Transcriptions:** >200 words
7. **Edge Cases:** Minimal content ("ok", "cool"), empty strings
8. **Multi-Language:** French (primary), English, mixed
9. **Special Characters:** Emojis, punctuation, code snippets

### Manual Validation

Before production release:
- Test with 10-20 real user captures from various contexts
- Validate summary quality and idea extraction accuracy
- Check for hallucinations or added information
- Verify tone/voice preservation

## Lessons Learned

### What Works Well

- **JSON Mode:** Dramatically reduces parsing errors
- **Explicit Constraints:** 2-3 sentences and 1-5 ideas prevents verbosity
- **Confidence Field:** Useful for flagging low-quality extractions
- **Content Type Label:** Helps model adapt to text vs audio input

### Common Failure Modes

- **Very Short Content (<10 words):** Model struggles to extract meaningful insights
- **Code Snippets:** May confuse the model if not in proper context
- **Multiple Topics:** Can lead to unfocused summaries; may need chunk-based approach

### Future Improvements

- **User Feedback Loop:** Collect thumbs up/down on summaries to refine prompts
- **Personalization:** Adjust temperature/tone based on user preferences
- **Category Detection:** Auto-classify captures (product ideas, meeting notes, personal reflections)
- **Multi-Turn Refinement:** Allow user to request more detail or different perspective

## References

- [OpenAI GPT-4o-mini Documentation](https://platform.openai.com/docs/models/gpt-4o-mini)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- Story 4.2 Dev Notes: Prompt Engineering Strategy section
- Architecture Document: NFR3 (Digestion < 30s)

---

**Last Updated:** 2026-02-04
**Author:** Dev Agent (Claude Sonnet 4.5)
**Stories:**
- 4.2 - Digestion IA - Résumé et Idées Clés
- 4.3 - Extraction Automatique d'Actions (Todo Detection Enhancement)
