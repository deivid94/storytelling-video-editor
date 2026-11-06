# Storytelling Video Editor

Leia e siga `docs/engineering.md` antes de qualquer tarefa de código. Resumo:

- pnpm (nunca npm/yarn). Configs e APIs de bibliotecas sempre via Context7.
- TDD do superpowers, com testes de comportamento e casos de borda, não só o caso feliz.
- Código simples, que um júnior entende (Google eng-practices).
- Backend: routes → controllers → middlewares → services → repositories. Frontend: api / hooks / lib / components.
- Regra de negócio sempre no mesmo PR que os seus testes.
- Documentação sempre em `.md`.
- A pasta `src/` na raiz guarda vídeos pessoais do usuário: não mexer, não commitar.
