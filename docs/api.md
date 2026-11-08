# API

Todas as rotas ficam sob `/api`. Corpo e respostas em JSON; o corpo aceito tem no máximo 200kb.

## Rotas

| Método | Caminho                          | Corpo            | Sucesso           |
| ------ | -------------------------------- | ---------------- | ----------------- |
| GET    | `/api/health`                    | —                | 200 `{ status }`  |
| POST   | `/api/projects`                  | `{ scriptText }` | 201 `ProjectView` |
| GET    | `/api/projects/:id`              | —                | 200 `ProjectView` |
| PUT    | `/api/projects/:id/takes`        | `{ takes }`      | 200 `ProjectView` |
| PUT    | `/api/projects/:id/clips-folder` | `{ folder }`     | 200 `ProjectView` |

- `scriptText`: texto do roteiro, até 20.000 caracteres.
- `takes`: lista de até 50 takes (formato abaixo). Substitui todos os takes do projeto.
- `folder`: caminho completo da pasta dos clipes (até 1000 caracteres, ex.: `D:Videos	reino`). A API lê a pasta com o ffprobe, guarda o resultado no projeto e devolve o `clipMapping`. Cada nova leitura substitui a anterior.

## ProjectView

```json
{
  "id": "uuid",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "scriptText": "texto do roteiro",
  "interpretationError": null,
  "takes": [
    {
      "number": 1,
      "name": "Chegada",
      "minSeconds": 2,
      "maxSeconds": 3,
      "action": "Você entra no quadro",
      "framing": "wide",
      "lens": "24mm",
      "distance": "3-4m",
      "angle": "câmera baixa",
      "hasExecution": false,
      "notes": []
    }
  ],
  "takeErrors": [{ "takeNumber": 1, "field": "maxSeconds", "message": "..." }],
  "clipMapping": null
}
```

- `framing`: `"close"`, `"medium"`, `"wide"` ou `null`. `lens`, `distance` e `angle` podem ser `null`.
- `name` e `action` aceitam até 500 caracteres; `notes` aceita até 20 itens.
- `interpretationError`: aviso quando a IA não conseguiu montar os takes (o usuário preenche à mão); `null` caso contrário.
- `takeErrors`: erros de regra dos takes. Não impedem salvar: o `PUT` responde 200 mesmo com erros.
- `clipMapping`: `null` até a pasta de clipes ser lida. Depois da leitura, é recalculado a cada resposta a partir dos takes e da última leitura (editar os takes atualiza os avisos sem reler a pasta).

## clipMapping

```json
{
  "folder": "D:\Videos\treino",
  "scannedAt": "2026-01-01T00:00:00.000Z",
  "takes": [
    {
      "takeNumber": 1,
      "clips": [
        {
          "fileName": "take1.mp4",
          "takeNumber": 1,
          "attempt": null,
          "video": {
            "durationSeconds": 1.5,
            "width": 180,
            "height": 320,
            "fps": 60,
            "lensType": "iPhone 14 Pro Max 52mm"
          },
          "readError": null,
          "warnings": [
            { "code": "too-short", "message": "O clipe tem 1,5s, menos que o mínimo do take (2s)." }
          ]
        }
      ],
      "warnings": [{ "code": "attempt-gap", "message": "Tentativa faltando: take2b." }]
    }
  ],
  "orphanClips": [],
  "ignoredFiles": [{ "fileName": "leiame.txt", "reason": "..." }],
  "notices": []
}
```

- Os clipes são nomeados `take<N>` com letra de tentativa opcional (`take3.mov`, `take3a.mp4`). `attempt` é a letra minúscula ou `null`.
- `takes`: um item por take do roteiro, na ordem do roteiro. `orphanClips`: clipes cujo número não existe no roteiro. `ignoredFiles`: arquivos que não são clipes. `notices`: avisos gerais (ex.: resolução baixa, pasta sem clipes).
- `video` é `null` e `readError` vem preenchido quando o arquivo não pôde ser lido; a largura e a altura já consideram a rotação.
- Avisos do clipe (`warnings[].code`): `unreadable`, `too-short`, `lens-mismatch`.
- Avisos do take (`warnings[].code`): `missing`, `no-readable-clip`, `attempt-gap`, `duplicate`.
- Avisos não impedem nada: o `PUT` responde 200.

## Erros

Sempre neste formato:

```json
{ "error": "mensagem", "details": [{ "path": "takes.0.name", "message": "..." }] }
```

`details` só aparece em "Dados inválidos.", com o caminho do campo separado por `.`.

| Status | Mensagem                                                                                       | Quando                                         |
| ------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 400    | `Dados inválidos.`                                                                             | Corpo com campo faltando ou do tipo errado     |
| 400    | `JSON inválido.`                                                                               | Corpo não é um JSON válido                     |
| 400    | `O roteiro está vazio.`                                                                        | `scriptText` só com espaços                    |
| 400    | `O roteiro não tem texto, só símbolos ou emojis.`                                              | `scriptText` sem letras nem números            |
| 400    | `O roteiro passa de 20.000 caracteres.`                                                        | `scriptText` grande demais                     |
| 400    | `Informe a pasta dos clipes.`                                                                  | `folder` só com espaços                        |
| 400    | `Use o caminho completo da pasta (ex.: D:Videos	reino).`                                        | `folder` não é um caminho absoluto             |
| 400    | `A pasta não existe.`                                                                          | Caminho inexistente                            |
| 400    | `O caminho informado não é uma pasta.`                                                         | O caminho aponta para um arquivo               |
| 400    | `Sem permissão para ler a pasta.`                                                              | O sistema negou o acesso à pasta               |
| 404    | `Projeto não encontrado.`                                                                      | Id inexistente ou que não é um UUID            |
| 413    | `Requisição grande demais.`                                                                    | Corpo acima de 200kb                           |
| 500    | `ffprobe não encontrado. Instale o ffmpeg e deixe o ffprobe no PATH (ou defina FFPROBE_PATH).` | ffprobe indisponível ao ler a pasta            |
| 500    | `Erro interno do servidor`                                                                     | Erro inesperado (detalhes só no log do server) |

Falha da IA ao interpretar o roteiro **não** é erro HTTP: o projeto é criado com `takes: []` e `interpretationError` preenchido
(`Não foi possível interpretar o roteiro. Preencha os takes à mão.` ou `Nenhum take encontrado no roteiro. Preencha os takes à mão.`).
