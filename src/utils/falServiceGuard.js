const DEFAULT_READY_TIMEOUT_MS = 15000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_HEALTH_TIMEOUT_MS = 2500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createServiceUnavailableError = (message, cause = null) => {
  const error = new Error(message);
  error.transient = true;
  error.retryable = true;
  error.statusCode = 503;

  if (cause) {
    error.cause = cause;
  }

  return error;
};

export const waitForFalServiceReady = async (
  falServiceUrl,
  {
    timeoutMs = DEFAULT_READY_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS
  } = {}
) => {
  if (typeof falServiceUrl !== 'string' || !/^https?:\/\//i.test(falServiceUrl)) {
    throw createServiceUnavailableError('Le service fal.ai est en cours d\'initialisation. Réessayez dans quelques secondes.');
  }

  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthTimeoutMs);

    try {
      const response = await fetch(`${falServiceUrl}/health`, {
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.status === 'ok' && payload?.hasApiKey !== false) {
        return true;
      }

      lastError = new Error(payload?.error || (payload?.hasApiKey === false
        ? 'fal.ai API key not configured'
        : `Health check failed (${response.status})`));
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }

    await sleep(pollIntervalMs);
  }

  const details = lastError?.message ? ` ${lastError.message}` : '';
  throw createServiceUnavailableError(`Le service fal.ai n'est pas encore prêt.${details}`.trim(), lastError);
};

export const createTransientFalError = (message, cause = null) => {
  return createServiceUnavailableError(message, cause);
};
