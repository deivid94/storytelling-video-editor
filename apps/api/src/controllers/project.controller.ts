import type { Request, Response } from 'express';
import type { ProjectService } from '../services/project.service.js';

// O service é recebido por parâmetro (injeção de dependência), então os testes podem trocá-lo.
export function createProjectController(projectService: ProjectService) {
  return {
    async create(request: Request, response: Response) {
      const project = await projectService.createFromScript(request.body.scriptText);
      response.status(201).json(project);
    },

    async get(request: Request<{ id: string }>, response: Response) {
      response.json(await projectService.getById(request.params.id));
    },

    async updateTakes(request: Request<{ id: string }>, response: Response) {
      response.json(await projectService.updateTakes(request.params.id, request.body.takes));
    },
  };
}
