import { z } from 'zod';
import '../openapi/init.js';
import { PaginationQuerySchema } from './common.js';

export const CodeCredentialsSchema = z.object({
  repoUrls: z.array(z.string()).optional(),
  sshKeys: z.array(z.string()).optional(),
  tokens: z.array(z.string()).optional(),
}).openapi('CodeCredentials');

export const ClientSchema = z.object({
  _id: z.string(),
  companyName: z.string(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  technicalStack: z.array(z.string()),
  notes: z.string().optional(),
  codeCredentials: CodeCredentialsSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).openapi('Client');

export const CreateClientSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  technicalStack: z.array(z.string()).default([]),
  notes: z.string().optional(),
}).openapi('CreateClient');

export const UpdateClientSchema = z.object({
  companyName: z.string().min(1).optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  technicalStack: z.array(z.string()).optional(),
  notes: z.string().optional(),
}).openapi('UpdateClient');

export const ClientFilterQuerySchema = PaginationQuerySchema.extend({
  industry: z.string().optional(),
  companyName: z.string().optional(),
}).openapi('ClientFilterQuery');

export const CodeCredentialsInputSchema = z.object({
  repoUrls: z.array(z.string()).optional(),
  sshKeys: z.array(z.string()).optional(),
  tokens: z.array(z.string()).optional(),
}).openapi('CodeCredentialsInput');

export const CodeCredentialsOutputSchema = CodeCredentialsInputSchema;

export type Client = z.infer<typeof ClientSchema>;
export type CreateClient = z.infer<typeof CreateClientSchema>;
export type UpdateClient = z.infer<typeof UpdateClientSchema>;
export type ClientFilterQuery = z.infer<typeof ClientFilterQuerySchema>;
export type CodeCredentials = z.infer<typeof CodeCredentialsSchema>;
export type CodeCredentialsInput = z.infer<typeof CodeCredentialsInputSchema>;
export type CodeCredentialsOutput = z.infer<typeof CodeCredentialsOutputSchema>;
