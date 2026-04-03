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

export const waitForIdeogramServiceReady = async (
  ideogramServiceUrl,
  {
    timeoutMs = DEFAULT_READY_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    healthTimeoutMs = DEFAULT_HEALTH_TIMEOUT_MS
  } = {}
) => {
  if (typeof ideogramServiceUrl !== 'string' || !/^https?:\/\//i.test(ideogramServiceUrl)) {
    throw createServiceUnavailableError('Le service Ideogram est en cours d\'initialisation. Réessayez dans quelques secondes.');
  }

  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthTimeoutMs);

    try {
      const response = await fetch(`${ideogramServiceUrl}/health`, {
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.status === 'ok' && payload?.hasApiKey !== false) {
        return true;
      }

      lastError = new Error(payload?.error || (payload?.hasApiKey === false
        ? 'Ideogram API key not configured'
        : `Health check failed (${response.status})`));
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }

    await sleep(pollIntervalMs);
  }

  const details = lastError?.message ? ` ${lastError.message}` : '';
  throw createServiceUnavailableError(`Le service Ideogram n'est pas encore prêt.${details}`.trim(), lastError);
};

export const createTransientIdeogramError = (message, cause = null) => {
  return createServiceUnavailableError(message, cause);
};
