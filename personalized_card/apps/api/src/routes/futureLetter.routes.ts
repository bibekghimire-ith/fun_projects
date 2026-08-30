import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { FutureLetterSchema } from '@letter/validation';

export const futureLetterRouter = Router();
futureLetterRouter.use(authenticate);

futureLetterRouter.get('/experiences/:id/future-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const letter = await prisma.futureLetter.findUnique({ where: { experienceId: req.params.id } });
    res.json({ success: true, data: letter });
  } catch (err) { next(err); }
});

futureLetterRouter.put('/experiences/:id/future-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const input = FutureLetterSchema.parse(req.body);
    const letter = await prisma.futureLetter.upsert({
      where: { experienceId: req.params.id },
      create: { ...input, unlockDate: new Date(input.unlockDate), experienceId: req.params.id },
      update: { ...input, unlockDate: new Date(input.unlockDate) },
    });
    res.json({ success: true, data: letter });
  } catch (err) { next(err); }
});

futureLetterRouter.delete('/experiences/:id/future-letter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    await prisma.futureLetter.deleteMany({ where: { experienceId: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
