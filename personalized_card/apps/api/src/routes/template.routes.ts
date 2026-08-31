import { Router, Request, Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';

export const templateRouter = Router();

// Templates and presets are static content shipped with the app, so these are
// readable without a token — nothing here belongs to a particular creator.

templateRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: templateService.list() });
  } catch (err) { next(err); }
});

// Registered before '/:slug' so "presets" is never read as a template slug.
templateRouter.get('/presets', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: templateService.listPresets() });
  } catch (err) { next(err); }
});

templateRouter.get('/presets/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: templateService.getPreset(req.params.slug) });
  } catch (err) { next(err); }
});

templateRouter.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: templateService.get(req.params.slug) });
  } catch (err) { next(err); }
});
