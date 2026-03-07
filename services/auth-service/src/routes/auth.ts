import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'node:crypto';
import {
  CreateUserSchema,
  LoginSchema,
  RefreshRequestSchema,
  UpdateUserSchema,
} from '@shire/shared-types';
import { getUsersCollection, getRefreshTokensCollection } from '../db.js';
import { config } from '../config.js';
import { requireAuth, type AuthPayload } from '../middleware/auth.js';
import { log } from '../logger.js';

export const authRouter = Router();

function generateAccessToken(user: { _id: string; email: string; role: string }): string {
  return jwt.sign(
    { userId: user._id, email: user.email, role: user.role } satisfies AuthPayload,
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

async function generateRefreshToken(userId: string): Promise<string> {
  const refreshTokens = getRefreshTokensCollection();

  // Enforce max 5 active refresh tokens per user
  const existing = await refreshTokens.find({ userId }).sort({ createdAt: 1 }).toArray();
  if (existing.length >= config.maxRefreshTokensPerUser) {
    const toRemove = existing.slice(0, existing.length - config.maxRefreshTokensPerUser + 1);
    await refreshTokens.deleteMany({ _id: { $in: toRemove.map((t) => t._id) } });
  }

  const token = randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.refreshTokenExpiresInDays);

  await refreshTokens.insertOne({
    _id: randomUUID(),
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
  });

  return token;
}

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { email, password, name } = parsed.data;
  const users = getUsersCollection();

  const existing = await users.findOne({ email });
  if (existing) {
    res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    return;
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const now = new Date();
  const user = {
    _id: randomUUID(),
    email,
    passwordHash,
    name,
    role: 'consultant' as const,
    createdAt: now,
    updatedAt: now,
  };

  await users.insertOne(user);
  log('info', 'User registered', { userId: user._id, email, requestId: req.requestId });

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user._id);

  res.status(201).json({
    user: { _id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt },
    accessToken,
    refreshToken,
  });
});

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { email, password } = parsed.data;
  const users = getUsersCollection();

  const user = await users.findOne({ email });
  if (!user) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    return;
  }

  log('info', 'User logged in', { userId: user._id, email, requestId: req.requestId });

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user._id);

  res.json({
    user: { _id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt },
    accessToken,
    refreshToken,
  });
});

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const parsed = RefreshRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const { refreshToken } = parsed.data;
  const refreshTokens = getRefreshTokensCollection();

  const stored = await refreshTokens.findOne({ token: refreshToken });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await refreshTokens.deleteOne({ _id: stored._id });
    res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' } });
    return;
  }

  const users = getUsersCollection();
  const user = await users.findOne({ _id: stored.userId });
  if (!user) {
    await refreshTokens.deleteOne({ _id: stored._id });
    res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'User not found' } });
    return;
  }

  // Rotate: delete old, issue new
  await refreshTokens.deleteOne({ _id: stored._id });
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = await generateRefreshToken(user._id);

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

// POST /auth/logout
authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const parsed = RefreshRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const refreshTokens = getRefreshTokensCollection();
  await refreshTokens.deleteOne({ token: parsed.data.refreshToken, userId: req.user!.userId });

  log('info', 'User logged out', { userId: req.user!.userId, requestId: req.requestId });
  res.json({ message: 'Logged out' });
});

// GET /auth/me
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const users = getUsersCollection();
  const user = await users.findOne({ _id: req.user!.userId });
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const { passwordHash: _, ...publicUser } = user;
  res.json(publicUser);
});

// PUT /auth/me
authRouter.put('/me', requireAuth, async (req: Request, res: Response) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
    return;
  }

  const users = getUsersCollection();

  if (parsed.data.email) {
    const existing = await users.findOne({ email: parsed.data.email, _id: { $ne: req.user!.userId } });
    if (existing) {
      res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already in use' } });
      return;
    }
  }

  const result = await users.findOneAndUpdate(
    { _id: req.user!.userId },
    { $set: { ...parsed.data, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!result) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const { passwordHash: _, ...publicUser } = result;
  res.json(publicUser);
});
