import { describe, expect, it } from 'vitest';
import { createEmptyTake, renumberTakes } from './takes';

describe('createEmptyTake', () => {
  it('cria um take em branco com o número pedido', () => {
    expect(createEmptyTake(3)).toEqual({
      number: 3,
      name: '',
      minSeconds: 1,
      maxSeconds: 2,
      action: '',
      framing: null,
      lens: null,
      distance: null,
      angle: null,
      hasExecution: false,
      notes: [],
    });
  });
});

describe('renumberTakes', () => {
  it('numera de 1 em diante na ordem atual', () => {
    const takes = [createEmptyTake(5), createEmptyTake(2), createEmptyTake(9)];

    expect(renumberTakes(takes).map((take) => take.number)).toEqual([1, 2, 3]);
  });

  it('não altera a lista original', () => {
    const takes = [createEmptyTake(7)];

    renumberTakes(takes);

    expect(takes[0]?.number).toBe(7);
  });

  it('devolve lista vazia para lista vazia', () => {
    expect(renumberTakes([])).toEqual([]);
  });
});
