import { config } from './config.js';

export async function validateClient(
  clientId: string,
  authToken: string,
): Promise<{ exists: boolean; hasCodeCredentials: boolean }> {
  try {
    const res = await fetch(`${config.clientServiceUrl}/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 404) {
      return { exists: false, hasCodeCredentials: false };
    }
    if (!res.ok) {
      return { exists: false, hasCodeCredentials: false };
    }
    // Client exists — check credentials via the credentials endpoint
    const credsRes = await fetch(`${config.clientServiceUrl}/clients/${clientId}/credentials`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    let hasCodeCredentials = false;
    if (credsRes.ok) {
      const creds = (await credsRes.json()) as Record<string, unknown>;
      hasCodeCredentials =
        (Array.isArray(creds.sshKeys) && creds.sshKeys.length > 0) ||
        (Array.isArray(creds.tokens) && creds.tokens.length > 0);
    }
    return { exists: true, hasCodeCredentials };
  } catch {
    return { exists: false, hasCodeCredentials: false };
  }
}
