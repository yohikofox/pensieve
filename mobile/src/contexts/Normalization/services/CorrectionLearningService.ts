/**
 * CorrectionLearningService - Passive learning of transcript corrections
 *
 * Detects when users correct transcription errors and learns patterns
 * to suggest vocabulary additions.
 *
 * Architecture:
 * - Uses diff-match-patch for character-level diff
 * - Converts to word-level corrections
 * - Captures surrounding context to detect idioms
 * - Stores in AsyncStorage for persistence
 * - Provides suggestions for vocabulary screen
 */

// ASYNC_STORAGE_OK: UI preference data only (transcription correction learning history — behavioral cache) — not critical domain data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { diff_match_patch, Diff } from 'diff-match-patch';

const CORRECTIONS_STORAGE_KEY = '@pensieve/correction_history';
const MIN_WORD_LENGTH = 3; // Ignore short words like "le" → "les"
const MIN_OCCURRENCES_FOR_SUGGESTION = 2; // Show suggestion after 2+ corrections
const CONTEXT_WORDS_BEFORE = 3; // Words to capture before correction
const CONTEXT_WORDS_AFTER = 2; // Words to capture after correction

// English connectors commonly part of technical idioms
const IDIOM_CONNECTORS = [
  'of', 'out', 'in', 'on', 'up', 'down', 'to', 'for', 'by', 'at',
  'with', 'from', 'into', 'over', 'under', 'through', 'between',
  'the', 'a', 'an', 'and', 'or', 'not', 'no', 'is', 'are', 'be',
];

export interface CorrectionEntry {
  id: string;
  originalWord: string;      // What Whisper transcribed
  correctedWord: string;     // What user corrected to
  suggestedPhrase: string;   // Detected idiom/phrase to add to vocabulary
  contextBefore: string;     // Words before the correction
  contextAfter: string;      // Words after the correction
  count: number;             // Number of times this correction was made
  lastSeen: Date;
  captureIds: string[];      // Captures where this correction was made
}

interface StoredCorrections {
  entries: CorrectionEntry[];
  version: number;
}

/**
 * Result of analyzing a diff
 */
interface WordCorrection {
  originalWord: string;
  correctedWord: string;
  positionInOriginal: number; // Word index in original text
  positionInCorrected: number; // Word index in corrected text
}

class CorrectionLearningServiceClass {
  private dmp: diff_match_patch;
  private corrections: CorrectionEntry[] = [];
  private loaded: boolean = false;

  constructor() {
    this.dmp = new diff_match_patch();
  }

  /**
   * Load corrections from storage
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const stored = await AsyncStorage.getItem(CORRECTIONS_STORAGE_KEY);
      if (stored) {
        const data: StoredCorrections = JSON.parse(stored);
        this.corrections = data.entries.map(e => ({
          ...e,
          lastSeen: new Date(e.lastSeen),
        }));
      }
      this.loaded = true;
    } catch (error) {
      console.error('[CorrectionLearningService] Failed to load:', error);
      this.corrections = [];
      this.loaded = true;
    }
  }

  /**
   * Save corrections to storage
   */
  private async save(): Promise<void> {
    try {
      const data: StoredCorrections = {
        entries: this.corrections,
        version: 1,
      };
      await AsyncStorage.setItem(CORRECTIONS_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[CorrectionLearningService] Failed to save:', error);
    }
  }

  /**
   * Learn from a transcript correction
   *
   * @param originalText - Original transcribed text
   * @param correctedText - User's corrected text
   * @param captureId - ID of the capture being corrected
   */
  async learn(originalText: string, correctedText: string, captureId: string): Promise<void> {
    await this.load();

    // Skip if texts are identical
    if (originalText.trim() === correctedText.trim()) {
      return;
    }

    // Get word-level corrections
    const wordCorrections = this.extractWordCorrections(originalText, correctedText);

    console.log(`[CorrectionLearningService] Found ${wordCorrections.length} word corrections`);

    for (const correction of wordCorrections) {
      // Skip short words
      if (correction.originalWord.length < MIN_WORD_LENGTH ||
          correction.correctedWord.length < MIN_WORD_LENGTH) {
        continue;
      }

      // Extract context and detect idiom
      const correctedWords = this.tokenize(correctedText);
      const contextBefore = this.getContextBefore(correctedWords, correction.positionInCorrected);
      const contextAfter = this.getContextAfter(correctedWords, correction.positionInCorrected);

      const suggestedPhrase = this.detectIdiom(
        correction.correctedWord,
        contextBefore,
        contextAfter
      );

      // Find or create entry
      const existingIndex = this.corrections.findIndex(
        e => e.suggestedPhrase.toLowerCase() === suggestedPhrase.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing entry
        const existing = this.corrections[existingIndex];
        existing.count++;
        existing.lastSeen = new Date();
        if (!existing.captureIds.includes(captureId)) {
          existing.captureIds.push(captureId);
        }
        console.log(`[CorrectionLearningService] Updated: "${suggestedPhrase}" (count: ${existing.count})`);
      } else {
        // Create new entry
        const entry: CorrectionEntry = {
          id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          suggestedPhrase,
          contextBefore,
          contextAfter,
          count: 1,
          lastSeen: new Date(),
          captureIds: [captureId],
        };
        this.corrections.push(entry);
        console.log(`[CorrectionLearningService] New: "${suggestedPhrase}" (${correction.originalWord} → ${correction.correctedWord})`);
      }
    }

    await this.save();
  }

  /**
   * Get vocabulary suggestions (corrections seen 2+ times)
   */
  async getSuggestions(): Promise<CorrectionEntry[]> {
    await this.load();

    return this.corrections
      .filter(e => e.count >= MIN_OCCURRENCES_FOR_SUGGESTION)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get all corrections (for debugging)
   */
  async getAllCorrections(): Promise<CorrectionEntry[]> {
    await this.load();
    return [...this.corrections].sort((a, b) => b.count - a.count);
  }

  /**
   * Remove a suggestion (user dismissed it)
   */
  async dismissSuggestion(id: string): Promise<void> {
    await this.load();
    this.corrections = this.corrections.filter(e => e.id !== id);
    await this.save();
  }

  /**
   * Clear all corrections
   */
  async clear(): Promise<void> {
    this.corrections = [];
    await this.save();
  }

  /**
   * Extract word-level corrections from diff
   */
  private extractWordCorrections(originalText: string, correctedText: string): WordCorrection[] {
    const corrections: WordCorrection[] = [];

    // Get character-level diff
    const diffs = this.dmp.diff_main(originalText, correctedText);
    this.dmp.diff_cleanupSemantic(diffs);

    // Convert to word-level by analyzing the diff
    let originalPos = 0;
    let correctedPos = 0;
    let i = 0;

    while (i < diffs.length) {
      const diff = diffs[i];
      const [op, text] = diff;

      if (op === 0) {
        // Equal - advance both positions
        const words = this.countWords(text);
        originalPos += words;
        correctedPos += words;
        i++;
      } else if (op === -1) {
        // Deletion - check if next is insertion (replacement)
        const nextDiff = diffs[i + 1];
        if (nextDiff && nextDiff[0] === 1) {
          // This is a replacement
          const deletedWords = this.tokenize(text.trim());
          const insertedWords = this.tokenize(nextDiff[1].trim());

          // Only consider single word replacements
          if (deletedWords.length === 1 && insertedWords.length === 1) {
            corrections.push({
              originalWord: deletedWords[0],
              correctedWord: insertedWords[0],
              positionInOriginal: originalPos,
              positionInCorrected: correctedPos,
            });
          }

          originalPos += deletedWords.length;
          correctedPos += insertedWords.length;
          i += 2;
        } else {
          // Pure deletion
          originalPos += this.countWords(text);
          i++;
        }
      } else if (op === 1) {
        // Pure insertion
        correctedPos += this.countWords(text);
        i++;
      }
    }

    return corrections;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text.split(/\s+/).filter(w => w.length > 0);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return this.tokenize(text).length;
  }

  /**
   * Get context words before a position
   */
  private getContextBefore(words: string[], position: number): string {
    const start = Math.max(0, position - CONTEXT_WORDS_BEFORE);
    return words.slice(start, position).join(' ');
  }

  /**
   * Get context words after a position
   */
  private getContextAfter(words: string[], position: number): string {
    const end = Math.min(words.length, position + 1 + CONTEXT_WORDS_AFTER);
    return words.slice(position + 1, end).join(' ');
  }

  /**
   * Detect idiom/phrase from correction and context
   *
   * Expands the corrected word to include likely idiom parts
   */
  private detectIdiom(
    correctedWord: string,
    contextBefore: string,
    contextAfter: string
  ): string {
    const beforeWords = this.tokenize(contextBefore);
    const afterWords = this.tokenize(contextAfter);

    let phrase = correctedWord;

    // Expand left: include connector words and likely idiom parts
    for (let i = beforeWords.length - 1; i >= 0; i--) {
      const word = beforeWords[i];
      const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase();

      // Stop at punctuation
      if (/[.!?]$/.test(word)) break;

      // Include if it's a connector or looks like part of an English phrase
      if (this.isLikelyIdiomPart(cleanWord)) {
        phrase = word + ' ' + phrase;
      } else {
        // Stop expanding if we hit a non-connector French word
        break;
      }
    }

    // Expand right: less aggressive, only include clear continuations
    for (let i = 0; i < afterWords.length; i++) {
      const word = afterWords[i];
      const cleanWord = word.replace(/[.,!?;:'"]/g, '').toLowerCase();

      // Stop at punctuation
      if (/^[.!?,;:]/.test(word)) break;

      // Include if it's clearly part of the idiom (e.g., "out of memory error")
      if (this.isLikelyIdiomPart(cleanWord) && this.looksEnglish(cleanWord)) {
        phrase = phrase + ' ' + word;
      } else {
        break;
      }
    }

    return phrase;
  }

  /**
   * Check if a word is likely part of an idiom
   */
  private isLikelyIdiomPart(word: string): boolean {
    const lower = word.toLowerCase();

    // Check if it's a common English connector
    if (IDIOM_CONNECTORS.includes(lower)) {
      return true;
    }

    // Check if it looks English (simple heuristic)
    if (this.looksEnglish(word)) {
      return true;
    }

    return false;
  }

  /**
   * Simple heuristic to detect if a word looks English
   */
  private looksEnglish(word: string): boolean {
    const lower = word.toLowerCase();

    // Common English patterns not in French
    const englishPatterns = [
      /ing$/,      // running, testing
      /tion$/,     // action, function (also French, but common)
      /ly$/,       // really, mostly
      /ness$/,     // business, awareness
      /ment$/,     // development, management (also French)
      /^th/,       // the, this, that
      /ght$/,      // right, light
      /^wh/,       // what, when, where
      /ck$/,       // back, check, stack
      /ow$/,       // flow, show, know
    ];

    for (const pattern of englishPatterns) {
      if (pattern.test(lower)) {
        return true;
      }
    }

    // Check for common tech terms
    const techTerms = [
      'api', 'url', 'http', 'https', 'json', 'xml', 'html', 'css',
      'app', 'bug', 'code', 'data', 'file', 'git', 'log', 'npm',
      'pull', 'push', 'test', 'user', 'web', 'dev', 'prod', 'staging',
      'stack', 'heap', 'memory', 'cache', 'query', 'request', 'response',
      'error', 'warning', 'debug', 'info', 'trace', 'workflow', 'sprint',
      'scrum', 'agile', 'kanban', 'ticket', 'issue', 'feature', 'branch',
      'merge', 'commit', 'deploy', 'release', 'version', 'build', 'package',
    ];

    if (techTerms.includes(lower)) {
      return true;
    }

    return false;
  }
}

// Singleton instance
export const CorrectionLearningService = new CorrectionLearningServiceClass();
