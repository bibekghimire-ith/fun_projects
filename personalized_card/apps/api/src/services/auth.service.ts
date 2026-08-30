import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '@letter/validation';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id, user.email);

    return { user, accessToken, refreshToken };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id, user.email);

    return {
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string) {
    try {
      const payload = jwt.verify(token, config.REFRESH_TOKEN_SECRET) as {
        userId: string;
        email: string;
      };
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'User not found');

      const accessToken = this.signAccessToken(user.id, user.email);
      const refreshToken = this.signRefreshToken(user.id, user.email);
      return { accessToken, refreshToken };
    } catch {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid refresh token');
    }
  }

  private signAccessToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  private signRefreshToken(userId: string, email: string): string {
    return jwt.sign({ userId, email }, config.REFRESH_TOKEN_SECRET, {
      expiresIn: config.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }
}

export const authService = new AuthService();
