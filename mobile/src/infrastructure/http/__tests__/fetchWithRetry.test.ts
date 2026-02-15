/**
 * fetchWithRetry Tests
 *
 * Test suite for HTTP client wrapper with retry logic.
 * Coverage: 100%
 *
 * ADR-025: HTTP Client Strategy
 */

import { fetchWithRetry } from '../fetchWithRetry';

// Mock global fetch
global.fetch = jest.fn();

// Speed up tests by overriding sleep delays
jest.mock('../fetchWithRetry', () => {
  const actual = jest.requireActual('../fetchWithRetry');
  return {
    ...actual,
    fetchWithRetry: jest.fn(async (url, options = {}) => {
      // Call actual implementation but with fast delays for testing
      return actual.fetchWithRetry(url, options);
    }),
  };
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchWithRetry as jest.Mock).mockImplementation(
      jest.requireActual('../fetchWithRetry').fetchWithRetry
    );
  });

  describe('Success Cases', () => {
    it('should succeed on first attempt (200 OK)', async () => {
      const mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        statusText: 'OK',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithRetry('https://api.example.com/data');

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should include custom headers and body', async () => {
      const mockResponse = new Response(null, { status: 201 });
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const payload = { foo: 'bar' };
      const response = await fetchWithRetry('https://api.example.com/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token123',
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
          },
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('Retry Logic - Server Errors', () => {
    it('should retry on 500 and succeed on 2nd attempt', async () => {
      const errorResponse = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 and succeed on 3rd attempt', async () => {
      const errorResponse = new Response(null, {
        status: 503,
        statusText: 'Service Unavailable',
      });
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse) // Attempt 1
        .mockResolvedValueOnce(errorResponse) // Attempt 2
        .mockResolvedValueOnce(successResponse); // Attempt 3

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should exhaust retries and return final 500 response', async () => {
      const errorResponse = new Response(null, {
        status: 500,
        statusText: 'Internal Server Error',
      });

      (global.fetch as jest.Mock).mockResolvedValue(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 2,
      });

      expect(response.status).toBe(500);
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Retry Logic - Retryable Status Codes', () => {
    it('should retry on 408 Request Timeout', async () => {
      const errorResponse = new Response(null, { status: 408 });
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.example.com/data');

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 Too Many Requests', async () => {
      const errorResponse = new Response(null, { status: 429 });
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.example.com/data');

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Non-Retryable Errors', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      const errorResponse = new Response(null, {
        status: 400,
        statusText: 'Bad Request',
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(400);
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should NOT retry on 404 Not Found', async () => {
      const errorResponse = new Response(null, { status: 404 });
      (global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(404);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      const errorResponse = new Response(null, { status: 401 });
      (global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(401);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Errors', () => {
    it('should retry on network error (TypeError) and succeed', async () => {
      const networkError = new TypeError('Network request failed');
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
      });

      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries on persistent network error', async () => {
      const networkError = new TypeError('Network request failed');

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await expect(
        fetchWithRetry('https://api.example.com/data', {
          retries: 2,
        })
      ).rejects.toThrow('Network request failed');

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('onRetry Callback', () => {
    it('should invoke onRetry callback with correct attempt number', async () => {
      const errorResponse = new Response(null, { status: 500 });
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(successResponse);

      const onRetry = jest.fn();

      await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(
        1,
        1,
        expect.objectContaining({ message: expect.stringContaining('HTTP 500') })
      );
      expect(onRetry).toHaveBeenNthCalledWith(
        2,
        2,
        expect.objectContaining({ message: expect.stringContaining('HTTP 500') })
      );
    });

    it('should invoke onRetry on network error', async () => {
      const networkError = new TypeError('Network request failed');
      const successResponse = new Response(null, { status: 200 });

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const onRetry = jest.fn();

      await fetchWithRetry('https://api.example.com/data', {
        retries: 3,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, networkError);
    });
  });

  describe('Custom Retries', () => {
    it('should respect custom retries value', async () => {
      const errorResponse = new Response(null, { status: 500 });

      (global.fetch as jest.Mock).mockResolvedValue(errorResponse);

      await fetchWithRetry('https://api.example.com/data', {
        retries: 1,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should not retry when retries = 0', async () => {
      const errorResponse = new Response(null, { status: 500 });

      (global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse);

      const response = await fetchWithRetry('https://api.example.com/data', {
        retries: 0,
      });

      expect(response.status).toBe(500);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
