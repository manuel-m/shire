import { z } from 'zod';
import '../openapi/init.js';
import { PaginationQuerySchema } from './common.js';

export const EngagementTypeEnum = z.enum(['diagnostic', 'support', 'resolution']);
export const AccessTypeEnum = z.enum(['black-box', 'code-delivery', 'code-credentials']);
export const PriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const EngagementStatusEnum = z.enum([
  'requested',
  'diagnosis',
  'in-progress',
  'waiting-for-client',
  'completed',
]);

export const TimelineSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    estimatedHours: z.number().optional(),
  })
  .openapi('Timeline');

export const EngagementSchema = z
  .object({
    _id: z.string(),
    clientId: z.string(),
    type: EngagementTypeEnum,
    accessType: AccessTypeEnum,
    description: z.string(),
    priority: PriorityEnum,
    status: EngagementStatusEnum,
    assignedConsultant: z.string().optional(),
    timeline: TimelineSchema.optional(),
    creationDate: z.date(),
    updatedAt: z.date(),
  })
  .openapi('Engagement');

export const CreateEngagementSchema = z
  .object({
    clientId: z.string().min(1),
    type: EngagementTypeEnum,
    accessType: AccessTypeEnum,
    description: z.string().min(1),
    priority: PriorityEnum,
    assignedConsultant: z.string().optional(),
    timeline: TimelineSchema.optional(),
  })
  .openapi('CreateEngagement');

export const UpdateEngagementSchema = z
  .object({
    accessType: AccessTypeEnum.optional(),
    description: z.string().min(1).optional(),
    priority: PriorityEnum.optional(),
    assignedConsultant: z.string().optional(),
    timeline: TimelineSchema.optional(),
  })
  .openapi('UpdateEngagement');

export const UpdateEngagementStatusSchema = z
  .object({
    status: EngagementStatusEnum,
  })
  .openapi('UpdateEngagementStatus');

export const EngagementFilterQuerySchema = PaginationQuerySchema.extend({
  status: EngagementStatusEnum.optional(),
  type: EngagementTypeEnum.optional(),
  priority: PriorityEnum.optional(),
  clientId: z.string().optional(),
}).openapi('EngagementFilterQuery');

export type Engagement = z.infer<typeof EngagementSchema>;
export type CreateEngagement = z.infer<typeof CreateEngagementSchema>;
export type UpdateEngagement = z.infer<typeof UpdateEngagementSchema>;
export type UpdateEngagementStatus = z.infer<typeof UpdateEngagementStatusSchema>;
export type EngagementFilterQuery = z.infer<typeof EngagementFilterQuerySchema>;
