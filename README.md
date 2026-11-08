# Storytelling Video Editor

App pessoal que monta vídeos curtos de treino a partir de um roteiro.

Você entrega o **roteiro** (gerado pelo Claude, com etapas, tempo, ângulo e lente de cada take), os **clipes brutos** (gravados no app Blackmagic Camera e nomeados `take1`, `take2`, `take3a`...) e, opcionalmente, a **música**. O app encontra o melhor trecho de cada clipe, corta na duração certa, alinha os cortes com a batida e exporta o vídeo vertical, sem som, pronto para finalizar no CapCut.

> Status: fatias 1 (roteiro) e 2 (clipes) prontas: interpretar o roteiro, editar os takes e ler a pasta dos clipes com avisos por take. O spec fica em `docs/superpowers/specs/`.

## Stack

- **Monorepo** com pnpm workspaces
- **API:** Node.js + TypeScript + Express 5
- **Web:** React + TypeScript + Vite
- **Vídeo:** ffmpeg
- **IA:** API do Claude (entender o roteiro e analisar os quadros dos clipes)
- **Testes:** Vitest (unitários) e Playwright (end-to-end)

## Estrutura

```
apps/
  api/   backend (routes, controllers, middlewares, services, repositories)
  web/   frontend (api, hooks, lib, components)
e2e/     testes end-to-end (Playwright)
fixtures/videos/  vídeos pequenos usados nos testes
docs/    documentação, specs e planos
```

## Requisitos

- Node.js 26+
- pnpm 12+
- ffmpeg no PATH (o app usa o `ffprobe` que vem junto; se ele não estiver no PATH, defina `FFPROBE_PATH`)

## Como rodar

```bash
pnpm install
cp .env.example .env   # e preencha a ANTHROPIC_API_KEY
pnpm dev               # API em :3333 e web em :5173
```

## Como usar

Fluxo da fatia 1 (roteiro):

1. Abra http://localhost:5173 e cole o roteiro no campo **Roteiro**.
2. Clique em **Interpretar roteiro**. A IA extrai os takes (nome, duração mínima e máxima).
3. Edite os takes, adicione ou remova o que precisar e clique em **Salvar takes**.
4. Se a IA não achar takes ou falhar, o app avisa e você preenche os takes à mão.

Fluxo da fatia 2 (clipes):

1. Em **Pasta dos clipes**, informe o caminho completo da pasta (ex.: `D:\Videos\treino`) e clique em **Ler clipes**.
2. O app mostra os clipes de cada take (`take1.mov`, `take3a.mp4`...) com avisos de lente diferente, clipe curto, tentativa faltando e arquivos ignorados.

Os projetos ficam salvos em `data/` (ignorada pelo git). A API está documentada em [docs/api.md](docs/api.md).

### Variáveis do `.env`

| Variável              | O que faz                                                                 |
| --------------------- | ------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | chave da API do Claude (obrigatória com `claude`; a API não sobe sem ela) |
| `SCRIPT_INTERPRETER`  | `claude` (real) ou `fake` (sem chamar a API, usado nos testes e2e)        |
| `CLAUDE_SCRIPT_MODEL` | modelo usado para interpretar o roteiro                                   |
| `DATA_DIR`            | pasta dos projetos (vazio = `data/` na raiz); relativa à pasta da API     |
| `FFPROBE_PATH`        | caminho do `ffprobe` (vazio = usa o `ffprobe` do PATH)                    |

A API usa a porta 3333 e escuta só em `127.0.0.1` (outros aparelhos da rede não a alcançam). O proxy do Vite e o Playwright esperam esse endereço e porta.

## Scripts

| Comando          | O que faz                      |
| ---------------- | ------------------------------ |
| `pnpm dev`       | sobe API e web em modo dev     |
| `pnpm test`      | testes unitários (Vitest)      |
| `pnpm test:e2e`  | testes end-to-end (Playwright) |
| `pnpm lint`      | ESLint                         |
| `pnpm typecheck` | checagem de tipos              |
| `pnpm format`    | formata com Prettier           |

## Como contribuir

Leia [docs/engineering.md](docs/engineering.md): TDD, PRs pequenos, regra de negócio sempre com testes, código simples.
