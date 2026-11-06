# Fatia 1: Roteiro → takes estruturados — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário cola o roteiro, o app cria um projeto, interpreta o texto com o Claude e mostra uma tabela de takes editável que é salva no disco.

**Architecture:** Backend Express em camadas (routes → controllers → middlewares → services → repositories), com um adaptador `clients/` para a API do Claude, injetado no app para os testes trocarem por um falso. Projetos são arquivos JSON em `data/projects/<id>/project.json`. Frontend React com `api/` (chamadas HTTP), `hooks/` (estado), `lib/` (funções puras) e `components/` (tela).

**Tech Stack:** Node 26, pnpm 12, TypeScript 6, Express 5, Zod, `@anthropic-ai/sdk` (structured outputs com `zodOutputFormat`), React 19, Vite 8, Vitest 5 + Testing Library, Playwright.

**Spec:** [`docs/superpowers/specs/2026-11-05-editor-storytelling-design.md`](../specs/2026-11-05-editor-storytelling-design.md) — seções 5 (passos 3-4), 6.1, 11, 13 (Roteiro) e 14 (fatia 1).

## Global Constraints

- Seguir [`docs/engineering.md`](../../engineering.md) e o `CLAUDE.md`: pnpm (nunca npm/yarn), Context7 antes de usar API de biblioteca, TDD com casos de borda, código que um júnior entende.
- **Pré-requisito:** o PR #1 (Node 26 + pnpm 12 + regras de segurança do pnpm) precisa estar na `main`. Criar a branch `feat/fatia-1-roteiro` a partir da `main` atualizada.
- Novas dependências entram com `pnpm --filter <app> add <pacote>` e precisam passar no `minimumReleaseAge` de 7 dias. Não adicionar exceções sem perguntar ao usuário.
- Textos para o usuário em português, exatamente como estão neste plano. Nomes de código em inglês.
- Modelo do Claude configurável por `CLAUDE_SCRIPT_MODEL`, padrão `claude-opus-5-5`, com `output_config.effort: 'low'` (extração simples).
- Testes nunca chamam a API real do Claude. O e2e usa `SCRIPT_INTERPRETER=fake`.
- Limites: roteiro com até **20.000** caracteres; até **50** takes; take com até **60s**; corpo JSON até **200kb**.

## Review Focus

1. **ID de projeto malicioso na URL** (`..%2F..%2Fetc`, `abc`): responde 404 e nunca lê fora de `data/`. Teste na Task 2.
2. **Duração digitada com vírgula** ("1,5"): vira 1.5, e não 15 nem erro. Teste na Task 6.
3. **`project.json` corrompido no disco** (editado à mão ou gravação interrompida): resposta 500 com mensagem clara, e não um crash. Teste na Task 2; a gravação usa arquivo temporário + rename.
4. **Claude devolve takes com regra quebrada** (mínimo > máximo, duração 0): o projeto é salvo e os erros aparecem na linha do take. Teste nas Tasks 4 e 8.
5. **Duplo clique em "Interpretar roteiro"**: o botão fica desabilitado enquanto carrega, então não cria dois projetos. Teste na Task 8.

---

## Estrutura de arquivos

```
apps/api/src/
  config.ts                         # lê env: porta, pasta de dados, interpretador, modelo
  types/project.ts                  # ScriptTake, Project, ProjectView, TakeError, InterpretedTake
  errors/app-error.ts               # AppError(status, message)
  services/take-rules.ts            # regras puras: validar texto, normalizar e checar takes
  services/project.service.ts       # criar, buscar, atualizar takes
  repositories/project.repository.ts# JSON em data/projects/<id>/project.json
  clients/script-interpreter.ts     # interface + ScriptInterpretationError
  clients/claude-script-interpreter.ts
  clients/fake-script-interpreter.ts
  schemas/project.schemas.ts        # zod: corpo das requisições + saída do Claude
  middlewares/validate-body.ts
  middlewares/error-handler.ts      # (modificar)
  controllers/project.controller.ts
  routes/project.routes.ts
  app.ts / server.ts                # (modificar) injeção de dependências
apps/api/test/                      # espelha src/
apps/web/src/
  api/projects.ts                   # chamadas HTTP + tipos espelhados da API
  lib/duration.ts                   # parseSecondsInput, formatDurationRange
  lib/takes.ts                      # createEmptyTake, renumberTakes
  hooks/use-project-editor.ts
  components/ScriptForm.tsx
  components/TakesTable.tsx
  components/InterpretationAlert.tsx
  App.tsx                           # (modificar)
apps/web/vitest.setup.ts            # cleanup do Testing Library
e2e/script.spec.ts
docs/api.md
```

**Camada extra `clients/`:** é o adaptador para serviços externos (API do Claude). Não é repository (não guarda dados) nem service (não tem regra de negócio). Separar deixa o service testável com um interpretador falso.

**Tipos duplicados no frontend:** `apps/web/src/api/projects.ts` repete os tipos da API. Um pacote compartilhado (`packages/shared`) fica para quando a duplicação crescer (YAGNI nesta fatia).

## Sugestão de PRs

| PR  | Tasks      | Por quê                                    |
| --- | ---------- | ------------------------------------------ |
| A   | 1, 2, 3, 4 | regra de negócio do backend, com os testes |
| B   | 5          | camada HTTP (pode ser maior)               |
| C   | 6, 7, 8    | frontend                                   |
| D   | 9          | e2e e docs                                 |

---

### Task 1: Tipos e regras dos takes

**Files:**

- Create: `apps/api/src/types/project.ts`, `apps/api/src/errors/app-error.ts`, `apps/api/src/services/take-rules.ts`
- Test: `apps/api/test/services/take-rules.test.ts`

**Interfaces:**

- Produces:

```ts
// types/project.ts
export type Framing = 'close' | 'medium' | 'wide';
export interface ScriptTake {
  number: number; // ordem no roteiro, começa em 1
  name: string;
  minSeconds: number;
  maxSeconds: number;
  action: string;
  framing: Framing | null;
  lens: string | null;
  distance: string | null;
  angle: string | null;
  hasExecution: boolean;
  notes: string[]; // instruções que o MVP não executa, ex.: "desacelere 30-50%"
}
export type InterpretedTake = Omit<ScriptTake, 'number'>;
export interface TakeError { takeNumber: number; field: keyof ScriptTake; message: string }
export interface Project {
  id: string;
  createdAt: string; // ISO 8601
  scriptText: string;
  takes: ScriptTake[];
  interpretationError: string | null;
}
export interface ProjectView extends Project { takeErrors: TakeError[] }

// errors/app-error.ts
export class AppError extends Error { constructor(readonly status: number, message: string) }

// services/take-rules.ts
export const MAX_SCRIPT_LENGTH = 20_000;
export const MAX_TAKE_SECONDS = 60;
export function validateScriptText(text: string): string; // devolve o texto sem espaços nas pontas
export function normalizeTakes(takes: InterpretedTake[]): ScriptTake[];
export function findTakeErrors(takes: ScriptTake[]): TakeError[];
```

- [ ] **Step 1: Write the failing tests**

```ts
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
```

`take(overrides)` é um helper no próprio arquivo de teste que devolve um `InterpretedTake` válido: `{ name: 'Chegada', minSeconds: 2, maxSeconds: 3, action: 'entra no quadro', framing: 'wide', lens: '24mm', distance: '3-4m', angle: 'câmera baixa', hasExecution: false, notes: [] }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/test/services/take-rules.test.ts`
Expected: FAIL, os módulos não existem.

- [ ] **Step 3: Implement os tipos, `AppError` e as três funções de `take-rules.ts`**

- "Só emojis": rejeitar quando o texto não tem nenhuma letra nem número (`/[\p{L}\p{N}]/u`).
- `findTakeErrors` devolve **todos** os erros de todos os takes, na ordem dos takes. Um take com `minSeconds` inválido não recebe também o erro de `maxSeconds`.
- `AppError` define `this.name = 'AppError'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/api/test/services/take-rules.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/types apps/api/src/errors apps/api/src/services/take-rules.ts apps/api/test/services
git commit -m "feat(api): regras de validação do roteiro e dos takes"
```

---

### Task 2: Repository de projetos em arquivos JSON

**Files:**

- Create: `apps/api/src/repositories/project.repository.ts`
- Test: `apps/api/test/repositories/project.repository.test.ts`
- Delete: `apps/api/src/repositories/.gitkeep`

**Interfaces:**

- Consumes: `Project`, `AppError` (Task 1)
- Produces:

```ts
export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
}
export function createFileProjectRepository(dataDir: string): ProjectRepository;
```

- [ ] **Step 1: Write the failing tests**

Cada teste usa uma pasta temporária nova (`fs.mkdtemp(path.join(os.tmpdir(), 'projects-'))`) e apaga no `afterEach`.

```ts
it('salva e lê o mesmo projeto', async () => {
  await repository.save(project);
  expect(await repository.findById(project.id)).toEqual(project);
});
it('grava em projects/<id>/project.json', async () => {
  await repository.save(project);
  const file = path.join(dataDir, 'projects', project.id, 'project.json');
  expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(project);
});
it('sobrescreve ao salvar de novo', async () => {
  await repository.save(project);
  await repository.save({ ...project, takes: [] });
  expect((await repository.findById(project.id))?.takes).toEqual([]);
});
it('devolve null para projeto que não existe', async () => {
  expect(await repository.findById(crypto.randomUUID())).toBeNull();
});
it.each(['../../etc/passwd', '..', 'abc', '', `${crypto.randomUUID()}/../x`])(
  'devolve null para id inválido %j sem tocar no disco fora da pasta',
  async (id) => {
    expect(await repository.findById(id)).toBeNull();
  },
);
it('acusa projeto corrompido com AppError 500', async () => {
  const dir = path.join(dataDir, 'projects', project.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'project.json'), '{ quebrado');
  await expect(repository.findById(project.id)).rejects.toThrow(
    new AppError(500, 'O arquivo do projeto está corrompido.'),
  );
});
it('não deixa arquivo temporário para trás', async () => {
  await repository.save(project);
  expect(await fs.readdir(path.join(dataDir, 'projects', project.id))).toEqual(['project.json']);
});
```

`project` é um `Project` válido com `id: crypto.randomUUID()`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/test/repositories/project.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `createFileProjectRepository`**

- Id válido = UUID (regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, sem diferenciar maiúsculas e minúsculas). Id inválido devolve `null` antes de montar qualquer caminho.
- `save`: cria a pasta com `recursive: true`, grava `project.json.tmp` (JSON com 2 espaços) e faz `rename` para `project.json`.
- `findById`: arquivo inexistente (`ENOENT`) devolve `null`; JSON inválido vira o `AppError` do teste; outros erros sobem como estão.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/api/test/repositories/project.repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories apps/api/test/repositories
git commit -m "feat(api): repository de projetos em arquivos JSON"
```

---

### Task 3: Interpretador do roteiro (Claude e falso)

**Files:**

- Create: `apps/api/src/clients/script-interpreter.ts`, `apps/api/src/clients/claude-script-interpreter.ts`, `apps/api/src/clients/fake-script-interpreter.ts`, `apps/api/src/schemas/project.schemas.ts`
- Test: `apps/api/test/clients/claude-script-interpreter.test.ts`, `apps/api/test/clients/fake-script-interpreter.test.ts`

**Interfaces:**

- Consumes: `InterpretedTake` (Task 1)
- Produces:

```ts
// clients/script-interpreter.ts
export interface ScriptInterpreter {
  interpret(scriptText: string): Promise<InterpretedTake[]>;
}
export class ScriptInterpretationError extends Error {} // aceita { cause }

// schemas/project.schemas.ts (só a parte desta task)
export const interpretedScriptSchema: z.ZodType<{ takes: InterpretedTake[] }>;

// clients/claude-script-interpreter.ts
export function createClaudeScriptInterpreter(options: {
  client: Pick<Anthropic, 'messages'>;
  model: string;
}): ScriptInterpreter;

// clients/fake-script-interpreter.ts
export const FAKE_TAKES: InterpretedTake[]; // 2 takes, ver Step 3
export function createFakeScriptInterpreter(): ScriptInterpreter;
```

- [ ] **Step 0: Instalar dependências e conferir a API**

Run: `pnpm --filter api add @anthropic-ai/sdk zod`
Conferir com Context7 (`/anthropics/anthropic-sdk-typescript` e Zod) a assinatura de `client.messages.parse`, `zodOutputFormat` (`@anthropic-ai/sdk/helpers/zod`) e qual versão do Zod o helper aceita.

- [ ] **Step 1: Write the failing tests**

O cliente do Claude é um objeto falso: `{ messages: { parse: vi.fn() } }`.

```ts
it('manda o roteiro com o modelo configurado e esforço baixo', async () => {
  parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { takes: [validTake] } });
  await createClaudeScriptInterpreter({ client, model: 'modelo-x' }).interpret('Gancho (1-2s)');
  expect(parse).toHaveBeenCalledWith(expect.objectContaining({
    model: 'modelo-x',
    output_config: expect.objectContaining({ effort: 'low' }),
    messages: [{ role: 'user', content: 'Gancho (1-2s)' }],
  }));
});
it('devolve os takes da resposta', async () => {
  parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { takes: [validTake] } });
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

// fake
it('devolve FAKE_TAKES para qualquer roteiro', async () => {
  expect(await createFakeScriptInterpreter().interpret('qualquer')).toEqual(FAKE_TAKES);
});
it('devolve lista vazia quando o texto tem [sem-takes]', ...);
it('lança ScriptInterpretationError quando o texto tem [erro-ia]', ...);
```

Se o construtor de `APIConnectionError` for diferente, ajustar conforme o Context7.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/test/clients`
Expected: FAIL

- [ ] **Step 3: Implement**

- `interpretedScriptSchema`: `z.object({ takes: z.array(...) })` com os campos de `InterpretedTake`; `framing` é `z.enum(['close','medium','wide']).nullable()`; textos opcionais `.nullable()`. **Sem** limites numéricos no schema: as regras ficam em `findTakeErrors`, porque structured outputs não aceitam todas as restrições de JSON Schema.
- Chamada: `client.messages.parse({ model, max_tokens: 16000, system: SCRIPT_SYSTEM_PROMPT, output_config: { effort: 'low', format: zodOutputFormat(interpretedScriptSchema) }, messages: [{ role: 'user', content: scriptText }] })`.
- Qualquer `stop_reason` diferente de `end_turn`, `parsed_output` nulo, ou erro `Anthropic.APIError` vira `ScriptInterpretationError` (com `cause`). Outros erros sobem.
- `SCRIPT_SYSTEM_PROMPT` (constante no mesmo arquivo, em português) precisa dizer: extraia só os takes, na ordem do texto; ignore seções que não são takes (ex.: "Antes de gravar"); durações em segundos, e valor único vira mínimo = máximo; linhas logo abaixo de um take que o complementam (ex.: "Grave 2-3 reps...") entram na ação daquele take; `hasExecution` é verdadeiro quando o take mostra o exercício sendo executado; instruções de edição (ex.: "desacelere 30-50%", "em 60fps") vão para `notes`; `framing`: close/medium/wide quando o texto disser (close, plano médio, plano largo/aberto), senão null.
- `FAKE_TAKES`: `{ name: 'Chegada', minSeconds: 2, maxSeconds: 3, action: 'Você entra no quadro e se posiciona', framing: 'wide', lens: '24mm', distance: '3-4m', angle: 'câmera baixa', hasExecution: false, notes: [] }` e `{ name: 'Série pesada', minSeconds: 4, maxSeconds: 6, action: '2-3 reps com descida lenta', framing: 'medium', lens: '52mm', distance: '1,5-2m', angle: 'diagonal 45°', hasExecution: true, notes: ['desacelere 30-50%'] }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/api/test/clients`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/clients apps/api/src/schemas apps/api/test/clients
git commit -m "feat(api): interpretador do roteiro com o Claude e versão falsa para testes"
```

---

### Task 4: Service de projetos

**Files:**

- Create: `apps/api/src/services/project.service.ts`
- Test: `apps/api/test/services/project.service.test.ts`
- Delete: `apps/api/src/services/.gitkeep`

**Interfaces:**

- Consumes: Tasks 1, 2, 3
- Produces:

```ts
export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
  scriptInterpreter: ScriptInterpreter;
  now: () => Date;
  createId: () => string;
}
export interface ProjectService {
  createFromScript(scriptText: string): Promise<ProjectView>;
  getById(id: string): Promise<ProjectView>;
  updateTakes(id: string, takes: InterpretedTake[]): Promise<ProjectView>;
}
export function createProjectService(deps: ProjectServiceDeps): ProjectService;
export const NO_TAKES_MESSAGE = 'Nenhum take encontrado no roteiro. Preencha os takes à mão.';
export const INTERPRETATION_FAILED_MESSAGE =
  'Não foi possível interpretar o roteiro. Preencha os takes à mão.';
```

- [ ] **Step 1: Write the failing tests**

Usar o repository real numa pasta temporária, o interpretador falso, `now` fixo (`2026-11-06T12:00:00.000Z`) e `createId` fixo.

```ts
it('cria o projeto com os takes interpretados e numerados', async () => {
  const view = await service.createFromScript('  roteiro  ');
  expect(view).toMatchObject({
    id: FIXED_ID, createdAt: '2026-11-06T12:00:00.000Z', scriptText: 'roteiro',
    interpretationError: null, takeErrors: [],
  });
  expect(view.takes.map((t) => [t.number, t.name])).toEqual([[1, 'Chegada'], [2, 'Série pesada']]);
});
it('salva o projeto no repository', async () => {
  await service.createFromScript('roteiro');
  expect(await repository.findById(FIXED_ID)).not.toBeNull();
});
it('não chama o interpretador quando o texto é inválido', async () => {
  const interpret = vi.spyOn(interpreter, 'interpret');
  await expect(service.createFromScript('   ')).rejects.toThrow(new AppError(400, 'O roteiro está vazio.'));
  expect(interpret).not.toHaveBeenCalled();
});
it('cria o projeto sem takes e com aviso quando nada é encontrado', async () => {
  const view = await service.createFromScript('[sem-takes] roteiro');
  expect(view).toMatchObject({ takes: [], interpretationError: NO_TAKES_MESSAGE });
});
it('cria o projeto sem takes e com aviso quando a interpretação falha', async () => {
  const view = await service.createFromScript('[erro-ia] roteiro');
  expect(view).toMatchObject({ takes: [], interpretationError: INTERPRETATION_FAILED_MESSAGE });
});
it('salva takes com regra quebrada e devolve os erros', async () => {
  interpreter.interpret = async () => [{ ...FAKE_TAKES[0]!, minSeconds: 6, maxSeconds: 4 }];
  const view = await service.createFromScript('roteiro');
  expect(view.takeErrors).toEqual([{ takeNumber: 1, field: 'maxSeconds',
    message: 'A duração máxima não pode ser menor que a mínima.' }]);
});
it('getById lança 404 para projeto que não existe', async () => {
  await expect(service.getById(crypto.randomUUID()))
    .rejects.toThrow(new AppError(404, 'Projeto não encontrado.'));
});
it('updateTakes renumera, salva e limpa o aviso de interpretação', async () => {
  await service.createFromScript('[sem-takes] roteiro');
  const view = await service.updateTakes(FIXED_ID, [FAKE_TAKES[1]!]);
  expect(view).toMatchObject({ interpretationError: null, takes: [{ number: 1, name: 'Série pesada' }] });
  expect((await repository.findById(FIXED_ID))?.takes).toHaveLength(1);
});
it('updateTakes aceita lista vazia', ...);
it('updateTakes lança 404 para projeto que não existe', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/test/services/project.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `createProjectService`**

- `createFromScript`: `validateScriptText` → `interpret` (só `ScriptInterpretationError` é capturado; o resto sobe) → `normalizeTakes` → salva → devolve a view.
- A view é sempre `{ ...project, takeErrors: findTakeErrors(project.takes) }`, montada por uma função `toView(project)` no mesmo arquivo.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/api/test/services`
Expected: PASS

- [ ] **Step 5: Commit e PR A**

```bash
git add apps/api/src/services apps/api/test/services
git commit -m "feat(api): service de projetos (criar, buscar, atualizar takes)"
```

Rodar `pnpm lint && pnpm typecheck && pnpm test`, fazer push e abrir o **PR A** (Tasks 1-4).

---

### Task 5: Camada HTTP, configuração e injeção de dependências

**Files:**

- Create: `apps/api/src/config.ts`, `apps/api/src/middlewares/validate-body.ts`, `apps/api/src/controllers/project.controller.ts`, `apps/api/src/routes/project.routes.ts`, `docs/api.md`
- Modify: `apps/api/src/schemas/project.schemas.ts` (schemas dos corpos), `apps/api/src/middlewares/error-handler.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/test/health.test.ts` (passa deps), `.env.example`
- Test: `apps/api/test/config.test.ts`, `apps/api/test/routes/project.routes.test.ts`

**Interfaces:**

- Consumes: `ProjectService` (Task 4), `ScriptInterpreter`s (Task 3), `createFileProjectRepository` (Task 2)
- Produces:

```ts
// config.ts
export interface AppConfig {
  port: number; // API_PORT, padrão 3333
  dataDir: string; // DATA_DIR (relativo ao cwd) ou <raiz do repo>/data
  scriptInterpreter: 'claude' | 'fake'; // SCRIPT_INTERPRETER, padrão 'claude'
  claudeScriptModel: string; // CLAUDE_SCRIPT_MODEL, padrão 'claude-opus-5-5'
}
export function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;

// app.ts
export interface AppDeps {
  projectService: ProjectService;
}
export function createApp(deps: AppDeps): express.Express;

// schemas/project.schemas.ts
export const createProjectBodySchema; // { scriptText: string }
export const updateTakesBodySchema; // { takes: InterpretedTake-shaped[] (máx. 50) }

// middlewares/validate-body.ts
export function validateBody(schema: z.ZodType): express.RequestHandler;
```

**Rotas:**

| Método | Caminho                   | Corpo            | Sucesso           |
| ------ | ------------------------- | ---------------- | ----------------- |
| POST   | `/api/projects`           | `{ scriptText }` | 201 `ProjectView` |
| GET    | `/api/projects/:id`       | —                | 200 `ProjectView` |
| PUT    | `/api/projects/:id/takes` | `{ takes }`      | 200 `ProjectView` |

Erros sempre como `{ error: string, details?: { path: string; message: string }[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
// config.test.ts
it('usa os padrões', () => {
  expect(loadConfig({})).toMatchObject({ port: 3333, scriptInterpreter: 'claude', claudeScriptModel: 'claude-opus-5-5' });
  expect(loadConfig({}).dataDir).toMatch(/[\\/]data$/);
});
it('lê as variáveis', () => {
  expect(loadConfig({ API_PORT: '4000', SCRIPT_INTERPRETER: 'fake', CLAUDE_SCRIPT_MODEL: 'm', DATA_DIR: 'x' }))
    .toMatchObject({ port: 4000, scriptInterpreter: 'fake', claudeScriptModel: 'm', dataDir: path.resolve('x') });
});
it.each([['SCRIPT_INTERPRETER', 'gpt'], ['API_PORT', 'abc'], ['API_PORT', '0']])(
  'falha na inicialização com %s=%s', (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow();
  });

// project.routes.test.ts — app com service real, repository em pasta temporária e interpretador falso
it('POST cria o projeto e responde 201', async () => {
  const response = await request(app).post('/api/projects').send({ scriptText: 'roteiro' });
  expect(response.status).toBe(201);
  expect(response.body.takes).toHaveLength(2);
});
it('POST responde 400 com a mensagem do service para roteiro vazio', async () => {
  const response = await request(app).post('/api/projects').send({ scriptText: '  ' });
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: 'O roteiro está vazio.' });
});
it.each([[{}], [{ scriptText: 42 }], [{ scriptText: null }]])('POST responde 400 para corpo %j', async (body) => {
  const response = await request(app).post('/api/projects').send(body);
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Dados inválidos.');
  expect(response.body.details[0].path).toBe('scriptText');
});
it('responde 400 para JSON malformado', async () => {
  const response = await request(app).post('/api/projects')
    .set('Content-Type', 'application/json').send('{ quebrado');
  expect(response.body).toEqual({ error: 'JSON inválido.' });
});
it('responde 413 para corpo acima de 200kb', async () => {
  const response = await request(app).post('/api/projects').send({ scriptText: 'a'.repeat(210_000) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ error: 'Requisição grande demais.' });
});
it('GET devolve o projeto criado', ...);
it.each(['nao-existe', crypto.randomUUID(), '..%2F..%2Fetc'])('GET responde 404 para %s', async (id) => {
  const response = await request(app).get(`/api/projects/${id}`);
  expect(response.status).toBe(404);
});
it('PUT salva os takes e devolve os erros de regra', ...); // take com min > max → 200 e takeErrors preenchido
it('PUT responde 400 para mais de 50 takes', ...);
it('PUT responde 400 para take sem campo obrigatório', ...);
it('erro inesperado responde 500 sem vazar detalhes', ...); // service falso que lança Error('segredo')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/test`
Expected: FAIL

- [ ] **Step 3: Implement**

- `loadConfig`: o padrão de `dataDir` é `path.resolve(import.meta.dirname, '../../../data')` (funciona em `src/` e em `dist/`). Valor inválido lança `Error` com mensagem em português que diz qual variável está errada.
- `updateTakesBodySchema`: os mesmos campos de `interpretedScriptSchema`, com `name` e `action` até 500 caracteres, `notes` até 20 itens, e `takes` com no máximo 50. Pode reaproveitar o schema do take da Task 3.
- `validateBody`: em caso de falha, responde 400 `{ error: 'Dados inválidos.', details }` com `path` juntando o caminho do Zod com `.`. Em caso de sucesso, troca `request.body` pelo valor validado.
- `error-handler`: `AppError` → `status` e `message`; erro do body-parser com `type === 'entity.parse.failed'` → 400 `'JSON inválido.'`; `type === 'entity.too.large'` → 413 `'Requisição grande demais.'`; qualquer outro → 500 `'Erro interno do servidor'` e `console.error`.
- `createApp(deps)`: `express.json({ limit: '200kb' })`, rotas de health e de projetos, `errorHandler` por último.
- `server.ts`: `loadConfig()` → `new Anthropic()` só quando `scriptInterpreter === 'claude'` → `createProjectService({ ..., now: () => new Date(), createId: () => crypto.randomUUID() })` → `createApp`.
- `.env.example`: adicionar `SCRIPT_INTERPRETER=claude`, `CLAUDE_SCRIPT_MODEL=claude-opus-5-5` e `DATA_DIR=` (vazio = padrão), com um comentário de uma linha em cada.
- `docs/api.md`: tabela das rotas acima, formato do `ProjectView` e de erro, e lista das mensagens de erro.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/api/test && pnpm typecheck && pnpm lint`
Expected: PASS, sem erros

- [ ] **Step 5: Teste manual com o Claude de verdade (opcional, custa centavos)**

Com `ANTHROPIC_API_KEY` no `.env`: `pnpm --filter api dev` e, em outro terminal, um `POST /api/projects` com o roteiro de exemplo da seção 6.1 do spec. Esperado: 5 ou 6 takes, "Antes de gravar" ignorado, `notes` do take "Última rep" com a instrução de desacelerar. **Perguntar ao usuário antes**, porque usa a chave e o saldo dele.

- [ ] **Step 6: Commit e PR B**

```bash
git add apps/api .env.example docs/api.md
git commit -m "feat(api): rotas de projetos, configuração e tratamento de erros"
```

Push e abrir o **PR B**.

---

### Task 6: Frontend — cliente da API e funções puras

**Files:**

- Create: `apps/web/src/api/projects.ts`, `apps/web/src/lib/duration.ts`, `apps/web/src/lib/takes.ts`, `apps/web/vitest.setup.ts`
- Modify: `apps/web/vitest.config.ts` (adicionar `setupFiles: ['./vitest.setup.ts']`)
- Test: `apps/web/src/api/projects.test.ts`, `apps/web/src/lib/duration.test.ts`, `apps/web/src/lib/takes.test.ts`
- Delete: `.gitkeep` de `api/` e `lib/`

**Interfaces:**

- Produces:

```ts
// api/projects.ts — tipos iguais aos de apps/api/src/types/project.ts
export type { Framing, ScriptTake, TakeError, ProjectView };
export class ApiError extends Error { constructor(readonly status: number, message: string) }
export function createProject(scriptText: string): Promise<ProjectView>;
export function getProject(id: string): Promise<ProjectView>;
export function updateTakes(id: string, takes: Omit<ScriptTake, 'number'>[]): Promise<ProjectView>;

// lib/duration.ts
export function parseSecondsInput(value: string): number | null;
export function formatDurationRange(minSeconds: number, maxSeconds: number): string;

// lib/takes.ts
export function createEmptyTake(number: number): ScriptTake;
export function renumberTakes(takes: ScriptTake[]): ScriptTake[];
```

- [ ] **Step 0: Instalar**

Run: `pnpm --filter web add -D @testing-library/user-event`

- [ ] **Step 1: Write the failing tests**

```ts
// duration.test.ts
it.each([['2', 2], ['1.5', 1.5], ['1,5', 1.5], [' 3 ', 3], ['0', 0], ['-1', -1]])('parseSecondsInput(%j) = %s', (v, n) => {
  expect(parseSecondsInput(v)).toBe(n);
});
it.each(['', '   ', 'abc', '😀', '1,5,2', '1.2.3', 'Infinity'])('parseSecondsInput(%j) = null', (v) => {
  expect(parseSecondsInput(v)).toBeNull();
});
it.each([[2, 2, '2s'], [1, 2, '1–2s'], [1.5, 2.5, '1,5–2,5s']])('formatDurationRange(%s, %s) = %s', (a, b, text) => {
  expect(formatDurationRange(a, b)).toBe(text);
});

// takes.test.ts
it('createEmptyTake cria um take em branco com o número pedido', () => {
  expect(createEmptyTake(3)).toEqual({ number: 3, name: '', minSeconds: 1, maxSeconds: 2, action: '',
    framing: null, lens: null, distance: null, angle: null, hasExecution: false, notes: [] });
});
it('renumberTakes numera de 1 em diante na ordem atual', ...);

// projects.test.ts — fetch falso com vi.stubGlobal
it('createProject faz POST /api/projects com o texto', ...);
it('lança ApiError com a mensagem do servidor', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'O roteiro está vazio.' }), { status: 400 }));
  await expect(createProject(' ')).rejects.toThrow(new ApiError(400, 'O roteiro está vazio.'));
});
it('lança ApiError genérico quando o servidor não manda JSON', async () => {
  fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }));
  await expect(getProject('x')).rejects.toThrow(new ApiError(502, 'Erro ao falar com o servidor.'));
});
it('lança ApiError quando não há conexão', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(getProject('x')).rejects.toThrow(new ApiError(0, 'Sem conexão com o servidor.'));
});
it('getProject codifica o id na URL', ...); // getProject('a/b') → /api/projects/a%2Fb
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/api apps/web/src/lib`
Expected: FAIL

- [ ] **Step 3: Implement**

- `parseSecondsInput`: tira espaços, troca **uma** vírgula por ponto e aceita só `^-?\d+(\.\d+)?$`.
- `vitest.setup.ts`: `afterEach(cleanup)` do Testing Library.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/web/src/api apps/web/src/lib`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat(web): cliente da API de projetos e funções de duração e takes"
```

---

### Task 7: Frontend — hook `useProjectEditor`

**Files:**

- Create: `apps/web/src/hooks/use-project-editor.ts`
- Test: `apps/web/src/hooks/use-project-editor.test.ts`
- Delete: `apps/web/src/hooks/.gitkeep`

**Interfaces:**

- Consumes: Task 6
- Produces:

```ts
export type EditorStatus = 'idle' | 'loading' | 'saving';
export interface ProjectEditor {
  project: ProjectView | null;
  takes: ScriptTake[]; // cópia local editável
  status: EditorStatus;
  error: string | null; // última falha de rede/servidor
  isDirty: boolean; // takes locais diferentes dos salvos
  savedMessage: string | null; // 'Takes salvos.' depois de salvar
  submitScript(scriptText: string): Promise<void>;
  updateTake(index: number, patch: Partial<Omit<ScriptTake, 'number'>>): void;
  addTake(): void;
  removeTake(index: number): void;
  saveTakes(): Promise<void>;
}
export function useProjectEditor(): ProjectEditor;
```

- [ ] **Step 1: Write the failing tests** (`renderHook` + `vi.mock('../api/projects')`)

```ts
it('começa sem projeto e parado', ...);
it('submitScript passa por loading e guarda o projeto e os takes', ...);
it('submitScript guarda a mensagem do ApiError em error e volta para idle', ...);
it('submitScript ignora uma segunda chamada enquanto a primeira carrega', async () => {
  // createProject pendente; chamar submitScript 2x → createProject chamado 1 vez
});
it('updateTake altera só o take do índice e marca isDirty', ...);
it('addTake adiciona um take em branco no fim com o próximo número', ...);
it('removeTake remove e renumera', ...);
it('saveTakes manda os takes sem o campo number, atualiza o projeto, limpa isDirty e mostra "Takes salvos."', ...);
it('saveTakes com erro mantém as edições locais e isDirty', ...);
it('editar depois de salvar apaga savedMessage', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/hooks`
Expected: FAIL

- [ ] **Step 3: Implement** com `useState`; a trava de duplo clique usa um `useRef` de "carregando", porque o estado do React ainda não mudou na segunda chamada síncrona.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/web/src/hooks`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks
git commit -m "feat(web): hook de edição do projeto"
```

---

### Task 8: Frontend — telas

**Files:**

- Create: `apps/web/src/components/ScriptForm.tsx`, `TakesTable.tsx`, `InterpretationAlert.tsx` (+ um `.test.tsx` para cada)
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`
- Delete: `apps/web/src/components/.gitkeep`

**Interfaces:**

- Consumes: `ProjectEditor` (Task 7), `parseSecondsInput` e `formatDurationRange` (Task 6)
- Produces (props):

```ts
ScriptForm: { onSubmit(scriptText: string): void; isLoading: boolean }
TakesTable: {
  takes: ScriptTake[]; takeErrors: TakeError[]; isSaving: boolean; isDirty: boolean;
  onChange(index: number, patch: Partial<Omit<ScriptTake, 'number'>>): void;
  onAdd(): void; onRemove(index: number): void; onSave(): void;
}
InterpretationAlert: { message: string }
```

**Textos e rótulos fixos** (o e2e depende deles):

- `ScriptForm`: textarea com rótulo **"Roteiro"**, contador **"N / 20.000"**, botão **"Interpretar roteiro"** (texto **"Interpretando…"** enquanto carrega).
- `TakesTable`: cada linha é um grupo com `aria-label="Take N"`. Campos com rótulo **"Nome"**, **"Duração mínima (s)"**, **"Duração máxima (s)"**, **"Ação"**, **"Enquadramento"** (opções "—", "Close", "Médio", "Aberto"), **"Lente"**, **"Distância"**, **"Ângulo"**, **"Tem execução"** (checkbox), **"Notas"** (textarea, uma nota por linha). Botões **"Adicionar take"**, **"Remover take N"**, **"Salvar takes"**. Cada erro de `takeErrors` aparece embaixo do campo dele.
- `InterpretationAlert`: `role="alert"` com a mensagem.
- `App`: título "Storytelling Video Editor"; sem projeto, mostra `ScriptForm`; com projeto, mostra o alerta (se `interpretationError` existir), a `TakesTable`, o `error` com `role="alert"` e `savedMessage` com `role="status"`.

- [ ] **Step 1: Write the failing tests** (Testing Library + user-event)

```ts
// ScriptForm
it('desabilita o botão com texto vazio ou só espaços', ...);
it('desabilita o botão e mostra "Interpretando…" enquanto carrega', ...);
it('chama onSubmit com o texto digitado', ...);
it('mostra o contador de caracteres', ...); // digita 'abc' → "3 / 20.000"

// TakesTable
it('mostra uma linha por take com os valores', ...);
it('duração digitada com vírgula chama onChange com número', async () => {
  // limpa "Duração máxima (s)" do Take 1 e digita "2,5" → onChange(0, { maxSeconds: 2.5 })
});
it('duração inválida chama onChange com 0', ...); // o backend responde com o erro de regra
it('notas: uma por linha, linhas vazias ignoradas', ...);
it('mostra o erro do take embaixo do campo certo', ...);
it('"Salvar takes" fica desabilitado sem alterações ou salvando', ...);
it('"Remover take 2" chama onRemove(1)', ...);
it('sem takes mostra só "Adicionar take"', ...);

// App (mock do hook)
it('sem projeto mostra o formulário', ...);
it('com interpretationError mostra o alerta e a tabela', ...);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src`
Expected: FAIL

- [ ] **Step 3: Implement** os três componentes e o `App`. Inputs de duração são `type="text"` com `inputMode="decimal"`, para a vírgula funcionar em qualquer navegador; o componente guarda o texto digitado e manda `parseSecondsInput(texto) ?? 0` no `onChange`. Estilo mínimo (CSS simples num `App.css`); o layout visual fica para depois.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run apps/web/src && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit e PR C**

```bash
git add apps/web
git commit -m "feat(web): telas do roteiro e da tabela de takes"
```

Push e abrir o **PR C** (Tasks 6-8).

---

### Task 9: End-to-end e documentação

**Files:**

- Create: `e2e/script.spec.ts`
- Modify: `playwright.config.ts`, `README.md`, `e2e/home.spec.ts` (se o título mudar)

- [ ] **Step 1: Configurar o servidor da API do e2e**

No `webServer` da API: `env: { SCRIPT_INTERPRETER: 'fake', DATA_DIR: '../../test-results/e2e-data' }` e `reuseExistingServer: false`, para nunca reaproveitar um servidor de dev que usa o Claude de verdade.

- [ ] **Step 2: Write the failing e2e tests**

```ts
test('interpreta o roteiro e mostra os takes', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Roteiro').fill('Chegada (2-3s): plano largo\nSérie (4-6s): plano médio');
  await page.getByRole('button', { name: 'Interpretar roteiro' }).click();
  await expect(page.getByRole('group', { name: 'Take 1' }).getByLabel('Nome')).toHaveValue('Chegada');
  await expect(page.getByRole('group', { name: 'Take 2' }).getByLabel('Nome')).toHaveValue('Série pesada');
});

test('salva edição e mostra erro de regra', async ({ page }) => {
  // depois de interpretar: Take 1, "Duração máxima (s)" = "1" (menor que a mínima 2) → "Salvar takes"
  await expect(page.getByText('A duração máxima não pode ser menor que a mínima.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Takes salvos.');
});

test('roteiro sem takes permite preencher à mão', async ({ page }) => {
  // fill('[sem-takes] meu roteiro') → interpretar
  await expect(page.getByRole('alert')).toHaveText('Nenhum take encontrado no roteiro. Preencha os takes à mão.');
  await page.getByRole('button', { name: 'Adicionar take' }).click();
  await expect(page.getByRole('group', { name: 'Take 1' })).toBeVisible();
});

test('falha da IA mostra o aviso', ...); // '[erro-ia] ...' → alerta de INTERPRETATION_FAILED_MESSAGE
```

- [ ] **Step 3: Run e2e**

Run: `pnpm test:e2e`
Expected: PASS (os 4 novos + o `home.spec.ts`). Se algum falhar, corrigir o componente (não o teste), salvo se o teste contradisser este plano.

- [ ] **Step 4: Atualizar o README**

Seção "Como usar" com o fluxo da fatia 1, as variáveis novas do `.env` e um link para `docs/api.md`. Atualizar o status ("fatia 1: roteiro").

- [ ] **Step 5: Verificação completa**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: tudo passando

- [ ] **Step 6: Commit e PR D**

```bash
git add e2e playwright.config.ts README.md
git commit -m "test(e2e): fluxo do roteiro e docs da fatia 1"
```

Push, abrir o **PR D** e conferir o CI verde.
