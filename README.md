# Storytelling Video Editor

App pessoal que monta vídeos curtos de treino a partir de um roteiro.

Você entrega o **roteiro** (gerado pelo Claude, com etapas, tempo, ângulo e lente de cada take), os **clipes brutos** (gravados no app Blackmagic Camera e nomeados `take1`, `take2`, `take3a`...) e, opcionalmente, a **música**. O app encontra o melhor trecho de cada clipe, corta na duração certa, alinha os cortes com a batida e exporta o vídeo vertical, sem som, pronto para finalizar no CapCut.

> Status: em planejamento. O spec fica em `docs/superpowers/specs/`.

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
- ffmpeg no PATH

## Como rodar

```bash
pnpm install
cp .env.example .env   # e preencha a ANTHROPIC_API_KEY
pnpm dev               # API em :3333 e web em :5173
```

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
