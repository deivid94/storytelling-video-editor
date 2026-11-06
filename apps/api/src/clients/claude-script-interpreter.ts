import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { interpretedScriptSchema } from '../schemas/project.schemas.js';
import { ScriptInterpretationError, type ScriptInterpreter } from './script-interpreter.js';

const SCRIPT_SYSTEM_PROMPT = `Você interpreta roteiros de vídeo de treino e devolve os takes em formato estruturado.

Regras:
- Extraia somente os takes, na mesma ordem em que aparecem no texto.
- Ignore seções que não são takes (por exemplo, "Antes de gravar").
- Durações são em segundos. Quando o texto trouxer um valor único, use-o como mínimo e como máximo.
- Linhas logo abaixo de um take que o complementam (por exemplo, "Grave 2-3 reps...") entram na ação daquele take.
- hasExecution é verdadeiro quando o take mostra o exercício sendo executado.
- Instruções de edição (por exemplo, "desacelere 30-50%", "em 60fps") vão para notes.
- framing: use close, medium ou wide quando o texto disser (close, plano médio, plano largo/aberto); caso contrário, null.
- Lente, distância e ângulo: copie do texto; se não houver, null.`;

export function createClaudeScriptInterpreter(options: {
  client: Pick<Anthropic, 'messages'>;
  model: string;
}): ScriptInterpreter {
  return {
    async interpret(scriptText) {
      let response;
      try {
        response = await options.client.messages.parse({
          model: options.model,
          max_tokens: 16000,
          system: SCRIPT_SYSTEM_PROMPT,
          output_config: { effort: 'low', format: zodOutputFormat(interpretedScriptSchema) },
          messages: [{ role: 'user', content: scriptText }],
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new ScriptInterpretationError('A chamada ao Claude falhou', { cause: error });
        }
        throw error;
      }

      if (response.stop_reason !== 'end_turn' || response.parsed_output === null) {
        throw new ScriptInterpretationError(
          `O Claude não devolveu um roteiro válido (stop_reason: ${response.stop_reason})`,
        );
      }

      // Reaplica o schema para descartar campos desconhecidos.
      const parsed = interpretedScriptSchema.safeParse(response.parsed_output);
      if (!parsed.success) {
        throw new ScriptInterpretationError('O Claude devolveu takes fora do formato esperado', {
          cause: parsed.error,
        });
      }
      return parsed.data.takes;
    },
  };
}
