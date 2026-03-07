import { z } from 'zod';
import '../openapi/init.js';

export const ContactSchema = z.object({
  _id: z.string(),
  clientId: z.string(),
  name: z.string(),
  role: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).openapi('Contact');

export const CreateContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
}).openapi('CreateContact');

export const UpdateContactSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
}).openapi('UpdateContact');

export type Contact = z.infer<typeof ContactSchema>;
export type CreateContact = z.infer<typeof CreateContactSchema>;
export type UpdateContact = z.infer<typeof UpdateContactSchema>;
