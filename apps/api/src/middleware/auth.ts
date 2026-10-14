import type { Request, Response, NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';
import { AppError } from './errorHandler';
import type { AuthUser } from '@nexusai/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      supabase?: SupabaseClient;
    }
  }
}

/**
 * Middleware to authenticate requests using Supabase Auth.
 * Extracts the JWT token from the Authorization header and validates it.
 */
export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('NO_TOKEN', 'Authentication required');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw AppError.unauthorized('NO_TOKEN', 'Authentication required');
    }

    const env = getEnv();

    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw AppError.internal('AUTH_NOT_CONFIGURED', 'Supabase is not configured');
    }

    // Validate token with Supabase
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw AppError.unauthorized('INVALID_TOKEN', 'Invalid or expired token');
    }

    // Attach user and supabase client to request
    req.user = {
      id: user.id,
      email: user.email ?? '', // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
      displayName: (user.user_metadata?.['display_name'] as string | undefined)
        ?? (user.user_metadata?.['full_name'] as string)
        ?? undefined,
    };
    req.supabase = supabase;

    next();
  } catch (error) {
    next(error);
  }
}