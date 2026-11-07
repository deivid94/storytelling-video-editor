import { Router } from 'express';
import { createProjectController } from '../controllers/project.controller.js';
import { validateBody } from '../middlewares/validate-body.js';
import { createProjectBodySchema, updateTakesBodySchema } from '../schemas/project.schemas.js';
import type { ProjectService } from '../services/project.service.js';

export function createProjectRoutes(projectService: ProjectService) {
  const controller = createProjectController(projectService);
  const router = Router();

  router.post('/', validateBody(createProjectBodySchema), controller.create);
  router.get('/:id', controller.get);
  router.put('/:id/takes', validateBody(updateTakesBodySchema), controller.updateTakes);

  return router;
}
