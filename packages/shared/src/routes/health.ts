import { Router, Request, Response } from 'express';

export function createHealthRouter(serviceName: string): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: serviceName, timestamp: new Date().toISOString() });
  });

  return router;
}
