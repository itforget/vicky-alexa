import express from 'express';
import {ExpressAdapter} from 'ask-sdk-express-adapter';
import {
  ErrorHandler,
  HandlerInput,
  RequestHandler,
  Skill,
  SkillBuilders,
} from 'ask-sdk-core';

const app = express();
const port = Number(process.env.PORT ?? 3011);
const hermesUrl = (process.env.HERMES_API_URL ?? 'http://127.0.0.1:8642').replace(/\/$/, '');
const hermesKey = process.env.HERMES_API_KEY;

const speak = (handlerInput: HandlerInput, speech: string, reprompt?: string) => {
  const response = handlerInput.responseBuilder.speak(speech).withShouldEndSession(false);
  response.reprompt(reprompt ?? 'O que mais você quer saber?');
  return response.getResponse();
};

const alexaSafe = (text: string) => text
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[*_~`#]/g, '')
  .replace(/[<>]/g, ' ')
  .replace(/&(?!(amp|lt|gt|quot|apos);)/g, ' e ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 1600);

const LaunchHandler: RequestHandler = {
  canHandle: (input) => input.requestEnvelope.request.type === 'LaunchRequest',
  handle: (input) => speak(input, 'Olá, eu sou o Vicky. O que você quer saber?', 'Diga, por exemplo: Vicky, qual é a previsão do tempo?'),
};

const AskHermesHandler: RequestHandler = {
  canHandle: (input) => input.requestEnvelope.request.type === 'IntentRequest' && input.requestEnvelope.request.intent.name === 'AskHermesIntent',
  async handle(input) {
    const request = input.requestEnvelope.request;
    if (request.type !== 'IntentRequest') return speak(input, 'Não entendi o pedido.');
    const query = request.intent.slots?.query?.value?.trim();
    if (!query) return speak(input, 'Não ouvi o que você queria perguntar.');
    if (!hermesKey) return speak(input, 'A conexão segura com o Vicky ainda não está configurada.');

    try {
      const response = await fetch(`${hermesUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {'content-type': 'application/json', authorization: `Bearer ${hermesKey}`},
        body: JSON.stringify({
          model: process.env.HERMES_MODEL ?? 'default',
          messages: [{role: 'user', content: query}],
          stream: false,
        }),
        // Alexa expects a response within a few seconds. Return a valid
        // fallback instead of letting the HTTPS request time out.
        signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) throw new Error(`Hermes returned ${response.status}`);
      const data = await response.json() as {choices?: Array<{message?: {content?: string}}>};
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error('Empty Hermes response');
      return speak(input, alexaSafe(answer));
    } catch (error) {
      console.error('Hermes request failed', error);
      return speak(input, 'Não consegui falar com o Vicky agora. Tente novamente em alguns segundos.');
    }
  },
};

const HelpHandler: RequestHandler = {
  canHandle: (input) => input.requestEnvelope.request.type === 'IntentRequest' && input.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent',
  handle: (input) => speak(input, 'Você pode dizer: Vicky, explique este assunto, ou fazer uma pergunta direta depois de abrir a skill.'),
};

const StopHandler: RequestHandler = {
  canHandle: (input) => input.requestEnvelope.request.type === 'SessionEndedRequest' || (input.requestEnvelope.request.type === 'IntentRequest' && ['AMAZON.StopIntent', 'AMAZON.CancelIntent'].includes(input.requestEnvelope.request.intent.name)),
  handle: (input) => input.responseBuilder.speak('Até mais.').withShouldEndSession(true).getResponse(),
};

const ErrorHandler: ErrorHandler = {
  canHandle: () => true,
  handle: (input, error) => {
    console.error('Alexa error', error);
    return speak(input, 'Tive um problema ao processar isso. Tente novamente.');
  },
};

const skill = SkillBuilders.custom()
  .addRequestInterceptors({process(input) {
    const applicationId = input.requestEnvelope.context?.System?.application?.applicationId;
    if (!process.env.ALEXA_SKILL_ID || applicationId !== process.env.ALEXA_SKILL_ID) {
      throw new Error('Unauthorized Alexa skill');
    }
  }})
  .addRequestHandlers(LaunchHandler, AskHermesHandler, HelpHandler, StopHandler)
  .addErrorHandlers(ErrorHandler)
  .create();

app.get('/health', (_req, res) => res.json({ok: true, service: 'alexa-hermin'}));
app.post('/alexa', (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!process.env.ALEXA_SKILL_ID) {
    res.status(503).json({error: 'Alexa skill not configured'});
    return;
  }
  next();
}, new ExpressAdapter(skill, true, true).getRequestHandlers());
app.listen(port, '0.0.0.0', () => console.log(`Alexa Vicky listening on port ${port}`));
