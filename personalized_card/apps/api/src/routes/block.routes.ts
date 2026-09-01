import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { Prisma } from '@prisma/client';
import {
  CreateBlockSchema,
  ReorderSchema,
  UpdateBlockSchema,
  parseBlockContent,
} from '@letter/validation';

export const blockRouter: Router = Router();
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
    // Content is validated against the schema for this block's type, so a
    // malformed block can never be stored and break the renderer later.
    const content = parseBlockContent(input.type, input.content) as Prisma.InputJsonValue;
    const count = await prisma.contentBlock.count({ where: { sectionId: req.params.id } });
    const block = await prisma.contentBlock.create({
      data: {
        sectionId: req.params.id,
        type: input.type,
        order: input.order ?? count,
        mediaId: input.mediaId ?? null,
        content,
      },
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

    const data: Prisma.ContentBlockUncheckedUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.order !== undefined) data.order = input.order;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.mediaId !== undefined) data.mediaId = input.mediaId;
    if (input.content !== undefined) {
      // Validate against the type the block will have once this update lands.
      // Changing the type without sending new content leaves the old content
      // in place, so send both together when converting a block.
      data.content = parseBlockContent(
        input.type ?? block.type,
        input.content,
      ) as Prisma.InputJsonValue;
    }

    const updated = await prisma.contentBlock.update({
      where: { id: req.params.id },
      data,
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
