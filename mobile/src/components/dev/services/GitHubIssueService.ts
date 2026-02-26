/**
 * GitHubIssueService — Story 7.3
 *
 * Service responsible for GitHub Issue operations:
 * - Token management via expo-secure-store (AC5, ADR-022)
 * - Issue creation via fetchWithRetry (AC6, ADR-025)
 * - Issue deduplication via search API (AC7)
 *
 * ADR compliance:
 * - ADR-022: Token stored in SecureStore, never AsyncStorage
 * - ADR-023: Result Pattern for all returns
 * - ADR-025: fetchWithRetry wrapper
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import * as SecureStore from 'expo-secure-store';
import { fetchWithRetry } from '../../../infrastructure/http/fetchWithRetry';
import {
  type Result,
  RepositoryResultType,
  success,
  networkError,
  authError,
  unknownError,
} from '../../../contexts/shared/domain/Result';

const GITHUB_TOKEN_KEY = 'github_issue_token';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string;
  labels: string[];
}

export interface IGitHubIssueService {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
  createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[]
  ): Promise<Result<GitHubIssue>>;
  searchExistingIssue(
    owner: string,
    repo: string,
    title: string
  ): Promise<Result<GitHubIssue | null>>;
}

@injectable()
export class GitHubIssueService implements IGitHubIssueService {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(GITHUB_TOKEN_KEY);
  }

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(GITHUB_TOKEN_KEY, token);
  }

  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(GITHUB_TOKEN_KEY);
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
    labels: string[]
  ): Promise<Result<GitHubIssue>> {
    const token = await this.getToken();
    if (!token) {
      return authError<GitHubIssue>('GitHub token not configured. Set it in Settings > Bug Reporting.');
    }

    try {
      const response = await fetchWithRetry(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ title, body, labels }),
          timeout: 30000,
          retries: 2,
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return authError<GitHubIssue>(
            `GitHub authentication failed (${response.status}). Check your token in Settings.`
          );
        }
        return networkError<GitHubIssue>(
          `GitHub API returned error: ${response.status} ${response.statusText}`
        );
      }

      const issue = (await response.json()) as GitHubIssue;
      console.log('[GitHubIssueService] Issue created:', issue.html_url);
      return success(issue);
    } catch (error) {
      console.error('[GitHubIssueService] createIssue failed:', error);
      return unknownError<GitHubIssue>(
        error instanceof Error ? error.message : 'Unknown error creating GitHub issue'
      );
    }
  }

  async searchExistingIssue(
    owner: string,
    repo: string,
    title: string
  ): Promise<Result<GitHubIssue | null>> {
    const token = await this.getToken();
    if (!token) {
      return authError<GitHubIssue | null>('GitHub token not configured');
    }

    try {
      // Sanitize title for search (max 80 chars, remove special chars)
      const searchTitle = title
        .substring(0, 80)
        .replace(/[^\w\s-]/g, ' ')
        .trim();
      const query = encodeURIComponent(`${searchTitle} repo:${owner}/${repo} type:issue is:open`);

      const response = await fetchWithRetry(
        `https://api.github.com/search/issues?q=${query}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
          timeout: 15000,
          retries: 1,
        }
      );

      if (!response.ok) {
        // Search failing is non-critical — fallback to creating new issue
        console.warn('[GitHubIssueService] Search API returned:', response.status);
        return success<GitHubIssue | null>(null);
      }

      const data = (await response.json()) as { items: GitHubIssue[] };
      const items = data.items ?? [];

      if (items.length === 0) {
        return success<GitHubIssue | null>(null);
      }

      // Check for >80% similarity
      const titleLower = title.toLowerCase();
      const match = items.find((item) => {
        const itemTitleLower = item.title.toLowerCase();
        return this.calculateWordSimilarity(titleLower, itemTitleLower) > 0.8;
      });

      return success<GitHubIssue | null>(match ?? null);
    } catch (error) {
      // Search failures are non-critical — allow creating new issue
      console.warn('[GitHubIssueService] Search failed, will create new issue:', error);
      return success<GitHubIssue | null>(null);
    }
  }

  /**
   * Calculate word overlap similarity between two strings.
   * Returns value between 0 (no overlap) and 1 (identical).
   */
  private calculateWordSimilarity(s1: string, s2: string): number {
    const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
    const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    let overlap = 0;
    words1.forEach((word) => {
      if (words2.has(word)) overlap++;
    });

    return overlap / Math.max(words1.size, words2.size);
  }
}
