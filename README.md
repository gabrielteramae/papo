# papo — chat bot no navegador

![Node](https://img.shields.io/badge/Node-20+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-e07a3d)

Um chat simples: você escreve, o modelo responde em fluxo, e a conversa fica **só no navegador** (`localStorage`). O servidor não guarda mensagem. A chave da API fica no processo, nunca no cliente.

Não é bot de Discord, Telegram ou WhatsApp. É uma página.

## Por que o servidor existe

| Peça | Faz |
|---|---|
| Página | Histórico, papos, campo de texto. |
| `POST /api/chat` | Confere o pedido e fala com a API da xAI. |
| Chave | `XAI_API_KEY` no ambiente. Sem arquivo `.env` commitado. |

O cliente não escolhe o modelo, o prompt de sistema nem o tamanho da resposta. Mensagem vazia, papel estranho ou texto acima de 4000 caracteres volta com erro, sem chamar a API.

## Stack

- **Node 20+**, só biblioteca padrão (`node:http`, `node:fs`, `node:test`)
- Modelo: `grok-4.5`, stream, no máximo 700 tokens por resposta
- Histórico enviado: no máximo 20 mensagens
- Interface estática em `src/public`

## Estrutura

```
papo/
├── src/
│   ├── server.mjs       # estático + POST /api/chat
│   ├── limits.mjs       # validação do pedido (sem rede)
│   └── public/          # página do chat
└── tests/
    └── test_limits.mjs  # limites, papéis e corte do histórico
```

## Como rodar

```bash
git clone https://github.com/gabrielteramae/papo.git
cd papo
npm test
XAI_API_KEY=sua-chave npm start
```

Abre `http://127.0.0.1:3000`. A porta muda com `PORT`.

Sem a chave, a página abre e o envio responde que o chat não está disponível. A chave não entra no repositório.

## Testes realizados

`tests/test_limits.mjs` não chama a rede. Cobre pedido vazio, texto com espaço, papel `system`, conteúdo que não é string, mensagem acima de 4000 caracteres, histórico que não termina na pessoa, e o corte para as últimas 20 mensagens.

---

© 2026 Gabriel Teramae Chan
