import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error.js';
import {
  findTakeErrors,
  normalizeTakes,
  validateScriptText,
} from '../../src/services/take-rules.js';
import type { InterpretedTake } from '../../src/types/project.js';

function take(overrides: Partial<InterpretedTake> = {}): InterpretedTake {
  return {
    name: 'Chegada',
    minSeconds: 2,
    maxSeconds: 3,
    action: 'entra no quadro',
    framing: 'wide',
    lens: '24mm',
    distance: '3-4m',
    angle: 'câmera baixa',
    hasExecution: false,
    notes: [],
    ...overrides,
  };
}

describe('validateScriptText', () => {
  it('devolve o texto sem espaços nas pontas', () => {
    expect(validateScriptText('  Gancho (1-2s): close  ')).toBe('Gancho (1-2s): close');
  });
  it.each([
    ['', 'O roteiro está vazio.'],
    ['   \n\t ', 'O roteiro está vazio.'],
    ['🎬 🔧 💡', 'O roteiro não tem texto, só símbolos ou emojis.'],
    ['a'.repeat(20_001), 'O roteiro passa de 20.000 caracteres.'],
  ])('rejeita %#', (text, message) => {
    expect(() => validateScriptText(text)).toThrow(new AppError(400, message));
  });
  it('aceita exatamente 20.000 caracteres', () => {
    expect(validateScriptText('a'.repeat(20_000))).toHaveLength(20_000);
  });
});

describe('normalizeTakes', () => {
  it('numera na ordem recebida a partir de 1', () => {
    const result = normalizeTakes([take({ name: 'A' }), take({ name: 'B' })]);
    expect(result.map((t) => t.number)).toEqual([1, 2]);
  });
  it('tira espaços e transforma texto opcional vazio em null', () => {
    const [result] = normalizeTakes([take({ name: ' Gancho ', lens: '  ', angle: '' })]);
    expect(result).toMatchObject({ name: 'Gancho', lens: null, angle: null });
  });
  it('remove notas vazias e arredonda segundos para 1 casa decimal', () => {
    const [result] = normalizeTakes([take({ notes: [' desacelere ', ''], minSeconds: 1.26 })]);
    expect(result).toMatchObject({ notes: ['desacelere'], minSeconds: 1.3 });
  });
  it('devolve lista vazia para lista vazia', () => {
    expect(normalizeTakes([])).toEqual([]);
  });
});

describe('findTakeErrors', () => {
  it('não acusa nada num take válido', () => {
    expect(findTakeErrors(normalizeTakes([take()]))).toEqual([]);
  });
  it('aceita duração única (mínimo igual ao máximo)', () => {
    expect(findTakeErrors(normalizeTakes([take({ minSeconds: 2, maxSeconds: 2 })]))).toEqual([]);
  });
  it.each([
    [{ name: '' }, 'name', 'O nome do take é obrigatório.'],
    [{ action: ' ' }, 'action', 'Descreva a ação do take.'],
    [{ minSeconds: 0 }, 'minSeconds', 'A duração mínima precisa ser maior que zero.'],
    [{ minSeconds: -1 }, 'minSeconds', 'A duração mínima precisa ser maior que zero.'],
    [{ minSeconds: Number.NaN }, 'minSeconds', 'A duração mínima precisa ser maior que zero.'],
    [
      { minSeconds: 6, maxSeconds: 4 },
      'maxSeconds',
      'A duração máxima não pode ser menor que a mínima.',
    ],
    [{ maxSeconds: 61 }, 'maxSeconds', 'Um take não pode passar de 60 segundos.'],
  ])('acusa %o', (override, field, message) => {
    const takes = [{ ...normalizeTakes([take()])[0]!, ...override }];
    expect(findTakeErrors(takes)).toContainEqual({ takeNumber: 1, field, message });
  });
  it('acusa numeração fora de sequência', () => {
    const takes = normalizeTakes([take(), take()]).map((t, i) => ({
      ...t,
      number: i === 1 ? 3 : 1,
    }));
    expect(findTakeErrors(takes)).toContainEqual({
      takeNumber: 3,
      field: 'number',
      message: 'Os takes precisam estar numerados em sequência a partir de 1.',
    });
  });
});
