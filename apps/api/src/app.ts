import express from 'express';
import { healthRoutes } from './routes/health.routes.js';
import { createProjectRoutes } from './routes/project.routes.js';
import { errorHandler } from './middlewares/error-handler.js';
import type { ProjectService } from './services/project.service.js';

export interface AppDeps {
  projectService: ProjectService;
}

// Monta o app sem abrir porta, para os testes usarem o mesmo app do servidor.
export function createApp(deps: AppDeps) {
  const app = express();

  app.use(express.json({ limit: '200kb' }));
  app.use('/api/health', healthRoutes);
  app.use('/api/projects', createProjectRoutes(deps.projectService));
  app.use(errorHandler);

  return app;
}
