import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { CreateMemorySchema, UpdateMemorySchema, ReorderSchema } from '@letter/validation';

export const memoryRouter = Router();
memoryRouter.use(authenticate);

memoryRouter.get('/experiences/:id/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const memories = await prisma.memory.findMany({
      where: { experienceId: req.params.id },
      include: { media: true },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: memories });
  } catch (err) { next(err); }
});

memoryRouter.post('/experiences/:id/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const input = CreateMemorySchema.parse(req.body);
    const count = await prisma.memory.count({ where: { experienceId: req.params.id } });
    const memory = await prisma.memory.create({
      data: {
        ...input,
        date: new Date(input.date),
        experienceId: req.params.id,
        order: input.order ?? count,
      },
      include: { media: true },
    });
    res.status(201).json({ success: true, data: memory });
  } catch (err) { next(err); }
});

memoryRouter.patch('/memories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mem = await prisma.memory.findUnique({ where: { id: req.params.id } });
    if (!mem) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Memory not found' });
    await experienceService.assertOwnership(mem.experienceId, req.user!.userId);
    const input = UpdateMemorySchema.parse(req.body);
    const updated = await prisma.memory.update({
      where: { id: req.params.id },
      data: { ...input, date: input.date ? new Date(input.date) : undefined },
      include: { media: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

memoryRouter.delete('/memories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mem = await prisma.memory.findUnique({ where: { id: req.params.id } });
    if (!mem) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Memory not found' });
    await experienceService.assertOwnership(mem.experienceId, req.user!.userId);
    await prisma.memory.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

memoryRouter.post('/experiences/:id/memories/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const { ids } = ReorderSchema.parse(req.body);
    await prisma.$transaction(ids.map((memId, order) => prisma.memory.update({ where: { id: memId }, data: { order } })));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
