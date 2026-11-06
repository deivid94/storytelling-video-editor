import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClaudeScriptInterpreter } from '../../src/clients/claude-script-interpreter.js';
import { ScriptInterpretationError } from '../../src/clients/script-interpreter.js';
import type { InterpretedTake } from '../../src/types/project.js';

const validTake: InterpretedTake = {
  name: 'Gancho',
  minSeconds: 1,
  maxSeconds: 2,
  action: 'Olha para a câmera',
  framing: 'close',
  lens: null,
  distance: null,
  angle: null,
  hasExecution: false,
  notes: [],
};

describe('createClaudeScriptInterpreter', () => {
  const parse = vi.fn();
  const client = { messages: { parse } } as unknown as Pick<Anthropic, 'messages'>;
  const interpreter = createClaudeScriptInterpreter({ client, model: 'modelo-x' });

  beforeEach(() => {
    parse.mockReset();
  });

  it('manda o roteiro com o modelo configurado e esforço baixo', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { takes: [validTake] } });

    await interpreter.interpret('Gancho (1-2s)');

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-x',
        output_config: expect.objectContaining({ effort: 'low' }),
        messages: [{ role: 'user', content: 'Gancho (1-2s)' }],
      }),
    );
  });

  it('devolve os takes da resposta', async () => {
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { takes: [validTake] } });

    expect(await interpreter.interpret('x')).toEqual([validTake]);
  });

  it('descarta campos desconhecidos dos takes', async () => {
    const extra = { ...validTake, campoExtra: 'lixo' };
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { takes: [extra] } });

    expect(await interpreter.interpret('x')).toEqual([validTake]);
  });

  it.each([
    ['resposta fora do schema', { stop_reason: 'end_turn', parsed_output: null }],
    ['recusa', { stop_reason: 'refusal', parsed_output: null }],
    ['resposta cortada', { stop_reason: 'max_tokens', parsed_output: null }],
  ])('lança ScriptInterpretationError em %s', async (_, response) => {
    parse.mockResolvedValue(response);

    await expect(interpreter.interpret('x')).rejects.toBeInstanceOf(ScriptInterpretationError);
  });

  it('lança ScriptInterpretationError quando a API falha', async () => {
    parse.mockRejectedValue(new Anthropic.APIConnectionError({ message: 'offline' }));

    await expect(interpreter.interpret('x')).rejects.toBeInstanceOf(ScriptInterpretationError);
  });

  it('lança ScriptInterpretationError quando o SDK não consegue ler a resposta', async () => {
    parse.mockRejectedValue(new Anthropic.AnthropicError('Failed to parse structured output'));

    await expect(interpreter.interpret('x')).rejects.toBeInstanceOf(ScriptInterpretationError);
  });

  it('deixa subir erros que não são da API', async () => {
    parse.mockRejectedValue(new TypeError('bug'));

    await expect(interpreter.interpret('x')).rejects.toBeInstanceOf(TypeError);
  });
});
