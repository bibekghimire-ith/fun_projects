import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { configService } from '../services/config.service';
import { ExperienceConfigSchema } from '@letter/validation';

export const configRouter: Router = Router();
configRouter.use(authenticate);

configRouter.get('/experiences/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cfg = await configService.get(req.params.id, req.user!.userId);
    res.json({ success: true, data: cfg });
  } catch (err) { next(err); }
});

configRouter.put('/experiences/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ExperienceConfigSchema.parse(req.body);
    const cfg = await configService.update(req.params.id, req.user!.userId, input);
    res.json({ success: true, data: cfg });
  } catch (err) { next(err); }
});
