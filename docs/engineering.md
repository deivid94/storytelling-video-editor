# Premissas de engenharia

Regras que todo código deste projeto segue. Valem para pessoas e para o Claude.

## Base: Google Engineering Practices

Referência: <https://google.github.io/eng-practices/>

- **Código simples e legível.** Um dev júnior tem que entender o que cada função faz só de ler. Sem truques, sem abstrações "espertas".
- **Funções pequenas**, com nomes que dizem o que fazem. O ESLint avisa sobre complexidade alta, aninhamento profundo e funções com muitos parâmetros.
- **PRs pequenos** e focados em uma coisa só.

## Pull requests

- **Routes, controllers e middlewares** podem vir em PRs maiores.
- **Regra de negócio (services e repositories) vai sempre junto com os testes, no mesmo PR.**
- Uma branch por feature. Nada vai direto para a `main`.
- O CI (lint, tipos, testes unitários e e2e) precisa passar antes do merge.

## Testes (TDD)

- Seguimos o TDD do superpowers: primeiro o teste que falha, depois o código que faz passar.
- O teste cobre o **comportamento esperado** da feature, não só o caso feliz. Sempre pensar em:
  - entrada vazia, nula ou no formato errado (texto onde se espera número, emoji, etc.)
  - limites (zero, negativo, valor muito grande, duração maior que o clipe)
  - arquivos que não existem ou não são vídeo
  - itens faltando (ex.: `take3b` sem `take3a`)
- **Unitários:** Vitest (`apps/*/test` e `apps/web/src/**/*.test.tsx`).
- **End-to-end:** Playwright (`e2e/`).
- Testes de vídeo usam os arquivos pequenos em `fixtures/videos/`, nunca os clipes reais.

## Arquitetura

### Backend (`apps/api`)

```
routes → controllers → middlewares → services → repositories
```

- **routes:** liga URL e método HTTP ao controller.
- **controllers:** lê a requisição, chama o service, devolve a resposta. Sem regra de negócio.
- **middlewares:** validação de entrada e tratamento de erros.
- **services:** regra de negócio (montar a edição, escolher cortes, etc.).
- **repositories:** guarda e lê dados. Hoje são arquivos JSON no disco; se virar banco, só essa camada muda.

### Frontend (`apps/web`)

- **api/:** funções que chamam o backend.
- **hooks/:** estado e lógica das telas.
- **lib/:** funções puras (formatar tempo, etc.).
- **components/:** só desenham a tela.

Motivo: os componentes ficam simples, e o que tem lógica (hooks e lib) é testável sem navegador.

## Dependências e configuração

- Gerenciador: **pnpm** (monorepo com workspaces). Não usar npm nem yarn.
- Configs e APIs de bibliotecas sempre conferidas na documentação atual (Context7), nunca de memória.
- TypeScript fixado em 6.0 porque o typescript-eslint ainda não suporta o 7.

## Segredos

- A chave da API do Claude fica no `.env` (veja `.env.example`). O `.env` nunca é commitado.

## Commits

Mensagens curtas com prefixo: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.

O hook de pre-commit roda ESLint e Prettier nos arquivos alterados.

## Documentação

Toda documentação é escrita em Markdown (`.md`) dentro de `docs/`.
