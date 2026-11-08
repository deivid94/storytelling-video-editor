import { z } from 'zod';

// Sem limites numéricos: structured outputs não aceitam todas as restrições de
// JSON Schema. As regras (duração, tamanho) ficam em findTakeErrors.
const interpretedTakeSchema = z.object({
  name: z.string(),
  minSeconds: z.number(),
  maxSeconds: z.number(),
  action: z.string(),
  framing: z.enum(['close', 'medium', 'wide']).nullable(),
  lens: z.string().nullable(),
  distance: z.string().nullable(),
  angle: z.string().nullable(),
  hasExecution: z.boolean(),
  notes: z.array(z.string()),
});

export const interpretedScriptSchema = z.object({
  takes: z.array(interpretedTakeSchema),
});

export const createProjectBodySchema = z.object({
  scriptText: z.string(),
});

// Corpo vindo do navegador: aqui os limites de tamanho podem existir
// (o schema enviado à Claude, acima, continua sem eles).
const MAX_TAKES = 50;
const editableTakeSchema = interpretedTakeSchema.extend({
  name: z.string().max(500),
  action: z.string().max(500),
  notes: z.array(z.string()).max(20),
});

export const scanClipsBodySchema = z.object({
  folder: z.string().max(1000),
});

export const updateTakesBodySchema = z.object({
  takes: z.array(editableTakeSchema).max(MAX_TAKES),
});
