import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { AppError } from '../errors/AppError.js';
import { Role, UserStatus, User } from '@prisma/client';

export interface AuthenticatedUser extends Omit<User, 'passwordHash'> {}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired authentication token.', 401, 'TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new AppError('User belonging to this token no longer exists.', 401, 'USER_NOT_FOUND');
    }

    if (user.status === UserStatus.PENDING) {
      throw new AppError('Your account is awaiting administrator verification.', 403, 'ACCOUNT_PENDING');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new AppError('Your account registration was rejected.', 403, 'ACCOUNT_REJECTED');
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new AppError('Your account is currently deactivated.', 403, 'ACCOUNT_INACTIVE');
    }

    // If user must change password, allow access ONLY to change password and me endpoints
    if (user.mustChangePassword) {
      const isAllowedPath = req.path === '/api/auth/change-password' || req.path === '/api/auth/me' || req.path === '/change-password' || req.path === '/me';
      if (!isAllowedPath) {
        throw new AppError('You must change your initial password before accessing system functions.', 403, 'PASSWORD_CHANGE_REQUIRED');
      }
    }

    const { passwordHash, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: You do not have permission to perform this action.', 403, 'FORBIDDEN')
      );
    }

    next();
  };
};
