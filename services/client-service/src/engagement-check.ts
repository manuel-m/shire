import { config } from './config.js';
import { createLogger } from '@shire/shared';

const { log } = createLogger(config.serviceName);

/**
 * Check if client has active engagements via engagement-service.
 * Uses fail-open strategy: returns false on errors to allow operations
 * when dependent service is unavailable.
 */
export async function checkActiveEngagements(
  clientId: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `${config.engagementServiceUrl}/engagements?clientId=${clientId}`,
      {
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      log('error', 'Engagement service returned error', {
        clientId,
        status: res.status,
      });
      return false;
    }

    const body = (await res.json()) as { data?: unknown[] };
    const hasActive = Array.isArray(body.data) && body.data.length > 0;

    return hasActive;
  } catch (error) {
    // Fail-open: log error but allow deletion
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort) {
      log('error', 'Engagement service check timed out', { clientId });
    } else {
      log('error', 'Engagement service check failed', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return false;
  }
}
