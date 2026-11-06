import express from 'express';
import { healthRoutes } from './routes/health.routes.js';
import { errorHandler } from './middlewares/error-handler.js';

// Monta o app sem abrir porta, para os testes usarem o mesmo app do servidor.
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api/health', healthRoutes);
  app.use(errorHandler);

  return app;
}
