let getAccessToken: () => string | null = () => null;
let onRefreshToken: (() => Promise<string | null>) | null = null;

export function setTokenAccessors(
  getter: () => string | null,
  refresher?: () => Promise<string | null>,
) {
  getAccessToken = getter;
  if (refresher) onRefreshToken = refresher;
}

class FetchError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.name = 'FetchError';
    this.status = status;
    this.data = data;
  }
}

async function doFetch(
  fullUrl: string,
  method: string,
  requestHeaders: Record<string, string>,
  data: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(fullUrl, {
    method,
    headers: requestHeaders,
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });
}

export async function customFetcher<T>({
  url,
  method,
  headers,
  data,
  params,
  signal,
}: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<T> {
  const fullUrl = new URL(url, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) fullUrl.searchParams.set(key, value);
    }
  }

  const token = getAccessToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response = await doFetch(fullUrl.toString(), method, requestHeaders, data, signal);

  // On 401, try to refresh the token and retry once
  if (response.status === 401 && onRefreshToken) {
    const newToken = await onRefreshToken();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      response = await doFetch(fullUrl.toString(), method, requestHeaders, data, signal);
    }
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => ({}));
    throw new FetchError(response.status, errorBody);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export default customFetcher;
