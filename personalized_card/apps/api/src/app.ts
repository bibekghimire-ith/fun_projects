import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

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
import { templateRouter } from './routes/template.routes';
import { configRouter } from './routes/config.routes';
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
  // Note: the session-check endpoint is authRouter's GET /api/auth/me — there
  // used to be a byte-for-byte duplicate of it inline here at GET /api/me,
  // which is exactly the kind of copy that quietly drifts once one side gets
  // a fix the other doesn't. Removed in favour of the one canonical route.
  // Routers that serve anonymous callers must be mounted BEFORE the creator
  // routers. Every creator router calls `router.use(authenticate)` with no
  // path, which applies to each request entering it — and they are all mounted
  // on the bare '/api' prefix. So a request for, say, /api/public/e/:token that
  // reached experienceRouter first would be rejected with a 401 before ever
  // getting to publicRouter. Order is what keeps these reachable.
  app.use('/api/public', publicRouter);
  app.use('/api/templates', templateRouter);
  app.use('/api/themes', themeRouter);
  // mediaRouter serves /media/:id/stream anonymously before its own
  // authenticate call, so it belongs on this side of the line too.
  app.use('/api', mediaRouter);

  app.use('/api', experienceRouter);
  app.use('/api', sectionRouter);
  app.use('/api', blockRouter);
  app.use('/api', memoryRouter);
  app.use('/api', openWhenRouter);
  app.use('/api', futureLetterRouter);
  app.use('/api', finalSurpriseRouter);
  app.use('/api', configRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
