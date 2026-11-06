import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

// Erros do body-parser (express.json) chegam com um `type` em vez de uma classe própria.
function getBodyParserErrorType(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'type' in error) {
    return String(error.type);
  }
  return undefined;
}

// Último middleware da cadeia: transforma qualquer erro numa resposta { error }.
// O Express 5 já encaminha para cá os erros de handlers async.
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  const bodyParserErrorType = getBodyParserErrorType(error);
  if (bodyParserErrorType === 'entity.parse.failed') {
    response.status(400).json({ error: 'JSON inválido.' });
    return;
  }
  if (bodyParserErrorType === 'entity.too.large') {
    response.status(413).json({ error: 'Requisição grande demais.' });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor' });
}
