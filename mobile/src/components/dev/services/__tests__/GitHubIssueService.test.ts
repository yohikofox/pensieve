/**
 * Unit tests for GitHubIssueService
 *
 * Story 7.3 — LLM Logs Analysis & GitHub Issues
 * AC5: Token storage via expo-secure-store
 * AC6: createIssue via fetchWithRetry
 * AC7: searchExistingIssue deduplication
 *
 * Run: npx jest src/components/dev/services/__tests__/GitHubIssueService.test.ts
 */

// NOTE: reflect-metadata must be imported before any tsyringe usage.
// jest.mock is hoisted above imports, so we cannot mock reflect-metadata here.
import 'reflect-metadata';

// Mock expo-secure-store
const mockSecureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockSecureStore[key];
    return Promise.resolve();
  }),
}));

// Mock fetchWithRetry — factory cannot reference outer variables (jest.mock is hoisted)
jest.mock('../../../../infrastructure/http/fetchWithRetry', () => ({
  fetchWithRetry: jest.fn(),
}));

import { GitHubIssueService } from '../GitHubIssueService';
import { RepositoryResultType } from '../../../../contexts/shared/domain/Result';
import { fetchWithRetry } from '../../../../infrastructure/http/fetchWithRetry';

const mockFetchWithRetry = fetchWithRetry as jest.Mock;

describe('GitHubIssueService', () => {
  let service: GitHubIssueService;

  beforeEach(() => {
    service = new GitHubIssueService();
    jest.clearAllMocks();
    Object.keys(mockSecureStore).forEach(k => delete mockSecureStore[k]);
  });

  describe('Token management (AC5)', () => {
    it('returns null when no token is stored', async () => {
      const token = await service.getToken();
      expect(token).toBeNull();
    });

    it('stores and retrieves token via SecureStore', async () => {
      await service.setToken('ghp_test_token_123');
      const token = await service.getToken();
      expect(token).toBe('ghp_test_token_123');
    });

    it('clears the token from SecureStore', async () => {
      await service.setToken('ghp_test_token_123');
      await service.clearToken();
      const token = await service.getToken();
      expect(token).toBeNull();
    });
  });

  describe('createIssue (AC6)', () => {
    it('returns authError when no token configured', async () => {
      const result = await service.createIssue('owner', 'repo', 'Bug: test', 'body', ['bug']);
      expect(result.type).toBe(RepositoryResultType.AUTH_ERROR);
    });

    it('creates issue successfully via fetchWithRetry', async () => {
      await service.setToken('ghp_valid_token');

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          number: 42,
          title: 'Bug: test',
          html_url: 'https://github.com/owner/repo/issues/42',
          body: 'body',
          labels: [],
        }),
      });

      const result = await service.createIssue('owner', 'repo', 'Bug: test', 'body', ['bug']);

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.number).toBe(42);
      expect(result.data?.html_url).toContain('/issues/42');
    });

    it('calls correct GitHub API endpoint', async () => {
      await service.setToken('ghp_valid_token');

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, number: 1, title: 'T', html_url: 'url', body: '', labels: [] }),
      });

      await service.createIssue('myowner', 'myrepo', 'Title', 'Body', ['bug']);

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://api.github.com/repos/myowner/myrepo/issues',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer ghp_valid_token',
          }),
        })
      );
    });

    it('returns authError on 401 response', async () => {
      await service.setToken('ghp_invalid_token');

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await service.createIssue('owner', 'repo', 'Title', 'Body', []);
      expect(result.type).toBe(RepositoryResultType.AUTH_ERROR);
    });

    it('returns networkError on non-auth API failure', async () => {
      await service.setToken('ghp_valid_token');

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: false,
        status: 422,
      });

      const result = await service.createIssue('owner', 'repo', 'Title', 'Body', []);
      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
    });
  });

  describe('searchExistingIssue (AC7)', () => {
    it('returns null when no token configured', async () => {
      const result = await service.searchExistingIssue('owner', 'repo', 'Bug: test');
      expect(result.type).toBe(RepositoryResultType.AUTH_ERROR);
    });

    it('returns null when no similar issues found', async () => {
      await service.setToken('ghp_valid_token');

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const result = await service.searchExistingIssue('owner', 'repo', 'Bug: unique error');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeNull();
    });

    it('returns matching issue when >80% similarity found', async () => {
      await service.setToken('ghp_valid_token');

      const existingIssue = {
        id: 10,
        number: 5,
        title: 'Bug: crash on startup when loading database',
        html_url: 'https://github.com/owner/repo/issues/5',
        body: 'existing body',
        labels: [],
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [existingIssue] }),
      });

      const result = await service.searchExistingIssue(
        'owner',
        'repo',
        'Bug: crash on startup when loading database'
      );

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data?.number).toBe(5);
    });

    it('returns null gracefully when search API fails', async () => {
      await service.setToken('ghp_valid_token');

      mockFetchWithRetry.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.searchExistingIssue('owner', 'repo', 'Bug: test');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBeNull();
    });
  });
});
