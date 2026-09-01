import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { publicService } from '../services/public.service';
import { VerifyPinSchema, SubmitResponseSchema } from '@letter/validation';
import { config } from '../config/env';

export const publicRouter: Router = Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.PIN_VERIFY_RATE_LIMIT_MAX,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many PIN attempts. Try again later.' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function pinTokenFrom(req: Request) {
  const header = req.headers['x-pin-token'];
  if (typeof header === 'string') return header;
  return req.cookies?.pinToken as string | undefined;
}

publicRouter.use(publicLimiter);

publicRouter.get('/e/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experience = await publicService.getExperience(
      req.params.token,
      req.ip,
      req.headers['user-agent'],
      pinTokenFrom(req),
    );
    res.json({ success: true, data: experience });
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/e/:token/verify', pinLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = VerifyPinSchema.parse(req.body);
    const result = await publicService.verifyPin(req.params.token, pin, req.ip);
    res.cookie('pinToken', result.pinToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/e/:token/open-when/:msgId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await publicService.openWhenMessage(req.params.token, req.params.msgId, pinTokenFrom(req));
    res.json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/e/:token/future-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const letter = await publicService.futureLetter(req.params.token, pinTokenFrom(req));
    res.json({ success: true, data: letter });
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/e/:token/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { answer } = SubmitResponseSchema.parse(req.body);
    const response = await publicService.submitResponse(req.params.token, answer, pinTokenFrom(req));
    res.status(201).json({ success: true, data: response });
  } catch (err) {
    next(err);
  }
});
