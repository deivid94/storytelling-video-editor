# Fatia 2: Clipes → mapeamento take ↔ clipes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o usuário informa a pasta dos clipes e vê, para cada take do roteiro, quais clipes existem, com avisos (take faltando, clipe curto, lente diferente, arquivo ilegível, tentativas faltando, clipe sem take).

**Architecture:** a API lê a pasta (repository), interpreta os nomes `take<N><letra>` (regra pura), lê duração/resolução/rotação/lente de cada clipe com o `ffprobe` (client) e guarda o resultado da leitura no projeto (`clipScan`). O mapeamento com os avisos é **calculado a cada resposta** a partir dos takes atuais e do `clipScan`, então editar os takes atualiza os avisos sem reler a pasta. O frontend só mostra o que a API manda: as mensagens dos avisos vêm prontas do backend.

**Tech Stack:** Node 26 + TypeScript, Express 5, zod 4, Vitest, React + Vite, Playwright, ffmpeg/ffprobe (já instalado no CI).

**Spec:** `docs/superpowers/specs/2026-11-05-editor-storytelling-design.md` (seções 6.2, 7.3, 13 "Clipes", 14 item 2).

## Global Constraints

- pnpm (nunca npm/yarn); APIs de bibliotecas conferidas no Context7. Regras completas em `docs/engineering.md`.
- Backend: routes → controllers → middlewares → services → repositories. Frontend: `api/`, `hooks/`, `lib/`, `components/`.
- Nome do clipe: `take<N><letra opcional>.<ext>`, **sem diferenciar maiúsculas e minúsculas**. Extensões: `.mov` e `.mp4`.
- Arquivos fora do padrão aparecem como **"ignorados", sem erro**.
- A rotação do arquivo é respeitada: largura e altura são as **já rotacionadas** (clipe 1280×720 com rotação -90° vira 720×1280).
- Aviso quando a lente do clipe (`com.blackmagic-design.camera.lensType`) não bate com a do roteiro.
- Aviso quando a exportação vai sair de um clipe com **menos de 1080 pixels no lado menor**.
- Take sem clipe fica marcado como **"faltando"** (a decisão pular/adicionar e o bloqueio da exportação são da fatia 3).
- Fixtures de vídeo: curtas (1 a 3s), H.265, 60fps, verticais com marcação de rotação, baixa resolução, **sem nenhum metadado pessoal** (são sintéticas, geradas por script). Só `.mp4` entra no git; o clipe real `.mov` em `fixtures/videos/` nunca.
- Pareamento por `clipID` e pasta de originais 4K são da fatia 7: não fazer aqui.
- Branch base: `test/fatia-1-e2e` (a fatia 1 ainda está em PRs abertos). Cada PR desta fatia empilha no anterior.

## Review Focus

1. **ffprobe não instalado** (ou fora do PATH): a leitura deve falhar com uma mensagem única dizendo para instalar o ffmpeg, e não marcar todos os clipes como "corrompidos". Teste na Task 2.
2. **Caminho colado com aspas** (o "Copiar como caminho" do Windows gera `"D:\Videos\treino"`): deve funcionar igual ao caminho sem aspas. Teste na Task 4.
3. **Projeto salvo pela fatia 1** (JSON sem `clipScan`): deve abrir normalmente, sem mapeamento. Teste na Task 5.
4. **Pasta de sincronização cheia de outros arquivos** (originais `A001_...mov`, `._take1.mov` do macOS, `desktop.ini`, subpastas): só os arquivos `take*` são lidos com o ffprobe; subpastas não aparecem. Testes nas Tasks 1 e 3.
5. **Take cujos clipes são todos ilegíveis**: precisa de um aviso no take (na prática ele não tem clipe usável), além do aviso em cada clipe. Teste na Task 4.

## Estrutura de arquivos

```
apps/api/src/
  types/clip.ts                         # tipos da leitura e do mapeamento (Task 1)
  services/clip-names.ts                # interpreta o nome do arquivo (Task 1)
  clients/video-prober.ts               # interface VideoProber + VideoProbeError (Task 2)
  clients/ffprobe-video-prober.ts       # implementação com ffprobe (Task 2)
  repositories/clip-folder.repository.ts# lista arquivos da pasta (Task 3)
  services/clip-rules.ts                # caminho da pasta + mapeamento e avisos (Task 4)
  services/project.service.ts           # + scanClips, clipMapping no view (Task 5)
  types/project.ts                      # + clipScan / clipMapping (Task 5)
  repositories/project.repository.ts    # + compatibilidade com JSON antigo (Task 5)
  schemas/project.schemas.ts            # + scanClipsBodySchema (Task 6)
  controllers/project.controller.ts     # + scanClips (Task 6)
  routes/project.routes.ts              # + PUT /:id/clips-folder (Task 6)
  config.ts, server.ts                  # + FFPROBE_PATH (Task 6)
apps/web/src/
  api/projects.ts                       # + tipos e scanClips (Task 7)
  hooks/use-project-editor.ts           # + scanClips, status 'scanning' (Task 7)
  lib/clips.ts                          # formatClipDuration, formatResolution (Task 7)
  components/ClipsFolderForm.tsx        # (Task 8)
  components/ClipMappingView.tsx        # (Task 8)
  App.tsx                               # (Task 8)
scripts/make-video-fixtures.sh          # gera as fixtures (Task 2)
fixtures/videos/*.mp4                   # fixtures sintéticas (Task 2)
fixtures/videos/clips-e2e/*             # pasta usada no e2e (Task 9)
e2e/clips.spec.ts                       # (Task 9)
```

## Sugestão de PRs

| PR  | Tasks         | Por quê                                    |
| --- | ------------- | ------------------------------------------ |
| E   | 1, 2, 3, 4, 5 | regra de negócio do backend, com os testes |
| F   | 6             | camada HTTP                                |
| G   | 7, 8          | frontend                                   |
| H   | 9             | e2e e docs                                 |

---

### Task 1: Tipos e nomes dos clipes

**Files:**

- Create: `apps/api/src/types/clip.ts`
- Create: `apps/api/src/services/clip-names.ts`
- Test: `apps/api/test/services/clip-names.test.ts`

**Interfaces:**

- Produces (`types/clip.ts`, usados por todas as tasks seguintes):

```ts
export interface VideoInfo {
  durationSeconds: number;
  width: number; // já com a rotação aplicada
  height: number; // já com a rotação aplicada
  fps: number;
  lensType: string | null; // com.blackmagic-design.camera.lensType
}

export interface ScannedClip {
  fileName: string;
  takeNumber: number;
  attempt: string | null; // letra minúscula: 'a', 'b'...; null em "take3.mov"
  video: VideoInfo | null; // null quando o arquivo não pôde ser lido
  readError: string | null; // mensagem do VideoProbeError quando video é null
}

export interface IgnoredFile {
  fileName: string;
  reason: string;
}

export interface ClipScan {
  folder: string;
  scannedAt: string; // ISO 8601
  clips: ScannedClip[];
  ignoredFiles: IgnoredFile[];
}

export type ClipWarningCode = 'unreadable' | 'too-short' | 'lens-mismatch';
export type TakeClipsWarningCode = 'missing' | 'no-readable-clip' | 'attempt-gap' | 'duplicate';

export interface ClipWarning {
  code: ClipWarningCode;
  message: string;
}
export interface TakeClipsWarning {
  code: TakeClipsWarningCode;
  message: string;
}

export interface MappedClip extends ScannedClip {
  warnings: ClipWarning[];
}

export interface TakeClips {
  takeNumber: number;
  clips: MappedClip[];
  warnings: TakeClipsWarning[];
}

export interface ClipMapping {
  folder: string;
  scannedAt: string;
  takes: TakeClips[]; // um por take do roteiro, na ordem do roteiro
  orphanClips: MappedClip[]; // clipes cujo número não existe no roteiro
  ignoredFiles: IgnoredFile[];
  notices: string[]; // avisos gerais (resolução baixa, pasta sem clipes)
}
```

- Produces (`services/clip-names.ts`):

```ts
export type ClipNameResult =
  { ok: true; takeNumber: number; attempt: string | null } | { ok: false; reason: string };
export function parseClipFileName(fileName: string): ClipNameResult;
export function clipLabel(takeNumber: number, attempt: string | null): string; // (3, 'a') -> "take3a"
export const UNSUPPORTED_EXTENSION_REASON = 'Extensão não suportada (use .mov ou .mp4).';
export const NAME_PATTERN_REASON = 'Nome fora do padrão (ex.: take1.mov, take3a.mp4).';
export const TAKE_ZERO_REASON = 'Os takes começam em 1 (take0 não existe).';
```

Regra: extensão `.mov`/`.mp4` (qualquer caixa), senão `UNSUPPORTED_EXTENSION_REASON`. Nome sem extensão casa com `/^take(\d{1,3})([a-z])?$/i`, senão `NAME_PATTERN_REASON`. Número com zeros à esquerda é aceito (`take01` → 1). Número 0 → `TAKE_ZERO_REASON`. A letra volta minúscula.

- [ ] **Step 1: Write the failing tests** (`it.each` com a tabela abaixo; entrada → resultado)

| entrada                  | resultado                                    |
| ------------------------ | -------------------------------------------- |
| `take1.mov`              | `{ ok: true, takeNumber: 1, attempt: null }` |
| `TAKE3B.MP4`             | `{ ok: true, takeNumber: 3, attempt: 'b' }`  |
| `Take12a.Mov`            | `{ ok: true, takeNumber: 12, attempt: 'a' }` |
| `take01.mp4`             | `{ ok: true, takeNumber: 1, attempt: null }` |
| `take0.mov`              | `{ ok: false, reason: TAKE_ZERO_REASON }`    |
| `take-1.mov`             | `NAME_PATTERN_REASON`                        |
| `take3ab.mov`            | `NAME_PATTERN_REASON`                        |
| `take1000.mov`           | `NAME_PATTERN_REASON`                        |
| `take 1.mov`             | `NAME_PATTERN_REASON`                        |
| `take1 (1).mov`          | `NAME_PATTERN_REASON`                        |
| `._take1.mov`            | `NAME_PATTERN_REASON`                        |
| `A001_11051828_C019.mov` | `NAME_PATTERN_REASON`                        |
| `take1.mkv`              | `UNSUPPORTED_EXTENSION_REASON`               |
| `take1.mov.part`         | `UNSUPPORTED_EXTENSION_REASON`               |
| `take1`                  | `UNSUPPORTED_EXTENSION_REASON`               |
| `desktop.ini`            | `UNSUPPORTED_EXTENSION_REASON`               |

Mais: `clipLabel(3, 'a')` → `'take3a'`; `clipLabel(3, null)` → `'take3'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/services/clip-names.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implement `types/clip.ts` e `services/clip-names.ts`** como nas Interfaces.

- [ ] **Step 4: Run tests to verify they pass** (mesmo comando, PASS)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/types/clip.ts apps/api/src/services/clip-names.ts apps/api/test/services/clip-names.test.ts
git commit -m "feat(api): regras dos nomes dos clipes"
```

---

### Task 2: Leitura do vídeo com ffprobe + fixtures

**Files:**

- Create: `scripts/make-video-fixtures.sh`
- Create: `fixtures/videos/vertical-rotated-52mm.mp4`, `vertical-plain.mp4`, `audio-only.mp4`, `truncated.mp4`, `not-a-video.mp4` (gerados pelo script)
- Create: `apps/api/src/clients/video-prober.ts`
- Create: `apps/api/src/clients/ffprobe-video-prober.ts`
- Test: `apps/api/test/clients/ffprobe-video-prober.test.ts`

**Interfaces:**

- Consumes: `VideoInfo` (Task 1).
- Produces:

```ts
// video-prober.ts
export class VideoProbeError extends Error {} // arquivo não é vídeo, está corrompido ou demorou demais
export interface VideoProber {
  probe(filePath: string): Promise<VideoInfo>;
}

// ffprobe-video-prober.ts
export const FFPROBE_NOT_FOUND_MESSAGE =
  'ffprobe não encontrado. Instale o ffmpeg e deixe o ffprobe no PATH (ou defina FFPROBE_PATH).';
export const UNREADABLE_VIDEO_MESSAGE =
  'Não foi possível ler o arquivo: não é vídeo ou está corrompido.';
export const NO_VIDEO_STREAM_MESSAGE = 'O arquivo não tem imagem de vídeo.';
export const PROBE_TIMEOUT_MESSAGE = 'A leitura do vídeo demorou demais.';
export function createFfprobeVideoProber(options: {
  ffprobePath: string;
  timeoutMs?: number;
}): VideoProber;
```

**Fixtures.** O script roda com bash (Git Bash no Windows) a partir da raiz e grava em `fixtures/videos/`. Comandos já testados com ffmpeg 9:

```bash
# vertical-rotated-52mm.mp4: 320x180 com rotação -90 (lido como 180x320), 1,5s, 60fps, H.265, lente 52mm
ffmpeg -v error -y -f lavfi -i testsrc2=size=320x180:rate=60 -t 1.5 -an \
  -c:v libx265 -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  -map_metadata -1 -metadata "com.blackmagic-design.camera.lensType=iPhone 14 Pro Max 52mm" \
  -movflags use_metadata_tags "$TMP/raw.mp4"
ffmpeg -v error -y -display_rotation:v:0 -90 -i "$TMP/raw.mp4" -c copy -map_metadata 0 \
  -movflags use_metadata_tags -fflags +bitexact fixtures/videos/vertical-rotated-52mm.mp4
```

- `vertical-plain.mp4`: `testsrc2=size=180x320:rate=60`, 2s, H.265, `-map_metadata -1`, sem tag de lente, sem rotação.
- `audio-only.mp4`: `-f lavfi -i sine=duration=1`, AAC, sem vídeo.
- `truncated.mp4`: os primeiros 2000 bytes de `vertical-plain.mp4` (`head -c 2000`).
- `not-a-video.mp4`: o texto `isto não é um vídeo`.

O `ffprobe` deve ser chamado com `execFile` (sem shell), `-v error -print_format json -show_entries format=duration:format_tags:stream=codec_type,width,height,r_frame_rate:stream_side_data=rotation`. Rotação ±90/±270 troca largura e altura. `fps` vem de `r_frame_rate` (`"60/1"` → 60). Duração ausente, `N/A` ou ≤ 0 → `VideoProbeError(UNREADABLE_VIDEO_MESSAGE)`. Binário não encontrado (`code === 'ENOENT'` no erro do `execFile`) → `AppError(500, FFPROBE_NOT_FOUND_MESSAGE)`. Processo morto pelo timeout (padrão 15000 ms) → `VideoProbeError(PROBE_TIMEOUT_MESSAGE)`. Qualquer outra saída com erro → `VideoProbeError(UNREADABLE_VIDEO_MESSAGE)`.

- [ ] **Step 1: Gerar as fixtures e conferir a privacidade**

Run: `bash scripts/make-video-fixtures.sh && ffprobe -v error -show_entries format_tags -of json fixtures/videos/vertical-rotated-52mm.mp4`
Expected: tags só com `major_brand`, `minor_version`, `compatible_brands` e a lente. Nenhum `location`, `creation_time`, `make`, `model` ou `encoder` com dados do aparelho. Cada arquivo com menos de 100 KB. `git status` mostra os `.mp4` novos e **não** mostra `A001_11051828_C019.mov`.

- [ ] **Step 2: Write the failing tests** (prober real com `ffprobePath: 'ffprobe'`)

```ts
it('lê o clipe vertical com rotação e a lente', async () => {
  const info = await prober.probe(fixture('vertical-rotated-52mm.mp4'));
  expect(info).toEqual({
    durationSeconds: 1.5,
    width: 180,
    height: 320,
    fps: 60,
    lensType: 'iPhone 14 Pro Max 52mm',
  });
});
it('lê clipe sem rotação e sem lente', async () => {
  const info = await prober.probe(fixture('vertical-plain.mp4'));
  expect(info).toMatchObject({ width: 180, height: 320, lensType: null });
  expect(info.durationSeconds).toBeCloseTo(2, 1);
});
it.each([
  ['not-a-video.mp4', UNREADABLE_VIDEO_MESSAGE],
  ['truncated.mp4', UNREADABLE_VIDEO_MESSAGE],
  ['audio-only.mp4', NO_VIDEO_STREAM_MESSAGE],
  ['nao-existe.mp4', UNREADABLE_VIDEO_MESSAGE],
])('%s vira VideoProbeError', async (name, message) => {
  await expect(prober.probe(fixture(name))).rejects.toEqual(new VideoProbeError(message));
});
it('ffprobe ausente vira AppError 500 com a mensagem de instalação', async () => {
  const missing = createFfprobeVideoProber({ ffprobePath: 'ffprobe-que-nao-existe' });
  await expect(missing.probe(fixture('vertical-plain.mp4'))).rejects.toEqual(
    new AppError(500, FFPROBE_NOT_FOUND_MESSAGE),
  );
});
it('timeout vira VideoProbeError', async () => {
  const slow = createFfprobeVideoProber({ ffprobePath: 'ffprobe', timeoutMs: 1 });
  await expect(slow.probe(fixture('vertical-plain.mp4'))).rejects.toEqual(
    new VideoProbeError(PROBE_TIMEOUT_MESSAGE),
  );
});
```

`fixture(name)` = `path.resolve(import.meta.dirname, '../../../../fixtures/videos', name)`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/clients/ffprobe-video-prober.test.ts`
Expected: FAIL (módulo não existe)

- [ ] **Step 4: Implement** `video-prober.ts` e `ffprobe-video-prober.ts` como acima.

- [ ] **Step 5: Run tests to verify they pass** (mesmo comando, PASS)

- [ ] **Step 6: Commit**

```bash
git add scripts/make-video-fixtures.sh fixtures/videos/*.mp4 apps/api/src/clients/video-prober.ts apps/api/src/clients/ffprobe-video-prober.ts apps/api/test/clients/ffprobe-video-prober.test.ts
git commit -m "feat(api): leitura de duração, resolução, rotação e lente com ffprobe"
```

---

### Task 3: Repository da pasta de clipes

**Files:**

- Create: `apps/api/src/repositories/clip-folder.repository.ts`
- Test: `apps/api/test/repositories/clip-folder.repository.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ClipFolderRepository {
  listFileNames(folder: string): Promise<string[]>; // só arquivos (sem subpastas), em ordem alfabética
}
export function createClipFolderRepository(): ClipFolderRepository;
export const FOLDER_NOT_FOUND_MESSAGE = 'A pasta não existe.';
export const NOT_A_FOLDER_MESSAGE = 'O caminho informado não é uma pasta.';
export const FOLDER_PERMISSION_MESSAGE = 'Sem permissão para ler a pasta.';
```

Usa `fs.readdir(folder, { withFileTypes: true })` e filtra `isFile()`. `ENOENT` → `AppError(400, FOLDER_NOT_FOUND_MESSAGE)`; `ENOTDIR` → `AppError(400, NOT_A_FOLDER_MESSAGE)`; `EACCES`/`EPERM` → `AppError(400, FOLDER_PERMISSION_MESSAGE)`; outros erros sobem.

- [ ] **Step 1: Write the failing tests** (pasta temporária em `os.tmpdir()`, apagada no `afterEach`)

- `lista só arquivos, ignorando subpastas`: pasta com `take2.mov`, `take1.mov`, `desktop.ini` e a subpasta `take3.mov/` → `['desktop.ini', 'take1.mov', 'take2.mov']`.
- `pasta vazia devolve lista vazia` → `[]`.
- `pasta que não existe` → rejeita com `new AppError(400, FOLDER_NOT_FOUND_MESSAGE)`.
- `caminho que é arquivo` (aponta para `take1.mov`) → `new AppError(400, NOT_A_FOLDER_MESSAGE)`.
- `it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('pasta sem permissão')`: `fs.chmod(dir, 0o000)` → `new AppError(400, FOLDER_PERMISSION_MESSAGE)`; restaurar `0o700` no fim.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/repositories/clip-folder.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `createClipFolderRepository`**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories/clip-folder.repository.ts apps/api/test/repositories/clip-folder.repository.test.ts
git commit -m "feat(api): repository que lista os arquivos da pasta de clipes"
```

---

### Task 4: Regras do mapeamento e avisos

**Files:**

- Create: `apps/api/src/services/clip-rules.ts`
- Test: `apps/api/test/services/clip-rules.test.ts`

**Interfaces:**

- Consumes: tipos da Task 1, `clipLabel` (Task 1), `ScriptTake` (`types/project.ts`).
- Produces:

```ts
export function normalizeFolderInput(text: string): string;
export function buildClipMapping(takes: ScriptTake[], scan: ClipScan): ClipMapping;
export function formatSecondsShort(seconds: number): string; // arredonda PARA BAIXO em 1 casa: 3.96 -> "3,9s"; 4 -> "4s"
export function lensMillimeters(text: string | null): number | null; // "iPhone 14 Pro Max 24mm" -> 24; "0.5x" -> null
export const MIN_EXPORT_SHORT_SIDE = 1080;
```

**`normalizeFolderInput`:** tira espaços e um par de aspas duplas em volta. Vazio → `AppError(400, 'Informe a pasta dos clipes.')`. Não absoluto (`path.isAbsolute`) → `AppError(400, 'Use o caminho completo da pasta (ex.: D:\\Videos\\treino).')`.

**`buildClipMapping`** (mensagens exatas, `fmt` = `formatSecondsShort`):

| Aviso                   | Quando                                                                                  | Mensagem                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| clipe `unreadable`      | `video === null`                                                                        | o `readError` do clipe                                                                            |
| clipe `too-short`       | `durationSeconds < take.minSeconds`                                                     | `` `O clipe tem ${fmt(d)}, menos que o mínimo do take (${fmt(min)}).` ``                          |
| clipe `lens-mismatch`   | `lensMillimeters(take.lens)` e `lensMillimeters(video.lensType)` não nulos e diferentes | `` `Lente do clipe (${clipMm}mm) diferente da do roteiro (${takeMm}mm).` ``                       |
| take `missing`          | take sem nenhum clipe                                                                   | `'Nenhum clipe para este take.'`                                                                  |
| take `no-readable-clip` | tem clipes, mas todos `video === null`                                                  | `'Nenhum clipe legível para este take.'`                                                          |
| take `attempt-gap`      | letras presentes não cobrem de `a` até a maior                                          | `` `Tentativa faltando: ${labels.join(', ')}.` `` (ex.: `take3a, take3b`)                         |
| take `duplicate`        | mais de um arquivo com o mesmo `clipLabel`                                              | `` `Mais de um arquivo para ${label}: ${fileNames.join(', ')}.` `` (um aviso por rótulo repetido) |
| notice                  | algum clipe legível com `min(width, height) < 1080`                                     | `` `${n} clipe(s) com menos de 1080 pixels no lado menor: a exportação vai sair ampliada.` ``     |
| notice                  | `scan.clips.length === 0`                                                               | `'A pasta não tem nenhum clipe com nome take<N> (ex.: take1.mov).'`                               |

Clipe cujo `takeNumber` não existe nos takes vai para `orphanClips` (só com o aviso `unreadable`, se for o caso). Clipes de cada take e os órfãos ficam ordenados por `takeNumber`, depois `attempt` (`null` antes de `'a'`), depois `fileName` (comparação simples `<` de string, sem `localeCompare`: maiúsculas vêm antes). `ignoredFiles` passa igual.

- [ ] **Step 1: Write the failing tests** (helpers `take(n, overrides)` e `clip(fileName, overrides)` no arquivo de teste)

- `normalizeFolderInput` (o CI é Linux, então use `abs = path.resolve('videos')` como caminho absoluto portátil): `` `  ${abs}  ` `` → `abs`; `'"' + abs + '"'` → `abs`; `''`, `'   '`, `'""'` → AppError 400 "Informe a pasta dos clipes."; `'videos/treino'` → AppError 400 do caminho completo.
- `formatSecondsShort`: `3.96 → '3,9s'`, `4 → '4s'`, `1.5 → '1,5s'`, `0.04 → '0s'`.
- `lensMillimeters`: `'52mm' → 52`, `'iPhone 14 Pro Max 24mm' → 24`, `'52 mm' → 52`, `'13,5mm' → 13.5`, `'0.5x' → null`, `null → null`.
- `take sem clipe fica faltando`: 2 takes, clipes só do take 1 → take 2 com `[{ code: 'missing', ... }]` e `clips: []`.
- `clipe de take inexistente vai para orphanClips`: `take9.mov` com 2 takes.
- `clipe curto avisa com a duração arredondada para baixo`: duração 3.96, mínimo 4 → mensagem `'O clipe tem 3,9s, menos que o mínimo do take (4s).'`; duração igual ao mínimo não avisa.
- `lente diferente avisa; lente ausente em um dos lados não avisa`: take `'52mm'` + clipe `'iPhone 14 Pro Max 24mm'` → aviso; take `null` ou clipe `lensType: null` → sem aviso; `'24mm'` x `'iPhone 14 Pro Max 24mm'` → sem aviso.
- `take3c sem take3a e take3b avisa as duas`: → `'Tentativa faltando: take3a, take3b.'`; `take3` + `take3a` → sem aviso.
- `arquivos repetidos avisam`: `take3a.mov` + `TAKE3A.mp4` → `'Mais de um arquivo para take3a: TAKE3A.mp4, take3a.mov.'` (na ordem dos clipes ordenados); `take01.mp4` + `take1.mov` → aviso para `take1`.
- `todos os clipes ilegíveis`: dois clipes com `video: null` → aviso `no-readable-clip` no take e `unreadable` em cada clipe; não aparece `missing`.
- `clipe ilegível não recebe too-short nem lens-mismatch`.
- `resolução baixa vira um aviso geral`: 2 clipes 720×1280 e 1 clipe 1080×1920 → `notices` contém `'2 clipe(s) com menos de 1080 pixels no lado menor: a exportação vai sair ampliada.'`; clipe ilegível não conta.
- `pasta sem clipes`: `scan.clips = []` → notice da pasta sem clipes e todos os takes `missing`.
- `ordena clipes`: entrada `take1b`, `take1`, `take1a` → saída `take1`, `take1a`, `take1b`.
- `sem takes no roteiro`: `takes = []` → todos os clipes em `orphanClips`, `takes: []`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/services/clip-rules.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `clip-rules.ts`**, uma função pequena por aviso (`findClipWarnings`, `findAttemptGap`, `findDuplicates`, `buildNotices`).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/clip-rules.ts apps/api/test/services/clip-rules.test.ts
git commit -m "feat(api): mapeamento take ↔ clipes com avisos"
```

---

### Task 5: Service — ler a pasta e devolver o mapeamento

**Files:**

- Modify: `apps/api/src/types/project.ts` (`Project.clipScan: ClipScan | null`; `ProjectView.clipMapping: ClipMapping | null`)
- Modify: `apps/api/src/repositories/project.repository.ts` (`findById` devolve `clipScan: null` quando o JSON não tem o campo)
- Modify: `apps/api/src/services/project.service.ts`
- Test: `apps/api/test/services/project.service.test.ts`, `apps/api/test/repositories/project.repository.test.ts`

**Interfaces:**

- Consumes: `ClipFolderRepository` (Task 3), `VideoProber` + `VideoProbeError` (Task 2), `parseClipFileName` (Task 1), `normalizeFolderInput` + `buildClipMapping` (Task 4).
- Produces:

```ts
export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
  scriptInterpreter: ScriptInterpreter;
  clipFolderRepository: ClipFolderRepository; // novo
  videoProber: VideoProber; // novo
  now: () => Date;
  createId: () => string;
}
export interface ProjectService {
  // ...os três de antes, e:
  scanClips(id: string, folderInput: string): Promise<ProjectView>;
}
```

`createFromScript` cria com `clipScan: null`. `toView` passa a incluir `clipMapping: project.clipScan ? buildClipMapping(project.takes, project.clipScan) : null`.

`scanClips`: acha o projeto (404 como hoje) → `normalizeFolderInput` → `listFileNames` → para cada nome, `parseClipFileName`; inválido vai para `ignoredFiles`; válido é lido com `videoProber.probe(path.join(folder, fileName))` **um por vez**. `VideoProbeError` vira `video: null, readError: error.message`; qualquer outro erro sobe (é o caso do ffprobe ausente). Salva `clipScan = { folder, scannedAt: now().toISOString(), clips, ignoredFiles }`, substituindo a leitura anterior.

- [ ] **Step 1: Write the failing tests** (pasta temporária real com arquivos vazios + `VideoProber` falso `{ probe: vi.fn(...) }` que devolve um `VideoInfo` por nome ou lança `VideoProbeError` para `quebrado`)

- `scanClips mapeia os clipes aos takes`: pasta com `take1.mov`, `take2a.mp4`, `notas.txt` → `clipMapping.takes[0].clips[0].fileName === 'take1.mov'`, `ignoredFiles` = `[{ fileName: 'notas.txt', reason: UNSUPPORTED_EXTENSION_REASON }]`, `scannedAt` = data do `now`.
- `só lê com o ffprobe os arquivos take`: pasta com `take1.mov`, `A001_11051828_C019.mov`, `._take1.mov` → `probe` chamado uma vez, com `path.join(folder, 'take1.mov')`.
- `arquivo ilegível não interrompe a leitura`: `take1.mov` lança `VideoProbeError('x')` → clipe com `video: null, readError: 'x'`; `take2.mov` lido normalmente.
- `erro que não é VideoProbeError sobe`: `probe` lança `new AppError(500, FFPROBE_NOT_FOUND_MESSAGE)` → `scanClips` rejeita com esse erro e o projeto salvo continua com `clipScan: null`.
- `aceita caminho com aspas`: `'"' + folder + '"'` → `clipMapping.folder === folder`.
- `projeto inexistente` → AppError 404; `pasta inexistente` → AppError 400 `FOLDER_NOT_FOUND_MESSAGE`.
- `ler de novo substitui a leitura anterior`: lê, apaga `take2a.mp4`, lê de novo → `take2a.mp4` some do mapeamento.
- `editar os takes recalcula o mapeamento sem ler de novo`: lê com 2 takes; `updateTakes` com 1 take → `take2a.mp4` passa para `orphanClips` e `probe` não é chamado de novo.
- `projeto novo vem com clipMapping null`.
- (repository) `projeto salvo sem clipScan abre com clipScan null`: grava à mão um `project.json` no formato da fatia 1 → `findById` devolve `clipScan: null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/services/project.service.test.ts apps/api/test/repositories/project.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** as mudanças em `types/project.ts`, `project.repository.ts` e `project.service.ts`. Ajuste o `buildService` dos testes existentes para passar as deps novas.

- [ ] **Step 4: Run all api tests** — `pnpm vitest run --project api` → PASS. `pnpm typecheck` vai falhar em `server.ts` até a Task 6; se for abrir o PR E sozinho, passe as deps novas no `server.ts` já aqui (com `createFfprobeVideoProber({ ffprobePath: 'ffprobe' })`).

- [ ] **Step 5: Commit e PR E**

```bash
git add apps/api
git commit -m "feat(api): service lê a pasta de clipes e devolve o mapeamento"
```

---

### Task 6: Camada HTTP e configuração

**Files:**

- Modify: `apps/api/src/schemas/project.schemas.ts` (+ `scanClipsBodySchema = z.object({ folder: z.string().max(1000) })`)
- Modify: `apps/api/src/controllers/project.controller.ts` (+ `scanClips`)
- Modify: `apps/api/src/routes/project.routes.ts` (+ `router.put('/:id/clips-folder', validateBody(scanClipsBodySchema), controller.scanClips)`)
- Modify: `apps/api/src/config.ts` (+ `ffprobePath: string`, de `FFPROBE_PATH`, padrão `'ffprobe'`)
- Modify: `apps/api/src/server.ts` (injeta `createClipFolderRepository()` e `createFfprobeVideoProber({ ffprobePath: config.ffprobePath })`)
- Modify: `.env.example` (+ `FFPROBE_PATH=` comentado)
- Test: `apps/api/test/routes/project.routes.test.ts`, `apps/api/test/config.test.ts`

**Interfaces:**

- Consumes: `ProjectService.scanClips` (Task 5).
- Produces: `PUT /api/projects/:id/clips-folder` com corpo `{ folder: string }` → 200 `ProjectView` (com `clipMapping`).

- [ ] **Step 1: Write the failing tests**

- rota: `PUT .../clips-folder` com `{ folder }` chama `scanClips(id, folder)` e responde 200 com o view; `{}` → 400 `'Dados inválidos.'` com `details[0].path === 'folder'`; `{ folder: 'x'.repeat(1001) }` → 400; service lança `AppError(400, FOLDER_NOT_FOUND_MESSAGE)` → 400 `{ error: FOLDER_NOT_FOUND_MESSAGE }`; service lança `AppError(500, FFPROBE_NOT_FOUND_MESSAGE)` → 500 com essa mensagem.
- config: sem `FFPROBE_PATH` → `'ffprobe'`; `FFPROBE_PATH=C:\\ffmpeg\\bin\\ffprobe.exe` → esse valor; `FFPROBE_PATH='  '` → `'ffprobe'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/api/test/routes apps/api/test/config.test.ts`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run** `pnpm vitest run --project api && pnpm typecheck && pnpm lint` → tudo verde.

- [ ] **Step 5: Teste manual (opcional):** `SCRIPT_INTERPRETER=fake pnpm --filter api dev`, criar projeto e `PUT` com a pasta `fixtures/videos` (absoluta): os `.mp4` sintéticos aparecem como ignorados e o `A001_...mov` também.

- [ ] **Step 6: Commit e PR F**

```bash
git add apps/api .env.example
git commit -m "feat(api): rota para ler a pasta de clipes e FFPROBE_PATH"
```

---

### Task 7: Frontend — cliente da API, hook e formatação

**Files:**

- Modify: `apps/web/src/api/projects.ts` (+ tipos `VideoInfo`, `MappedClip`, `ClipWarning`, `TakeClips`, `TakeClipsWarning`, `IgnoredFile`, `ClipMapping` iguais aos da Task 1; `ProjectView.clipMapping: ClipMapping | null`; `scanClips`)
- Modify: `apps/web/src/hooks/use-project-editor.ts`
- Create: `apps/web/src/lib/clips.ts`
- Test: `apps/web/src/api/projects.test.ts`, `apps/web/src/hooks/use-project-editor.test.ts`, `apps/web/src/lib/clips.test.ts`

**Interfaces:**

- Produces:

```ts
// api/projects.ts
export function scanClips(id: string, folder: string): Promise<ProjectView>; // PUT /api/projects/:id/clips-folder

// hooks/use-project-editor.ts
export type EditorStatus = 'idle' | 'loading' | 'saving' | 'scanning';
// ProjectEditor ganha:
scanClips(folder: string): Promise<void>;

// lib/clips.ts
export function formatClipDuration(seconds: number): string; // igual ao formatSecondsShort da API: 3.96 -> "3,9s"
export function formatResolution(video: VideoInfo): string; // "720×1280"
```

`scanClips` no hook usa o mesmo `runRequest('scanning', ...)` dos outros; com `project === null` não faz nada; em sucesso troca `project` **sem mexer nos `takes` locais** (a leitura não muda takes).

- [ ] **Step 1: Write the failing tests**

- api: `scanClips('abc', 'D:\\v')` faz `PUT /api/projects/abc/clips-folder` com corpo `{"folder":"D:\\v"}`; erro 400 vira `ApiError(400, mensagem do corpo)`.
- hook: `scanClips` atualiza `project.clipMapping` e mantém os takes editados localmente (`isDirty` continua `true`); falha mostra `error`; segunda chamada durante a primeira é ignorada; sem projeto não chama a API; `status` é `'scanning'` durante a chamada.
- lib: `formatClipDuration(3.96) === '3,9s'`, `(4) === '4s'`, `(0.04) === '0s'`; `formatResolution({ width: 720, height: 1280, ... }) === '720×1280'`.

- [ ] **Step 2: Run tests to verify they fail** — `pnpm vitest run --project web` → FAIL nos novos.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api apps/web/src/hooks apps/web/src/lib
git commit -m "feat(web): cliente e hook para ler a pasta de clipes"
```

---

### Task 8: Frontend — telas da pasta e do mapeamento

**Files:**

- Create: `apps/web/src/components/ClipsFolderForm.tsx` + `.test.tsx`
- Create: `apps/web/src/components/ClipMappingView.tsx` + `.test.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`, `apps/web/src/App.css` (se precisar)

**Interfaces:**

```ts
interface ClipsFolderFormProps {
  initialFolder: string; // project.clipMapping?.folder ?? ''
  isScanning: boolean;
  onSubmit(folder: string): void;
}
interface ClipMappingViewProps {
  mapping: ClipMapping;
  takes: ScriptTake[]; // para mostrar o nome de cada take
}
```

Textos fixos (os testes usam):

- Form: campo com label `Pasta dos clipes`, botão `Ler clipes` (desabilitado com o campo vazio ou `isScanning`; texto `Lendo clipes…` enquanto lê).
- Mapping: seção com título `Clipes`; cada take num `role="group"` com `aria-label` `` `Clipes do take ${n}` `` e título `` `Take ${n}: ${name}` ``; cada clipe mostra `` `${fileName} · ${formatClipDuration} · ${formatResolution}` `` (clipe ilegível mostra só o `fileName`); avisos de clipe e de take em `<li>` com a `message` da API; `notices` em `<p role="note">`; órfãos sob o título `Clipes sem take no roteiro` (só aparece se houver); ignorados em `<details>` com `<summary>` `` `${n} arquivo(s) ignorado(s)` `` listando `` `${fileName}: ${reason}` `` (só aparece se houver).
- App: o form e o mapeamento aparecem depois que existe projeto, abaixo da tabela de takes. Com `editor.isDirty` e mapeamento presente, mostrar `<p role="note">Salve os takes para atualizar os avisos dos clipes.</p>`.

- [ ] **Step 1: Write the failing tests** (Testing Library, no estilo dos testes de componentes existentes)

- form: digitar e clicar chama `onSubmit` com o texto; botão desabilitado com campo vazio e com `isScanning` (mostra `Lendo clipes…`); começa com `initialFolder`.
- mapping: take faltando mostra `Nenhum clipe para este take.` dentro do grupo `Clipes do take 2`; clipe com aviso de lente mostra a mensagem no grupo certo; clipe ilegível não quebra a tela (sem duração); seção de órfãos só aparece com órfãos; `<summary>` mostra `3 arquivo(s) ignorado(s)`; notice aparece com `role="note"`.
- App: depois de interpretar o roteiro aparece `Pasta dos clipes`; ler clipes mostra o grupo `Clipes do take 1`; com edição local pendente aparece a nota de salvar.

- [ ] **Step 2: Run tests to verify they fail** — `pnpm vitest run --project web`

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run** `pnpm vitest run --project web && pnpm typecheck && pnpm lint` → verde.

- [ ] **Step 5: Commit e PR G**

```bash
git add apps/web/src
git commit -m "feat(web): telas da pasta de clipes e do mapeamento"
```

---

### Task 9: End-to-end e documentação

**Files:**

- Create: `fixtures/videos/clips-e2e/take1.mp4` (cópia de `vertical-rotated-52mm.mp4`), `take2a.mp4` e `take2c.mp4` (cópias de `vertical-plain.mp4`), `take9.mp4` (cópia de `vertical-plain.mp4`), `leiame.txt` — gerados por `scripts/make-video-fixtures.sh`
- Modify: `.gitignore` (+ `!fixtures/videos/clips-e2e/*.mp4`)
- Create: `e2e/clips.spec.ts`
- Modify: `docs/api.md` (rota nova, `clipMapping`, erros novos), `README.md` (ffprobe/`FFPROBE_PATH`)

Com o roteiro falso (`FAKE_TAKES`: take 1 com lente `24mm` e mínimo 2s; take 2 com `52mm` e mínimo 4s), a pasta `clips-e2e` dá: take 1 com aviso de lente (52 x 24) e de clipe curto (1,5s < 2s); take 2 com `Tentativa faltando: take2b.`; `take9.mp4` em órfãos; `leiame.txt` ignorado; notice de resolução baixa.

- [ ] **Step 1: Write the failing test** (`e2e/clips.spec.ts`, usando `path.resolve('fixtures/videos/clips-e2e')`)

```ts
test('lê a pasta e mostra os avisos por take', async ({ page }) => {
  await interpretScript(page, SCRIPT); // mesmo helper de e2e/script.spec.ts
  await page.getByLabel('Pasta dos clipes').fill(CLIPS_FOLDER);
  await page.getByRole('button', { name: 'Ler clipes' }).click();

  const take1 = page.getByRole('group', { name: 'Clipes do take 1' });
  await expect(
    take1.getByText('Lente do clipe (52mm) diferente da do roteiro (24mm).'),
  ).toBeVisible();
  await expect(take1.getByText('O clipe tem 1,5s, menos que o mínimo do take (2s).')).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Clipes do take 2' }).getByText('Tentativa faltando: take2b.'),
  ).toBeVisible();
  await expect(page.getByText('take9.mp4')).toBeVisible();
  await expect(page.getByText('1 arquivo(s) ignorado(s)')).toBeVisible();
});

test('pasta que não existe mostra o erro', async ({ page }) => {
  await interpretScript(page, SCRIPT);
  await page.getByLabel('Pasta dos clipes').fill(path.resolve('fixtures/nao-existe'));
  await page.getByRole('button', { name: 'Ler clipes' }).click();
  await expect(page.getByRole('alert')).toHaveText('A pasta não existe.');
});
```

- [ ] **Step 2: Gerar a pasta e rodar** — `bash scripts/make-video-fixtures.sh && pnpm test:e2e` → os 5 testes antigos e os 2 novos passam.

- [ ] **Step 3: Atualizar `docs/api.md` e `README.md`**

- [ ] **Step 4: Verificação completa** — `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` → tudo verde.

- [ ] **Step 5: Commit e PR H**

```bash
git add .gitignore fixtures/videos/clips-e2e scripts e2e docs README.md
git commit -m "test(e2e): fluxo da pasta de clipes e docs da fatia 2"
```
