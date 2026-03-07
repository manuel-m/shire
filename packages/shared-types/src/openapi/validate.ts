import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: result.error.message },
      });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: result.error.message },
      });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    req.query = result.data;
    next();
  };
}
