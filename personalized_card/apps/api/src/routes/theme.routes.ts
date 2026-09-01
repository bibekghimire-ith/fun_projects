import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { config } from '../config/env';
import { themeService } from '../services/theme.service';
import { CreateThemeSchema, ForkThemeSchema, UpdateThemeSchema } from '@letter/validation';

export const themeRouter: Router = Router();

/**
 * The theme list stays readable without signing in — the recipient view needs
 * the built-ins. When a valid token happens to be present the caller also sees
 * their own themes. An invalid token is treated as no token, never as an error.
 */
function optionalUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

themeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const themes = await themeService.list(optionalUserId(req));
    res.json({ success: true, data: themes });
  } catch (err) { next(err); }
});

themeRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateThemeSchema.parse(req.body);
    const theme = await themeService.create(req.user!.userId, input);
    res.status(201).json({ success: true, data: theme });
  } catch (err) { next(err); }
});

themeRouter.post('/fork', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ForkThemeSchema.parse(req.body);
    const theme = await themeService.fork(req.user!.userId, input);
    res.status(201).json({ success: true, data: theme });
  } catch (err) { next(err); }
});

themeRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = UpdateThemeSchema.parse(req.body);
    const theme = await themeService.update(req.params.id, req.user!.userId, input);
    res.json({ success: true, data: theme });
  } catch (err) { next(err); }
});

themeRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await themeService.remove(req.params.id, req.user!.userId);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
