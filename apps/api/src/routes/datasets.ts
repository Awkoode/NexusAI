/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { buildUploadMiddleware } from '../controllers/datasets';
import {
  listProjectDatasets,
  uploadDataset,
  getDatasetById,
  getDatasetPreview,
  getDatasetProfile,
  deleteDatasetById,
} from '../controllers/datasets';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const upload = buildUploadMiddleware();

// NOTE: authenticateToken is applied per-route (not via router.use) so that
// unknown /api/v1/* paths still fall through to the 404 handler.

// POST /api/v1/projects/:projectId/datasets — CSV upload (multipart/form-data, field "file")
router.post(
  '/projects/:projectId/datasets',
  authenticateToken,
  upload.single('file'),
  asyncHandler(uploadDataset)
);

// GET /api/v1/projects/:projectId/datasets — list datasets of a project
router.get('/projects/:projectId/datasets', authenticateToken, asyncHandler(listProjectDatasets));

// GET /api/v1/datasets/:datasetId — metadata
router.get('/datasets/:datasetId', authenticateToken, asyncHandler(getDatasetById));

// GET /api/v1/datasets/:datasetId/preview — sample rows
router.get('/datasets/:datasetId/preview', authenticateToken, asyncHandler(getDatasetPreview));

// GET /api/v1/datasets/:datasetId/profile — descriptive statistics
router.get('/datasets/:datasetId/profile', authenticateToken, asyncHandler(getDatasetProfile));

// DELETE /api/v1/datasets/:datasetId — delete metadata + stored object
router.delete('/datasets/:datasetId', authenticateToken, asyncHandler(deleteDatasetById));

export default router;
