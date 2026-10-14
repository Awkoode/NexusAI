/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createJob,
  listJobs,
  getJobById,
  cancelJob,
} from '../controllers/jobs';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// POST /api/v1/jobs — validate, persist, enqueue → 202 Accepted
router.post('/jobs', authenticateToken, asyncHandler(createJob));

// GET /api/v1/jobs — list own jobs (filters + pagination)
router.get('/jobs', authenticateToken, asyncHandler(listJobs));

// GET /api/v1/jobs/:jobId — job state + result
router.get('/jobs/:jobId', authenticateToken, asyncHandler(getJobById));

// POST /api/v1/jobs/:jobId/cancel — cancel queued/active jobs
router.post('/jobs/:jobId/cancel', authenticateToken, asyncHandler(cancelJob));

export default router;
