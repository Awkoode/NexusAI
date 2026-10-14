/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createExperiment,
  listProjectExperiments,
  getExperimentById,
  listExperimentRuns,
  runExperiment,
  deleteExperimentById,
} from '../controllers/experiments';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// POST /api/v1/experiments — create AND run synchronously (returns 201 with results)
router.post('/experiments', authenticateToken, asyncHandler(createExperiment));

// GET /api/v1/projects/:projectId/experiments — history per project
router.get('/projects/:projectId/experiments', authenticateToken, asyncHandler(listProjectExperiments));

// GET /api/v1/experiments/:id — detail + latest run
router.get('/experiments/:id', authenticateToken, asyncHandler(getExperimentById));

// GET /api/v1/experiments/:id/runs — run history
router.get('/experiments/:id/runs', authenticateToken, asyncHandler(listExperimentRuns));

// POST /api/v1/experiments/:id/run — re-run (new run row), 409-safe via busy check
router.post('/experiments/:id/run', authenticateToken, asyncHandler(runExperiment));

// DELETE /api/v1/experiments/:id — delete experiment + runs (cascade)
router.delete('/experiments/:id', authenticateToken, asyncHandler(deleteExperimentById));

export default router;
