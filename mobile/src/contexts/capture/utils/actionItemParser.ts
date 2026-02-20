/**
 * Action Item Parser Utilities
 *
 * Utilities for parsing and formatting action items from LLM JSON output
 */

/** Action item structure from LLM JSON output */
export interface ActionItem {
  title: string;
  deadline_text: string | null;
  deadline_date: string | null; // Format: "JJ-MM-AAAA, HH:mm"
  target: string | null;
}

/**
 * Format a deadline date for display
 * @param dateStr - Date string in format "JJ-MM-AAAA, HH:mm"
 * @returns Formatted date string (e.g., "Aujourd'hui à 14h30", "Demain à 10h")
 */
export function formatDeadlineDate(dateStr: string): string {
  // Parse "JJ-MM-AAAA, HH:mm" format
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
  if (!match) {
    return dateStr; // Return as-is if format doesn't match
  }

  const [, day, month, year, hours, minutes] = match;
  const targetDate = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const targetDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

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

  const timeStr = `${hours}h${minutes !== "00" ? minutes : ""}`;

  // Check if it's today
  if (targetDay.getTime() === today.getTime()) {
    return `Aujourd'hui à ${timeStr}`;
  }

  // Check if it's tomorrow
  if (targetDay.getTime() === tomorrow.getTime()) {
    return `Demain à ${timeStr}`;
  }

  // Check if it's within the next 7 days
  const diffDays = Math.floor(
    (targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays > 0 && diffDays <= 7) {
    const dayName = days[targetDate.getDay()];
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} à ${timeStr}`;
  }

  // Otherwise show full date
  const dayName = days[targetDate.getDay()];
  const monthName = months[targetDate.getMonth()];
  return `${dayName} ${parseInt(day, 10)} ${monthName} à ${timeStr}`;
}

/**
 * Strip markdown code fences from LLM output (e.g. ```json ... ```)
 */
function stripMarkdownCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

/**
 * Attempt to repair a truncated JSON string by closing unclosed brackets/braces.
 * Only handles the common case of a missing `]}` at the end.
 */
function repairTruncatedJson(jsonStr: string): string {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of jsonStr) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  let repaired = jsonStr.trimEnd();
  // Close unclosed brackets then braces
  for (let i = 0; i < brackets; i++) repaired += ']';
  for (let i = 0; i < braces; i++) repaired += '}';
  return repaired;
}

/**
 * Parse action items from LLM JSON output
 * @param content - Raw content string from LLM containing JSON
 * @returns Array of action items or null if parsing failed
 */
export function parseActionItems(content: string): ActionItem[] | null {
  try {
    // Strip markdown code fences that LLM sometimes adds despite instructions
    const cleaned = stripMarkdownCodeFence(content);

    // Try to extract JSON from the content (might have extra text around it)
    const jsonMatch = cleaned.match(/\{[\s\S]*"items"[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    let jsonStr = jsonMatch[0];

    // Try direct parse first
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // JSON may be truncated — attempt repair
      const repaired = repairTruncatedJson(jsonStr);
      parsed = JSON.parse(repaired);
    }

    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    return null;
  } catch (error) {
    console.error("[parseActionItems] Failed to parse:", error);
    return null;
  }
}
