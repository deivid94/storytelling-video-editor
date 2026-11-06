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
