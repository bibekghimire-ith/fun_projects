import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { experienceService } from '../services/experience.service';
import { templateService } from '../services/template.service';
import {
  ApplyTemplateSchema,
  CreateFromTemplateSchema,
  PinSchema,
  PublishOptionsSchema,
  SetThemeSchema,
  UpdateExperienceSchema,
} from '@letter/validation';
import { config } from '../config/env';

// QR code (lazy import)
async function generateQR(url: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(url);
}

/** One CSV field: always quoted, with any embedded quote doubled. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export const experienceRouter = Router();
experienceRouter.use(authenticate);

experienceRouter.get('/experiences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await experienceService.list(req.user!.userId);
    res.json({ success: true, data: list });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateSlug, ...input } = CreateFromTemplateSchema.parse(req.body);

    // Check the slug before creating anything, so an unknown template can never
    // leave a stray empty experience behind.
    if (templateSlug) templateService.get(templateSlug);

    const exp = await experienceService.create(req.user!.userId, input);

    if (templateSlug) {
      const withTemplate = await templateService.apply(exp.id, req.user!.userId, {
        slug: templateSlug,
        mode: 'REPLACE',
        includeTheme: true,
        includeConfig: true,
        includeExtras: true,
      });
      return res.status(201).json({ success: true, data: withTemplate });
    }

    res.status(201).json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/apply-template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ApplyTemplateSchema.parse(req.body);
    const exp = await templateService.apply(req.params.id, req.user!.userId, input);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.get('/experiences/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await experienceService.getOne(req.params.id, req.user!.userId);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.patch('/experiences/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = UpdateExperienceSchema.parse(req.body);
    const exp = await experienceService.update(req.params.id, req.user!.userId, input);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.delete('/experiences/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.delete(req.params.id, req.user!.userId);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

experienceRouter.get('/experiences/:id/publish-check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const check = await experienceService.publishCheck(req.params.id, req.user!.userId);
    res.json({ success: true, data: check });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = PublishOptionsSchema.parse(req.body ?? {});
    const exp = await experienceService.publish(req.params.id, req.user!.userId, options);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const copy = await experienceService.duplicate(req.params.id, req.user!.userId);
    res.status(201).json({ success: true, data: copy });
  } catch (err) { next(err); }
});

experienceRouter.get('/experiences/:id/responses/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const responses = await experienceService.listResponses(req.params.id, req.user!.userId);
    const rows = [
      'answer,respondedAt',
      ...responses.map((r) => `${csvCell(r.answer)},${csvCell(r.respondedAt.toISOString())}`),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="responses-${req.params.id}.csv"`);
    res.send(`${rows.join('\n')}\n`);
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/unpublish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await experienceService.unpublish(req.params.id, req.user!.userId);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/revoke', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await experienceService.revoke(req.params.id, req.user!.userId);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = PinSchema.parse(req.body);
    await experienceService.setPin(req.params.id, req.user!.userId, pin);
    res.json({ success: true, data: { pinEnabled: true } });
  } catch (err) { next(err); }
});

experienceRouter.delete('/experiences/:id/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await experienceService.setPin(req.params.id, req.user!.userId, null);
    res.json({ success: true, data: { pinEnabled: false } });
  } catch (err) { next(err); }
});

experienceRouter.post('/experiences/:id/theme', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { themeId } = SetThemeSchema.parse(req.body);
    const exp = await experienceService.setTheme(req.params.id, req.user!.userId, themeId);
    res.json({ success: true, data: exp });
  } catch (err) { next(err); }
});

experienceRouter.get('/experiences/:id/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await experienceService.assertOwnership(req.params.id, req.user!.userId);
    const url = `${config.WEB_BASE_URL}/e/${exp.publicToken}`;
    const qrCode = await generateQR(url);
    res.json({
      success: true,
      // `token`/`qrCode` are kept for existing callers; the rest matches ShareInfo.
      data: {
        url,
        token: exp.publicToken,
        qrCode,
        publicToken: exp.publicToken,
        qrDataUrl: qrCode,
        pinEnabled: exp.pinEnabled,
        status: exp.status,
      },
    });
  } catch (err) { next(err); }
});
