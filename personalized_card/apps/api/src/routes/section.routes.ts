import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { experienceService } from '../services/experience.service';
import { templateService } from '../services/template.service';
import {
  ApplyPresetSchema,
  CreateSectionSchema,
  ReorderSchema,
  UpdateSectionSchema,
} from '@letter/validation';

export const sectionRouter: Router = Router();
sectionRouter.use(authenticate);

sectionRouter.get('/experiences/:id/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const sections = await prisma.experienceSection.findMany({
      where: { experienceId: req.params.id },
      include: { blocks: { include: { media: true }, orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
});

sectionRouter.post('/experiences/:id/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const input = CreateSectionSchema.parse(req.body);
    const count = await prisma.experienceSection.count({ where: { experienceId: req.params.id } });
    const section = await prisma.experienceSection.create({
      data: { ...input, experienceId: req.params.id, order: input.order ?? count },
      include: { blocks: true },
    });
    res.status(201).json({ success: true, data: section });
  } catch (err) { next(err); }
});

sectionRouter.patch('/sections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await prisma.experienceSection.findUnique({ where: { id: req.params.id } });
    if (!section) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Section not found' });
    await experienceService.assertOwnership(section.experienceId, req.user!.userId);
    const input = UpdateSectionSchema.parse(req.body);
    const updated = await prisma.experienceSection.update({
      where: { id: req.params.id },
      data: input,
      include: { blocks: { include: { media: true } } },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

sectionRouter.delete('/sections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await prisma.experienceSection.findUnique({ where: { id: req.params.id } });
    if (!section) return next({ statusCode: 404, code: 'NOT_FOUND', message: 'Section not found' });
    await experienceService.assertOwnership(section.experienceId, req.user!.userId);
    await prisma.experienceSection.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

sectionRouter.post('/sections/:id/apply-preset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = ApplyPresetSchema.parse(req.body);
    // Ownership is checked inside, via the section's experience.
    const blocks = await templateService.applyPreset(req.params.id, req.user!.userId, slug);
    res.status(201).json({ success: true, data: blocks });
  } catch (err) { next(err); }
});

sectionRouter.post('/experiences/:id/sections/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const { ids } = ReorderSchema.parse(req.body);
    await prisma.$transaction(
      ids.map((sectionId, order) =>
        prisma.experienceSection.update({ where: { id: sectionId }, data: { order } }),
      ),
    );
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});
