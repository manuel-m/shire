import { z } from 'zod';
import '../openapi/init.js';
import { PaginationQuerySchema } from './common.js';

export const ReportStatusEnum = z.enum(['draft', 'review', 'final']);
export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const ReportPriorityEnum = z.enum(['low', 'medium', 'high']);

export const ProblemSchema = z
  .object({
    title: z.string(),
    severity: SeverityEnum,
    description: z.string(),
    impact: z.string().optional(),
  })
  .openapi('Problem');

export const RecommendationSchema = z
  .object({
    title: z.string(),
    priority: ReportPriorityEnum,
    description: z.string(),
    effort: z.string().optional(),
  })
  .openapi('Recommendation');

export const ActionPlanStepSchema = z
  .object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    responsible: z.string().optional(),
    deadline: z.coerce.date().optional(),
  })
  .openapi('ActionPlanStep');

export const ReportSectionsSchema = z
  .object({
    executiveSummary: z.string(),
    architectureOverview: z.string().optional(),
    problems: z.array(ProblemSchema),
    recommendations: z.array(RecommendationSchema),
    actionPlan: z.array(ActionPlanStepSchema),
  })
  .openapi('ReportSections');

export const ReportSchema = z
  .object({
    _id: z.string(),
    engagementId: z.string(),
    clientId: z.string(),
    title: z.string(),
    version: z.number(),
    status: ReportStatusEnum,
    sections: ReportSectionsSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('Report');

export const CreateReportSchema = z
  .object({
    engagementId: z.string().min(1),
    clientId: z.string().min(1),
    title: z.string().min(1),
    sections: z
      .object({
        executiveSummary: z.string().min(1),
        architectureOverview: z.string().optional(),
        problems: z.array(ProblemSchema).default([]),
        recommendations: z.array(RecommendationSchema).default([]),
        actionPlan: z.array(ActionPlanStepSchema).default([]),
      })
      .openapi('CreateReportSections'),
  })
  .openapi('CreateReport');

export const UpdateReportSchema = z
  .object({
    title: z.string().min(1).optional(),
    status: ReportStatusEnum.optional(),
    sections: z
      .object({
        executiveSummary: z.string().min(1).optional(),
        architectureOverview: z.string().optional(),
        problems: z.array(ProblemSchema).optional(),
        recommendations: z.array(RecommendationSchema).optional(),
        actionPlan: z.array(ActionPlanStepSchema).optional(),
      })
      .openapi('UpdateReportSections')
      .optional(),
  })
  .openapi('UpdateReport');

export const ReportFilterQuerySchema = PaginationQuerySchema.extend({
  engagementId: z.string().optional(),
  clientId: z.string().optional(),
  status: ReportStatusEnum.optional(),
}).openapi('ReportFilterQuery');

export type Report = z.infer<typeof ReportSchema>;
export type CreateReport = z.infer<typeof CreateReportSchema>;
export type UpdateReport = z.infer<typeof UpdateReportSchema>;
export type ReportFilterQuery = z.infer<typeof ReportFilterQuerySchema>;
