import { describe, expect, it } from 'vitest';
import {
  createFakeScriptInterpreter,
  FAKE_TAKES,
} from '../../src/clients/fake-script-interpreter.js';
import { ScriptInterpretationError } from '../../src/clients/script-interpreter.js';

describe('createFakeScriptInterpreter', () => {
  const interpreter = createFakeScriptInterpreter();

  it('devolve FAKE_TAKES para qualquer roteiro', async () => {
    expect(await interpreter.interpret('qualquer')).toEqual(FAKE_TAKES);
  });

  it('devolve lista vazia quando o texto tem [sem-takes]', async () => {
    expect(await interpreter.interpret('roteiro [sem-takes]')).toEqual([]);
  });

  it('lança ScriptInterpretationError quando o texto tem [erro-ia]', async () => {
    await expect(interpreter.interpret('roteiro [erro-ia]')).rejects.toBeInstanceOf(
      ScriptInterpretationError,
    );
  });
});
