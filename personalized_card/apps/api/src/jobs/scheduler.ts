import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

export function startScheduledJobs() {
  // Check and unlock future letters every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const toUnlock = await prisma.futureLetter.findMany({
        where: { unlockDate: { lte: now }, unlockedAt: null },
      });

      if (toUnlock.length > 0) {
        await prisma.futureLetter.updateMany({
          where: { id: { in: toUnlock.map((l) => l.id) } },
          data: { unlockedAt: now },
        });
        logger.info(`Unlocked ${toUnlock.length} future letter(s)`);
      }
    } catch (err) {
      logger.error('Scheduled unlock job failed', { error: err });
    }
  });

  logger.info('⏰ Scheduled jobs started');
}
