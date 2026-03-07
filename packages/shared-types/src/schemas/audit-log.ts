import { z } from 'zod';

export const CredentialAccessLogSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  userId: z.string(),
  action: z.string(),
  timestamp: z.date(),
});

export type CredentialAccessLog = z.infer<typeof CredentialAccessLogSchema>;
