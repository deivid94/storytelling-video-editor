# Storytelling Video Editor: design (MVP)

Data: 2026-11-05 (revisado em 2026-11-06)
Status: rascunho para aprovação

## 1. Intenção

O usuário produz vídeos curtos de treino para o Instagram (Reels). O roteiro já sai pronto com o Claude: uma sequência de takes que conta uma pequena história (ex.: chegar na máquina → série leve → colocar carga → série pesada). A gravação é feita com o app **Blackmagic Camera** no celular, e os clipes sincronizam com o PC pela Blackmagic Cloud.

A parte que ele odeia é a montagem bruta: assistir cada clipe, achar o trecho certo, cortar na duração do roteiro e juntar na ordem. Hoje isso é feito à mão no CapCut.

**O MVP faz esse trabalho pesado.** Ele recebe o roteiro e os clipes, escolhe o melhor trecho de cada take, corta sem interromper nenhuma execução, junta na ordem do roteiro e exporta um vídeo vertical **sem som**. O usuário finaliza no CapCut: música, ritmo, câmera lenta e publicação.

## 2. Objetivos do MVP

1. Ir de roteiro + clipes brutos para um vídeo montado com o mínimo de trabalho manual.
2. Escolher automaticamente, em cada clipe, o trecho que melhor mostra o que o roteiro pede para aquele take.
3. Cortar dentro da faixa de duração do roteiro (ex.: 4-6s) **sem nunca cortar no meio de uma execução**.
4. Deixar o usuário conferir e ajustar cada escolha rapidamente antes de exportar.

**Sucesso:** a maioria dos takes escolhidos automaticamente não precisa de ajuste, e o vídeo bruto fica pronto em poucos minutos de trabalho do usuário.

## 3. Fora do MVP

**Features futuras** (a arquitetura não deve impedir, mas não são construídas agora):

- Música: detectar a batida e cortar no ritmo.
- Câmera lenta aplicada pelo app.
- Close gerado por recorte e zoom de outro take quando o take está faltando.

**Não-objetivos** (não estão nos planos):

- Colocar música no vídeo final (fica no CapCut/Instagram por causa de licença).
- Baixar áudio de links do Spotify ou YouTube.
- Legendas e texto na tela.
- Correção de cor, filtros, transições e efeitos.
- Exportar projeto do CapCut (formato fechado). A saída é um vídeo pronto.
- Multiusuário, login ou deploy na nuvem. O app roda só no PC do usuário.
- Gerar o roteiro (vem pronto do Claude, fora do app).

## 4. Anti-objetivos (falhou mesmo se "funcionar")

- **Corte no meio de uma execução** (uma repetição interrompida). É a regra mais importante do app.
- O app dá mais trabalho que editar à mão.
- As escolhas automáticas são uma caixa-preta: o usuário não entende por que o trecho foi escolhido ou não consegue trocar.
- Custo de API surpresa.

## 5. Fluxo do usuário

1. **Grava** os takes seguindo o roteiro. A ordem de gravação não importa.
2. **Renomeia** os arquivos pela ordem do roteiro: `take1.mov`, `take2.mov`... Mais de uma tentativa do mesmo take: `take3a.mov`, `take3b.mov`.
3. No app, **cria um projeto**: cola o texto do roteiro e informa a pasta dos clipes.
4. O app **interpreta o roteiro** e mostra a lista de takes (duração, ação, enquadramento). O usuário pode corrigir qualquer campo.
5. O app mostra a **estimativa de custo** da análise e o usuário confirma.
6. O app **analisa e monta** a primeira versão.
7. **Revisão:** para cada take, o usuário vê o trecho escolhido e o motivo em uma frase. Pode trocar de clipe, mover o início ou mudar a duração.
8. **Exporta:** vídeo MP4 vertical sem som + um resumo com a lista de cortes.
9. No CapCut: música, ritmo, câmera lenta e finalização.

## 6. Entradas

### 6.1 Roteiro

Texto livre gerado pelo Claude, com emojis e seções. Exemplo real:

```
Takes (nesta ordem)

Gancho (1-2s): close no disco/placa de peso. Tripé, 52mm, a 0,8-1,2m
Chegada (2-3s): plano largo, 24mm, a 3-4m, câmera baixa. Você entra no quadro e se posiciona
Série válida (4-6s): plano médio, 52mm, a 1,5-2m, diagonal 45°, câmera abaixo dos olhos
Grave 2-3 reps, com foco na descida lenta (parece mais pesada)
Close de contração (2-3s): handheld, 52mm, a 1m. Pegue o quadríceps ou a pegada nas barras na subida
Última rep (3-5s): mesmo ângulo do take 3, em 60fps. Depois desacelere 30-50% na edição
Fechamento (1-2s): você respirando, soltando ou saindo de cena
```

O app manda o texto para o Claude e recebe uma lista estruturada. Cada take tem:

| Campo                          | Exemplo                          | Obrigatório    |
| ------------------------------ | -------------------------------- | -------------- |
| número (ordem no roteiro)      | 3                                | sim            |
| nome                           | "Série válida"                   | sim            |
| duração mínima e máxima (s)    | 4 e 6                            | sim            |
| ação esperada (o que procurar) | "2-3 reps com descida lenta"     | sim            |
| tipo de enquadramento          | close / médio / aberto           | não            |
| lente / distância / ângulo     | "52mm", "1,5-2m", "diagonal 45°" | não            |
| tem execução do exercício?     | sim / não                        | sim (inferido) |

- Seções que não são takes (ex.: "Antes de gravar") são ignoradas.
- Duração com valor único ("2s") vira mínimo = máximo.
- Instruções de edição que o MVP não faz (ex.: "desacelere 30-50%") são guardadas como **nota do take** e aparecem no resumo exportado, para o usuário lembrar de fazer no CapCut.
- O resultado é validado com schema. Se o Claude devolver algo inválido, o app mostra o erro e deixa o usuário preencher a tabela à mão.

### 6.2 Clipes

- Pasta local informada pelo usuário (normalmente a pasta sincronizada da Blackmagic Cloud).
- Nome: `take<N><letra opcional>.<ext>`, sem diferenciar maiúsculas e minúsculas. Extensões: `.mov` e `.mp4`.
- Arquivos fora do padrão aparecem como "ignorados", sem erro.
- Formato (confirmado com um clipe real):
  - **H.265 Main (8 bits, SDR):** não é HDR nem log, então não precisa converter cor.
  - **60fps** estável.
  - **Vertical:** o usuário sempre grava com o celular em pé. O arquivo pode vir gravado "deitado" com marcação de rotação; o app precisa respeitar essa rotação (o ffmpeg faz isso por padrão, e os testes devem cobrir).
  - Clipe de teste: 1280×720 com rotação de -90° (ou seja, **720×1280 vertical**), container `.mov`, nome original da câmera (`A001_11051828_C019.mov`).
  - Áudio AAC, descartado.
  - O arquivo traz metadados do Blackmagic Camera, entre eles a **lente** (`com.blackmagic-design.camera.lensType`, ex.: "iPhone 14 Pro Max 24mm"). O app mostra um aviso quando a lente do clipe não bate com a do roteiro.
  - O arquivo traz também a **localização GPS** da gravação.
- **Resolução:** o usuário achava que gravava em 4K, mas o clipe de teste é 720p. Pode ser a configuração do app ou uma cópia leve (proxy) da Blackmagic Cloud. O MVP usa o arquivo que estiver na pasta e **avisa quando o clipe tem menos de 1080 pixels no lado menor** ("resolução baixa, pode ser proxy"). A exportação é permitida, com esse aviso.

## 7. Como o app monta o vídeo

### 7.1 Escolha do trecho de cada take

Para cada take, considerando todos os clipes dele (`take3a`, `take3b`...):

1. **Quadros:** o ffmpeg extrai quadros reduzidos em intervalo fixo (ponto de partida: 2 por segundo, ~512px no lado maior).
2. **Visão (Claude):** os quadros vão para o Claude junto com a descrição do take. Ele devolve uma nota por quadro (quanto aquele momento mostra a ação pedida) e uma frase curta explicando a escolha.
3. **Movimento (local):** o app mede a diferença entre quadros para encontrar onde o movimento começa e para. Em takes com execução, isso marca o início e o fim de cada repetição.
4. **Janela:** o app procura a janela dentro da faixa de duração com a maior nota somada.
5. **Vários clipes:** a melhor janela entre todos os clipes do take vence. Os outros continuam disponíveis para troca na revisão.

### 7.2 Regra das execuções (prioridade máxima)

Em takes com execução, **um corte nunca cai no meio de uma repetição**. Ordem de prioridade quando as regras entram em conflito:

1. **Não cortar no meio de uma execução.** Nunca é violada.
2. **Respeitar a faixa de duração do roteiro.** Se só for possível cumprir a regra 1 saindo da faixa, o app sai da faixa o mínimo necessário e mostra um aviso no take.
3. **Maior nota da visão.**

Sem música no MVP, a duração-alvo inicial é o meio da faixa, ajustada pelas regras acima.

### 7.3 Take faltando

Se um take do roteiro não tem clipe, ele fica marcado como "faltando". O usuário escolhe entre **pular o take** (some do vídeo) ou adicionar o clipe e reanalisar. A exportação fica bloqueada enquanto houver take faltando sem decisão.

### 7.4 Enquadramento

- Saída vertical 9:16.
- Clipe vertical: só redimensiona.
- Clipe horizontal: recorte central para 9:16, com a posição ajustável na revisão.

## 8. Revisão

Uma tela com a lista de takes na ordem do roteiro. Para cada um:

- miniatura e prévia do trecho escolhido;
- clipe usado, com troca para outro clipe do mesmo take;
- controles para mover o início (passos de 1 quadro e de 0,5s) e mudar a duração;
- a frase do Claude explicando a escolha;
- avisos: fora da faixa de duração, nota baixa, take faltando, e **corte no meio de execução** quando o próprio usuário arrasta o corte para lá (o app avisa, mas respeita a escolha manual).

Mudar um take não altera os outros: sem música, os takes são independentes.

E uma prévia do vídeo inteiro.

Como o navegador pode não tocar o codec original, o backend gera **prévias leves em H.264** para a tela de revisão.

## 9. Saída

- **Vídeo:** MP4, H.264, 1080×1920, **60fps** (mantém os quadros para a câmera lenta no CapCut), sem áudio. Clipes 4K são reduzidos; proxies 720p são ampliados (com o aviso da seção 6.2).
- **Resumo** (`.md` ao lado do vídeo): lista de cortes (take, clipe, início e fim no original, duração) e as notas de edição de cada take (ex.: "desacelere 30-50%").

## 10. Custo da análise

- Antes de mandar quadros para o Claude, o app mostra quantos quadros vão e uma estimativa de custo.
- **Teto padrão de US$ 0,50 por vídeo** (decisão minha, ver seção 11), configurável. Acima do teto, o app pede confirmação explícita.
- Modelo padrão: o mais barato com visão. Configurável.
- Os resultados ficam guardados no projeto: reabrir o projeto não manda os quadros de novo.

## 11. Decisões técnicas

### Tomadas pelo usuário

- **MVP = cortes e junção seguindo o roteiro.** Música/batida, câmera lenta e close por recorte ficam para depois.
- **Nunca cortar no meio de uma execução** é a regra principal.
- Monorepo **pnpm**; **Node.js + TypeScript** no backend; **React** no frontend.
- Backend em camadas: routes → controllers → middlewares → services → repositories.
- Frontend: `api/`, `hooks/`, `lib/`, `components/`.
- **TDD** com testes de comportamento e casos de borda; **Vitest** para unitários e **Playwright** para e2e.
- Regras de engenharia completas em [`docs/engineering.md`](../../engineering.md).

### Tomadas por mim (Claude), podem ser revistas

- **Express 5** na API e **Vite** no frontend (já no esqueleto).
- **ffmpeg** para extrair quadros, cortar, redimensionar, gerar prévias e exportar.
- **API do Claude** com visão para interpretar o roteiro e dar nota aos quadros. Chave no `.env`.
- **Teto de custo de US$ 0,50 por vídeo** e modelo mais barato com visão como padrão.
- **Fora da faixa de duração** é permitido, com aviso, quando necessário para não cortar uma execução.
- **Instruções que o MVP não executa** (câmera lenta) viram notas no resumo exportado.
- **Saída em 1080×1920 60fps** e aviso de proxy abaixo de 1080 pixels.
- **Persistência em arquivos JSON** numa pasta `data/` fora do git, um diretório por projeto (roteiro interpretado, escolhas, cache da análise, prévias). O repository isola isso.

## 12. Futuro: proxy e original

Usar o proxy 720p na análise (mais rápido e barato) e o original 4K na exportação, pareando os dois arquivos. Fica fora do MVP porque ainda não se sabe como a Blackmagic Cloud nomeia e organiza os proxies na pasta.

Os vídeos de exemplo em `fixtures/videos/` devem imitar o formato real: curtos (1 a 3s), H.265, 60fps, verticais com marcação de rotação, em baixa resolução para não pesar no repositório.

**Privacidade:** o repositório é público. Qualquer fixture feita a partir de um clipe real precisa ter **todos os metadados apagados** (GPS, modelo do aparelho, datas) antes do commit. O clipe original em `fixtures/videos/` fica fora do git (`.gitignore` bloqueia `.mov`). Os vídeos exportados pelo app não levam os metadados de localização dos clipes de origem.

## 13. Casos de borda que os testes precisam cobrir

**Roteiro**

- texto vazio, texto sem nenhum take, só emojis;
- duração inválida ("abc", negativa, zero, mínimo maior que máximo);
- take com duração única ("2s");
- resposta do Claude fora do schema.

**Clipes**

- pasta não existe, pasta vazia, sem permissão;
- nome fora do padrão, `take0`, `take-1`, `take3c` sem `take3a`;
- take do roteiro sem clipe; clipe sem take no roteiro;
- arquivo que não é vídeo ou está corrompido;
- clipe mais curto que a duração mínima pedida.

**Montagem**

- nenhuma janela com nota boa (escolhe a melhor disponível e avisa);
- execução mais longa que a duração máxima (sai da faixa com aviso, sem cortar a execução);
- clipe em que nenhuma execução é detectada num take que deveria ter;
- take faltando sem decisão bloqueia a exportação;
- estimativa de custo acima do teto.

## 14. Fatias de entrega sugeridas

1. **Roteiro:** colar texto → lista de takes estruturada e editável.
2. **Clipes:** pasta → mapeamento take ↔ clipes, com avisos.
3. **Montagem simples e exportação:** trecho do meio de cada clipe → MP4 vertical sem som + resumo. O fluxo completo já funciona, ainda sem inteligência.
4. **Detecção de execução** (movimento): cortes que nunca interrompem uma repetição.
5. **Escolha por visão** (com estimativa de custo, teto e cache).
6. **Tela de revisão completa** com prévias.

## 15. Fica a cargo de quem construir

- Biblioteca de validação de schema.
- Formato exato do prompt para o Claude e do JSON de resposta.
- Taxa de quadros da análise e tamanho das imagens (respeitando o teto de custo).
- Algoritmo de detecção de movimento e de início/fim de repetição.
- Layout visual das telas.
- Estrutura interna das pastas de cada projeto em `data/`.
- Como a análise longa reporta progresso para a tela.
