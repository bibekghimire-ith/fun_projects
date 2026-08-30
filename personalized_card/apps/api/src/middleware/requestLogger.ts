import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuidv4();
  const start = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const latency = Date.now() - start;
    logger.info('Request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: latency,
      ip: req.ip,
    });
  });

  next();
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
