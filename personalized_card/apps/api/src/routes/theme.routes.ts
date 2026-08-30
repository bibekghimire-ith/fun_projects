import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const themeRouter = Router();

themeRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const themes = await prisma.theme.findMany({ where: { isBuiltIn: true } });
    res.json({ success: true, data: themes });
  } catch (err) { next(err); }
});
