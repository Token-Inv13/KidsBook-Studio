/** @jest-environment node */

import { waitForOpenAIServiceReady } from './openaiServiceGuard';

describe('openaiServiceGuard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fails fast with a retryable error when service URL is missing', async () => {
    await expect(waitForOpenAIServiceReady(null)).rejects.toMatchObject({
      transient: true,
      retryable: true,
      statusCode: 503
    });
  });

  test('returns once the health endpoint reports ready', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'ok', hasApiKey: true })
    }));

    await expect(
      waitForOpenAIServiceReady('http://localhost:3001', {
        timeoutMs: 200,
        pollIntervalMs: 10,
        healthTimeoutMs: 50
      })
    ).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/health',
      expect.objectContaining({ signal: expect.any(Object) })
    );
  });
});
