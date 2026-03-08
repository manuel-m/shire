import { Request, Response } from 'express';
import { createLogger } from '@shire/shared';
import { config } from '../config.js';

const { log } = createLogger(config.serviceName);

interface ProxyOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

/**
 * Forward a request to a backend service and pipe the response back.
 * Passes Authorization and X-Request-Id headers through.
 */
export async function proxyRequest(
  serviceBaseUrl: string,
  path: string,
  req: Request,
  res: Response,
  options?: ProxyOptions,
): Promise<void> {
  const method = options?.method || req.method;
  const url = new URL(path, serviceBaseUrl);

  // Forward query params
  const querySource = options?.query || (req.query as Record<string, string>);
  for (const [key, value] of Object.entries(querySource)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }
  if (req.requestId) {
    headers['X-Request-Id'] = req.requestId;
  }

  const fetchOptions: RequestInit = { method, headers };

  const body: unknown = options?.body ?? req.body;
  if (method !== 'GET' && method !== 'HEAD' && body && Object.keys(body as object).length > 0) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const upstream = await fetch(url.toString(), fetchOptions);
    const contentType = upstream.headers.get('content-type') || '';
    const responseBody: unknown = contentType.includes('application/json')
      ? await upstream.json()
      : await upstream.text();

    res.status(upstream.status);
    if (contentType.includes('application/json')) {
      res.json(responseBody);
    } else {
      res.type(contentType).send(responseBody);
    }
  } catch (err) {
    log('error', `Proxy error: ${method} ${url.toString()}`, {
      error: String(err),
      requestId: req.requestId,
    });
    res.status(502).json({
      error: { code: 'BAD_GATEWAY', message: 'Backend service unavailable' },
    });
  }
}

/**
 * Fetch JSON from a backend service (for enrichment / aggregation).
 */
export async function fetchJson<T = unknown>(
  serviceBaseUrl: string,
  path: string,
  authHeader?: string,
  requestId?: string,
): Promise<{ status: number; data: T }> {
  const url = new URL(path, serviceBaseUrl);
  const headers: Record<string, string> = {};
  if (authHeader) headers['Authorization'] = authHeader;
  if (requestId) headers['X-Request-Id'] = requestId;

  const res = await fetch(url.toString(), { headers });
  const data = (await res.json()) as T;
  return { status: res.status, data };
}
