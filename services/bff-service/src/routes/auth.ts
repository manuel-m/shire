import { Router, Request, Response } from 'express';
import { proxyRequest } from '../lib/service-client.js';
import { config } from '../config.js';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', (req: Request, res: Response) => {
  void proxyRequest(config.authServiceUrl, '/auth/register', req, res);
});

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response) => {
  void proxyRequest(config.authServiceUrl, '/auth/login', req, res);
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req: Request, res: Response) => {
  void proxyRequest(config.authServiceUrl, '/auth/refresh', req, res);
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  void proxyRequest(config.authServiceUrl, '/auth/me', req, res);
});
