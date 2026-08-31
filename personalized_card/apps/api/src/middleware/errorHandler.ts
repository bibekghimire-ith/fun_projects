import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { config } from '../config/env';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    /** Optional structured payload — publish-check issues, retry hints, etc. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  if (err && typeof err === 'object' && 'statusCode' in err) {
    const e = err as { statusCode: number; code?: string; message?: string };
    return res.status(e.statusCode).json({
      success: false,
      error: {
        code: e.code ?? 'ERROR',
        message: e.message ?? 'Error',
      },
    });
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: message,
    stack: config.NODE_ENV !== 'production' && err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
