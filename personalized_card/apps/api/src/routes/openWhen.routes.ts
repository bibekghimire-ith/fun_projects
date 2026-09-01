import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { CreateOpenWhenSchema, UpdateOpenWhenSchema } from '@letter/validation';

export const openWhenRouter: Router = Router();
openWhenRouter.use(authenticate);

openWhenRouter.get('/experiences/:id/open-when', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const msgs = await prisma.openWhenMessage.findMany({
      where: { experienceId: req.params.id },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: msgs });
  } catch (err) { next(err); }
});

openWhenRouter.post('/experiences/:id/open-when', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const input = CreateOpenWhenSchema.parse(req.body);
    const count = await prisma.openWhenMessage.count({ where: { experienceId: req.params.id } });
    const msg = await prisma.openWhenMessage.create({
      data: {
        ...input,
        unlockDate: input.unlockDate ? new Date(input.unlockDate) : null,
        experienceId: req.params.id,
        order: input.order ?? count,
      },
    });
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
});

openWhenRouter.patch('/open-when/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await prisma.openWhenMessage.findUnique({ where: { id: req.params.id } });
    if (!msg) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Message not found' });
    await experienceService.assertOwnership(msg.experienceId, req.user!.userId);
    const input = UpdateOpenWhenSchema.parse(req.body);
    const updated = await prisma.openWhenMessage.update({
      where: { id: req.params.id },
      data: {
        ...input,
        unlockDate:
          input.unlockDate === undefined
            ? undefined
            : input.unlockDate
              ? new Date(input.unlockDate)
              : null,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

openWhenRouter.delete('/open-when/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await prisma.openWhenMessage.findUnique({ where: { id: req.params.id } });
    if (!msg) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Message not found' });
    await experienceService.assertOwnership(msg.experienceId, req.user!.userId);
    await prisma.openWhenMessage.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// Creator manually unlocks a MANUAL type message
openWhenRouter.post('/open-when/:id/manual-unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const msg = await prisma.openWhenMessage.findUnique({ where: { id: req.params.id } });
    if (!msg) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Message not found' });
    await experienceService.assertOwnership(msg.experienceId, req.user!.userId);
    const updated = await prisma.openWhenMessage.update({
      where: { id: req.params.id },
      data: { openedAt: new Date() },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});
