# Prompt Engineering Documentation
## Story 4.2 - Digestion IA - Résumé et Idées Clés

**Subtask 2.5: Document prompt engineering decisions and examples**

## Overview

This document describes the prompt engineering strategy for GPT-4o-mini digestion of user captures. The goal is to extract concise summaries and key ideas from both text and audio captures while maintaining the user's voice and intent.

## Model Configuration

- **Model:** `gpt-4o-mini`
- **Temperature:** `0.7` - Balanced between creativity and consistency
- **Max Tokens:** `500` - Enforces concise summaries
- **Timeout:** `30s` (NFR3 requirement)
- **Response Format:** JSON mode for structured output

## System Prompt Design

### Design Principles

1. **Clarity of Role:** Define the AI as a specialized assistant for personal thought analysis
2. **Explicit Instructions:** Provide clear guidelines on output format and constraints
3. **Quality over Quantity:** Emphasize concise, high-quality insights (1-5 ideas max)
4. **User Voice Preservation:** Instruct to maintain the user's original intent and voice
5. **Best-Effort for Edge Cases:** Handle unclear or minimal content gracefully

### System Prompt

```
You are an AI assistant specialized in analyzing personal thoughts and ideas.
Your goal is to extract the essence of the user's thought and identify key insights.

For each thought provided:
1. Generate a concise summary (2-3 sentences maximum) that captures the core message.
2. Extract key ideas as bullet points (1-5 ideas maximum, prioritize quality over quantity).

Guidelines:
- Be concise and precise.
- Focus on actionable insights and meaningful themes.
- If the thought is unclear or minimal, provide a best-effort summary.
- Preserve the user's voice and intent.
- Do not add information not present in the original thought.

You must respond with valid JSON in this exact format:
{
  "summary": "string",
  "ideas": ["idea 1", "idea 2", ...],
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
- **Confidence:** Enum validation (high/medium/low) with default 'high'
- **Whitespace Check:** Prevents empty strings that pass length checks

## Example Inputs and Expected Outputs

### Example 1: Text Capture - Product Idea

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
  "confidence": "high"
}
```

### Example 2: Audio Capture - Freelance Observation

**Input (transcription):**
```
Hier j'ai croisé un freelance qui galère avec sa compta. C'est le 3ème ce mois-ci. Il y a clairement un truc à faire là-dessus.
```

**Expected Output:**
```json
{
  "summary": "L'utilisateur observe un pattern récurrent: trois freelances rencontrés ce mois ont des difficultés avec leur comptabilité. Il identifie une opportunité de marché potentielle.",
  "ideas": [
    "Pain point récurrent: gestion comptable pour freelances",
    "Validation de marché: 3 occurrences en un mois",
    "Opportunité produit/service pour freelances"
  ],
  "confidence": "high"
}
```

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
**Story:** 4.2 - Digestion IA - Résumé et Idées Clés
