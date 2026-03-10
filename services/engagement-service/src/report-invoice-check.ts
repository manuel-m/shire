import { config } from './config.js';
import { createLogger } from '@shire/shared';

const { log } = createLogger(config.serviceName);

/**
 * Check if engagement has associated reports or invoices.
 * Makes parallel HTTP calls to report-service and billing-service.
 * Uses fail-open strategy: returns false on errors to allow operations
 * when dependent services are unavailable.
 *
 * Returns true if EITHER reports OR invoices exist for the engagement.
 */
export async function checkAssociatedReportsOrInvoices(
  engagementId: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const reportCheck = checkReports(engagementId, controller.signal);
  const billingCheck = checkInvoices(engagementId, controller.signal);

  const results = await Promise.allSettled([reportCheck, billingCheck]);

  clearTimeout(timeoutId);

  const reportResult = results[0];
  const billingResult = results[1];

  let hasReports = false;
  let hasInvoices = false;

  if (reportResult.status === 'fulfilled') {
    hasReports = reportResult.value;
  } else {
    log('error', 'Report service check failed', {
      engagementId,
      error: reportResult.reason instanceof Error ? reportResult.reason.message : 'Unknown error',
    });
  }

  if (billingResult.status === 'fulfilled') {
    hasInvoices = billingResult.value;
  } else {
    log('error', 'Billing service check failed', {
      engagementId,
      error: billingResult.reason instanceof Error ? billingResult.reason.message : 'Unknown error',
    });
  }

  // Return true if EITHER has records
  return hasReports || hasInvoices;
}

async function checkReports(
  engagementId: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${config.reportServiceUrl}/reports?engagementId=${engagementId}`,
      { signal },
    );

    if (!res.ok) {
      return false;
    }

    const body = (await res.json()) as { data?: unknown[]; total?: number };
    const count = Array.isArray(body.data) ? body.data.length : 0;
    return count > 0;
  } catch {
    return false;
  }
}

async function checkInvoices(
  engagementId: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${config.billingServiceUrl}/invoices?engagementId=${engagementId}`,
      { signal },
    );

    if (!res.ok) {
      return false;
    }

    const body = (await res.json()) as { data?: unknown[]; total?: number };
    const count = Array.isArray(body.data) ? body.data.length : 0;
    return count > 0;
  } catch {
    return false;
  }
}
