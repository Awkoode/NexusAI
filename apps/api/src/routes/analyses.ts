/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  runAnalysis,
  listProjectAnalyses,
  getAnalysisById,
  deleteAnalysisById,
} from '../controllers/analyses';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// POST /api/v1/projects/:projectId/analyses — run describe/correlation/covariance/linear_algebra/compare
router.post('/projects/:projectId/analyses', authenticateToken, asyncHandler(runAnalysis));

// GET /api/v1/projects/:projectId/analyses — history per project
router.get('/projects/:projectId/analyses', authenticateToken, asyncHandler(listProjectAnalyses));

// GET /api/v1/analyses/:analysisId — detail
router.get('/analyses/:analysisId', authenticateToken, asyncHandler(getAnalysisById));

// DELETE /api/v1/analyses/:analysisId — delete
router.delete('/analyses/:analysisId', authenticateToken, asyncHandler(deleteAnalysisById));

export default router;
