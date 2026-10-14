/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projects';

const router = Router();

// All project routes require authentication
router.use(authenticateToken);

// Wrapper to handle async errors
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET /api/v1/projects - List user's projects
router.get('/', asyncHandler(listProjects));

// POST /api/v1/projects - Create a new project
router.post('/', asyncHandler(createProject));

// GET /api/v1/projects/:id - Get a specific project
router.get('/:id', asyncHandler(getProject));

// PATCH /api/v1/projects/:id - Update a project
router.patch('/:id', asyncHandler(updateProject));

// DELETE /api/v1/projects/:id - Delete a project
router.delete('/:id', asyncHandler(deleteProject));

export default router;