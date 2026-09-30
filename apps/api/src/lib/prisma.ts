import { PrismaClient } from '@prisma/client';

/** Client unique pour tout le processus : Prisma gère lui-même son pool de connexions. */
export const prisma = new PrismaClient();
