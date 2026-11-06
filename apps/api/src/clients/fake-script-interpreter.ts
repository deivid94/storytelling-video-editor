import type { InterpretedTake } from '../types/project.js';
import { ScriptInterpretationError, type ScriptInterpreter } from './script-interpreter.js';

export const FAKE_TAKES: InterpretedTake[] = [
  {
    name: 'Chegada',
    minSeconds: 2,
    maxSeconds: 3,
    action: 'Você entra no quadro e se posiciona',
    framing: 'wide',
    lens: '24mm',
    distance: '3-4m',
    angle: 'câmera baixa',
    hasExecution: false,
    notes: [],
  },
  {
    name: 'Série pesada',
    minSeconds: 4,
    maxSeconds: 6,
    action: '2-3 reps com descida lenta',
    framing: 'medium',
    lens: '52mm',
    distance: '1,5-2m',
    angle: 'diagonal 45°',
    hasExecution: true,
    notes: ['desacelere 30-50%'],
  },
];

// Marcadores no texto permitem que os testes E2E provoquem cada cenário.
export function createFakeScriptInterpreter(): ScriptInterpreter {
  return {
    async interpret(scriptText) {
      if (scriptText.includes('[erro-ia]')) {
        throw new ScriptInterpretationError('Falha simulada do interpretador');
      }
      if (scriptText.includes('[sem-takes]')) {
        return [];
      }
      return FAKE_TAKES;
    },
  };
}
