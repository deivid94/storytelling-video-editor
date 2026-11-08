import type { RequestHandler } from 'express';
import type { z } from 'zod';

// Valida request.body com o schema; se passar, o corpo vira o valor já validado.
export function validateBody(schema: z.ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      response.status(400).json({ error: 'Dados inválidos.', details });
      return;
    }
    request.body = result.data;
    next();
  };
}
