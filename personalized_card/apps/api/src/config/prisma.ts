import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prismaClientOptions = {
  log: [
    { level: 'error' as const, emit: 'event' as const },
    { level: 'warn' as const, emit: 'event' as const },
  ],
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient<typeof prismaClientOptions> | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient(prismaClientOptions);

prisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));
prisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
