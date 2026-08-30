import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { experienceService } from '../services/experience.service';
import { CreateExperienceSchema, UpdateExperienceSchema, PinSchema, SetThemeSchema } from '@letter/validation';
import { config } from '../config/env';

// QR code (lazy import)
async function generateQR(url: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(url);
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
    const input = CreateExperienceSchema.parse(req.body);
    const exp = await experienceService.create(req.user!.userId, input);
    res.status(201).json({ success: true, data: exp });
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

experienceRouter.post('/experiences/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await experienceService.publish(req.params.id, req.user!.userId);
    res.json({ success: true, data: exp });
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
    res.json({ success: true, data: { url, token: exp.publicToken, qrCode, status: exp.status } });
  } catch (err) { next(err); }
});
