import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { FinalSurpriseSchema } from '@letter/validation';

export const finalSurpriseRouter: Router = Router();
finalSurpriseRouter.use(authenticate);

finalSurpriseRouter.get('/experiences/:id/final-surprise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const surprise = await prisma.finalSurprise.findUnique({ where: { experienceId: req.params.id } });
    res.json({ success: true, data: surprise });
  } catch (err) { next(err); }
});

finalSurpriseRouter.put('/experiences/:id/final-surprise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const input = FinalSurpriseSchema.parse(req.body);
    const options = input.options ?? Prisma.JsonNull;
    const surprise = await prisma.finalSurprise.upsert({
      where: { experienceId: req.params.id },
      create: {
        ...input,
        options,
        experienceId: req.params.id,
      } satisfies Prisma.FinalSurpriseUncheckedCreateInput,
      update: {
        ...input,
        options,
      } satisfies Prisma.FinalSurpriseUncheckedUpdateInput,
    });
    res.json({ success: true, data: surprise });
  } catch (err) { next(err); }
});

finalSurpriseRouter.delete('/experiences/:id/final-surprise', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    await prisma.finalSurprise.deleteMany({ where: { experienceId: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// Creator view responses
finalSurpriseRouter.get('/experiences/:id/responses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const responses = await prisma.response.findMany({
      where: { experienceId: req.params.id },
      orderBy: { respondedAt: 'desc' },
    });
    res.json({ success: true, data: responses });
  } catch (err) { next(err); }
});
