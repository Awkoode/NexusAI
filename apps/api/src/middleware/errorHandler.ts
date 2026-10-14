import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@nexusai/shared';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: string,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code: string, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 400, details);
  }

  static unauthorized(code: string, message = 'Unauthorized'): AppError {
    return new AppError(code, message, 401);
  }

  static forbidden(code: string, message = 'Forbidden'): AppError {
    return new AppError(code, message, 403);
  }

  static notFound(code: string, message = 'Resource not found'): AppError {
    return new AppError(code, message, 404);
  }

  static internal(code: string, message = 'Internal server error', details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 500, details, false);
  }

  static serviceUnavailable(code: string, message = 'Service temporarily unavailable'): AppError {
    return new AppError(code, message, 503);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = res.getHeader('x-request-id') as string | undefined;

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`Operational error: ${err.message}`, { code: err.code, requestId }, err);
    } else {
      logger.warn(`Client error: ${err.message}`, { code: err.code, statusCode: err.statusCode, requestId });
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: process.env['API_VERSION'] ?? 'v1',
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    logger.warn('Validation error', { errors: err.message, requestId });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: { errors: err.message },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: process.env['API_VERSION'] ?? 'v1',
      },
    };
    res.status(400).json(response);
    return;
  }

  // Multer upload errors (file too large, too many files, etc.)
  if (err.name === 'MulterError') {
    const code = (err as Error & { code?: string }).code;
    const isTooLarge = code === 'LIMIT_FILE_SIZE';
    logger.warn('Upload error', { code, requestId });
    const response: ApiResponse = {
      success: false,
      error: {
        code: isTooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: isTooLarge
          ? 'File exceeds the maximum allowed size'
          : 'File upload failed',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: process.env['API_VERSION'] ?? 'v1',
      },
    };
    res.status(isTooLarge ? 413 : 400).json(response);
    return;
  }

  // Unexpected errors
  logger.error(`Unexpected error: ${err.message}`, { requestId }, err);

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: process.env['API_VERSION'] ?? 'v1',
    },
  };

  res.status(500).json(response);
}

export function notFoundHandler(_req: Request, res: Response): void {
  const requestId = res.getHeader('x-request-id') as string | undefined;

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: process.env['API_VERSION'] ?? 'v1',
    },
  };

  res.status(404).json(response);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  next();
}