import { z } from 'zod';
import '../openapi/init.js';

export const CredentialAccessLogSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  userId: z.string(),
  action: z.string(),
  timestamp: z.date(),
}).openapi('CredentialAccessLog');

export type CredentialAccessLog = z.infer<typeof CredentialAccessLogSchema>;
