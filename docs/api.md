# API

Todas as rotas ficam sob `/api`. Corpo e respostas em JSON; o corpo aceito tem no máximo 200kb.

## Rotas

| Método | Caminho                   | Corpo            | Sucesso           |
| ------ | ------------------------- | ---------------- | ----------------- |
| GET    | `/api/health`             | —                | 200 `{ status }`  |
| POST   | `/api/projects`           | `{ scriptText }` | 201 `ProjectView` |
| GET    | `/api/projects/:id`       | —                | 200 `ProjectView` |
| PUT    | `/api/projects/:id/takes` | `{ takes }`      | 200 `ProjectView` |

- `scriptText`: texto do roteiro, até 20.000 caracteres.
- `takes`: lista de até 50 takes (formato abaixo). Substitui todos os takes do projeto.

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
  "takeErrors": [{ "takeNumber": 1, "field": "maxSeconds", "message": "..." }]
}
```

- `framing`: `"close"`, `"medium"`, `"wide"` ou `null`. `lens`, `distance` e `angle` podem ser `null`.
- `name` e `action` aceitam até 500 caracteres; `notes` aceita até 20 itens.
- `interpretationError`: aviso quando a IA não conseguiu montar os takes (o usuário preenche à mão); `null` caso contrário.
- `takeErrors`: erros de regra dos takes. Não impedem salvar: o `PUT` responde 200 mesmo com erros.

## Erros

Sempre neste formato:

```json
{ "error": "mensagem", "details": [{ "path": "takes.0.name", "message": "..." }] }
```

`details` só aparece em "Dados inválidos.", com o caminho do campo separado por `.`.

| Status | Mensagem                                          | Quando                                         |
| ------ | ------------------------------------------------- | ---------------------------------------------- |
| 400    | `Dados inválidos.`                                | Corpo com campo faltando ou do tipo errado     |
| 400    | `JSON inválido.`                                  | Corpo não é um JSON válido                     |
| 400    | `O roteiro está vazio.`                           | `scriptText` só com espaços                    |
| 400    | `O roteiro não tem texto, só símbolos ou emojis.` | `scriptText` sem letras nem números            |
| 400    | `O roteiro passa de 20.000 caracteres.`           | `scriptText` grande demais                     |
| 404    | `Projeto não encontrado.`                         | Id inexistente ou que não é um UUID            |
| 413    | `Requisição grande demais.`                       | Corpo acima de 200kb                           |
| 500    | `Erro interno do servidor`                        | Erro inesperado (detalhes só no log do server) |

Falha da IA ao interpretar o roteiro **não** é erro HTTP: o projeto é criado com `takes: []` e `interpretationError` preenchido
(`Não foi possível interpretar o roteiro. Preencha os takes à mão.` ou `Nenhum take encontrado no roteiro. Preencha os takes à mão.`).
