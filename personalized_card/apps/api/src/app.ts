import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { authenticate } from './middleware/auth';

// Routes
import { authRouter } from './routes/auth.routes';
import { experienceRouter } from './routes/experience.routes';
import { sectionRouter } from './routes/section.routes';
import { blockRouter } from './routes/block.routes';
import { mediaRouter } from './routes/media.routes';
import { memoryRouter } from './routes/memory.routes';
import { openWhenRouter } from './routes/openWhen.routes';
import { futureLetterRouter } from './routes/futureLetter.routes';
import { finalSurpriseRouter } from './routes/finalSurprise.routes';
import { themeRouter } from './routes/theme.routes';
import { publicRouter } from './routes/public.routes';

export function createApp() {
  const app = express();

  // Security
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(config.COOKIE_SECRET));

  // Logging
  app.use(requestLogger);

  // Serve uploaded files (local dev only)
  if (config.MEDIA_STORAGE_PROVIDER === 'local') {
    app.use('/uploads', express.static(config.MEDIA_LOCAL_PATH));
  }

  app.set('trust proxy', 1);

  // API routes
  app.use('/api/auth', authRouter);
  app.get('/api/me', authenticate, async (req, res, next) => {
    try {
      const { prisma } = await import('./config/prisma');
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      res.json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  });
  app.use('/api', experienceRouter);
  app.use('/api', sectionRouter);
  app.use('/api', blockRouter);
  app.use('/api', mediaRouter);
  app.use('/api', memoryRouter);
  app.use('/api', openWhenRouter);
  app.use('/api', futureLetterRouter);
  app.use('/api', finalSurpriseRouter);
  app.use('/api/themes', themeRouter);
  app.use('/api/public', publicRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
