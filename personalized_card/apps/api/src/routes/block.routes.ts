import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { CreateBlockSchema, UpdateBlockSchema, ReorderSchema } from '@letter/validation';

export const blockRouter = Router();
blockRouter.use(authenticate);

async function assertSectionOwnership(sectionId: string, userId: string) {
  const section = await prisma.experienceSection.findUnique({ where: { id: sectionId } });
  if (!section) throw { statusCode: 404, code: 'NOT_FOUND', message: 'Section not found' };
  await experienceService.assertOwnership(section.experienceId, userId);
  return section;
}

blockRouter.get('/sections/:id/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertSectionOwnership(req.params.id, req.user!.userId);
    const blocks = await prisma.contentBlock.findMany({
      where: { sectionId: req.params.id },
      include: { media: true },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: blocks });
  } catch (err) { next(err); }
});

blockRouter.post('/sections/:id/blocks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertSectionOwnership(req.params.id, req.user!.userId);
    const input = CreateBlockSchema.parse(req.body);
    const count = await prisma.contentBlock.count({ where: { sectionId: req.params.id } });
    const block = await prisma.contentBlock.create({
      data: { ...input, sectionId: req.params.id, order: input.order ?? count },
      include: { media: true },
    });
    res.status(201).json({ success: true, data: block });
  } catch (err) { next(err); }
});

blockRouter.patch('/blocks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const block = await prisma.contentBlock.findUnique({ where: { id: req.params.id } });
    if (!block) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Block not found' });
    await assertSectionOwnership(block.sectionId, req.user!.userId);
    const input = UpdateBlockSchema.parse(req.body);
    const updated = await prisma.contentBlock.update({
      where: { id: req.params.id },
      data: input,
      include: { media: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

blockRouter.delete('/blocks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const block = await prisma.contentBlock.findUnique({ where: { id: req.params.id } });
    if (!block) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Block not found' });
    await assertSectionOwnership(block.sectionId, req.user!.userId);
    await prisma.contentBlock.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

blockRouter.post('/sections/:id/blocks/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await assertSectionOwnership(req.params.id, req.user!.userId);
    const { ids } = ReorderSchema.parse(req.body);
    await prisma.$transaction(
      ids.map((blockId, order) =>
        prisma.contentBlock.update({ where: { id: blockId }, data: { order } }),
      ),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
