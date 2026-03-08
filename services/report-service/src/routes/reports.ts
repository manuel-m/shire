import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateReportSchema,
  UpdateReportSchema,
  ReportFilterQuerySchema,
  type Report,
} from '@shire/shared-types';
import { getReportsCollection, getReportVersionsCollection } from '../db.js';
import { createAuthMiddleware, createLogger } from '@shire/shared';
import { config } from '../config.js';
import * as checks from '../engagement-check.js';
import { generateMarkdown } from '../markdown.js';

const { requireAuth } = createAuthMiddleware(config.jwtSecret);
const { log } = createLogger(config.serviceName);

const REPORT_NOT_FOUND = 'Report not found';

function mergeSections(
  existing: Report['sections'],
  updates: Partial<Report['sections']>,
): Report['sections'] {
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v != null)),
  };
}

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// POST /reports
reportsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const authToken = (req.headers.authorization || '').replace('Bearer ', '');

  // Validate engagementId
  const { exists: engagementExists } = await checks.validateEngagement(
    parsed.data.engagementId,
    authToken,
  );
  if (!engagementExists) {
    res.status(404).json({
      error: { code: 'ENGAGEMENT_NOT_FOUND', message: 'Engagement not found' },
    });
    return;
  }

  // Validate clientId
  const { exists: clientExists } = await checks.validateClient(parsed.data.clientId, authToken);
  if (!clientExists) {
    res.status(404).json({
      error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' },
    });
    return;
  }

  const now = new Date();
  const report = {
    _id: randomUUID(),
    ...parsed.data,
    version: 1,
    status: 'draft' as const,
    createdAt: now,
    updatedAt: now,
  };

  const reports = getReportsCollection();
  await reports.insertOne(report);

  log('info', 'Report created', {
    reportId: report._id,
    engagementId: report.engagementId,
    requestId: req.requestId,
  });

  res.status(201).json(report);
});

// GET /reports
reportsRouter.get('/', async (req: Request, res: Response) => {
  const parsed = ReportFilterQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { page, limit, engagementId, clientId, status } = parsed.data;
  const reports = getReportsCollection();

  const filter: Record<string, unknown> = {};
  if (engagementId) filter.engagementId = engagementId;
  if (clientId) filter.clientId = clientId;
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    reports
      .find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    reports.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

// GET /reports/:id
reportsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const reports = getReportsCollection();
  const report = await reports.findOne({ _id: id });

  if (!report) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND } });
    return;
  }

  res.json(report);
});

// PUT /reports/:id — update report (creates new version)
reportsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = UpdateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const reports = getReportsCollection();
  const existing = await reports.findOne({ _id: id });

  if (!existing) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND } });
    return;
  }

  if (existing.status !== 'draft') {
    res.status(422).json({
      error: {
        code: 'IMMUTABLE_STATUS',
        message: 'Only draft reports can be modified',
      },
    });
    return;
  }

  // Store previous version
  const versions = getReportVersionsCollection();
  const { _id, ...versionData } = existing;
  await versions.insertOne({ ...versionData, _id: randomUUID(), reportId: _id });

  // Build update: merge sections if provided
  const updateData: Record<string, unknown> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (parsed.data.title) updateData.title = parsed.data.title;
  if (parsed.data.status) updateData.status = parsed.data.status;

  if (parsed.data.sections) {
    updateData.sections = mergeSections(existing.sections, parsed.data.sections);
  }

  const result = await reports.findOneAndUpdate(
    { _id: id },
    { $set: updateData },
    { returnDocument: 'after' },
  );

  log('info', 'Report updated', {
    reportId: id,
    newVersion: existing.version + 1,
    requestId: req.requestId,
  });

  res.json(result);
});

// GET /reports/:id/versions — list all versions
reportsRouter.get('/:id/versions', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const reports = getReportsCollection();
  const current = await reports.findOne({ _id: id });

  if (!current) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND } });
    return;
  }

  const versions = getReportVersionsCollection();
  const previousVersions = await versions.find({ reportId: id }).sort({ version: 1 }).toArray();

  res.json([...previousVersions, current]);
});

// GET /reports/:id/versions/:version — get specific version
reportsRouter.get('/:id/versions/:version', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const version = parseInt(req.params.version as string, 10);

  if (isNaN(version) || version < 1) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid version number' } });
    return;
  }

  // Check current version first
  const reports = getReportsCollection();
  const current = await reports.findOne({ _id: id });

  if (!current) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND } });
    return;
  }

  if (current.version === version) {
    res.json(current);
    return;
  }

  // Check archived versions
  const versions = getReportVersionsCollection();
  const archived = await versions.findOne({ reportId: id, version });

  if (!archived) {
    res.status(404).json({ error: { code: 'VERSION_NOT_FOUND', message: 'Version not found' } });
    return;
  }

  res.json(archived);
});

// POST /reports/:id/generate/markdown
reportsRouter.post('/:id/generate/markdown', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const reports = getReportsCollection();
  const report = await reports.findOne({ _id: id });

  if (!report) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: REPORT_NOT_FOUND } });
    return;
  }

  const markdown = generateMarkdown(report);

  res.json({ markdown });
});
