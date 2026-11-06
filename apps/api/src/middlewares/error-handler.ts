import type { NextFunction, Request, Response } from 'express';

// Último middleware da cadeia: transforma qualquer erro não tratado numa resposta 500 simples.
// O Express 5 já encaminha para cá os erros de handlers async.
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor' });
}
