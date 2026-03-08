import { config } from './config.js';

export async function validateEngagement(
  engagementId: string,
  authToken: string,
): Promise<{ exists: boolean }> {
  try {
    const res = await fetch(`${config.engagementServiceUrl}/engagements/${engagementId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return { exists: res.ok };
  } catch {
    return { exists: false };
  }
}

export async function validateClient(
  clientId: string,
  authToken: string,
): Promise<{ exists: boolean }> {
  try {
    const res = await fetch(`${config.clientServiceUrl}/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return { exists: res.ok };
  } catch {
    return { exists: false };
  }
}
