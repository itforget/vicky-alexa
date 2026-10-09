# Alexa ↔ Hermin

Endpoint local de uma Alexa Custom Skill em português brasileiro. A skill recebe a frase do usuário e encaminha para o servidor OpenAI-compatible do Hermes.

## Estado

- Projeto TypeScript compilado com sucesso.
- Endpoint local: `POST /alexa`.
- Healthcheck: `GET /health`.
- Modelo de interação: `interaction-model.pt-BR.json`.
- Manifesto: `alexa-manifest.template.json`.

## Configuração local

Crie variáveis no ambiente do processo, sem commitar segredos:

```bash
HERMES_API_URL=http://127.0.0.1:8642
HERMES_API_KEY=<chave do API server do Hermes>
PORT=3000
npm start
```

O endpoint deve ser publicado em HTTPS para a Alexa. Não exponha a porta do Hermes diretamente à internet; use um proxy/túnel com autenticação e encaminhe apenas `/alexa`.

## Próximos passos na Alexa Developer Console

1. Criar uma Custom Skill em `pt-BR` com invocation name `hermin`.
2. Importar `interaction-model.pt-BR.json` no JSON Editor.
3. Publicar o endpoint HTTPS terminado em `/alexa`.
4. Testar com: “Alexa, abrir Hermin” e depois “pergunte ao Hermin ...”.

A conta Amazon Developer e um endpoint HTTPS público são necessários para concluir o vínculo com um Echo Dot.
