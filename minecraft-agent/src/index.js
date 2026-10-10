import mineflayer from 'mineflayer';
import pathfinderPackage from 'mineflayer-pathfinder';
import { parseChatCommand } from './commands.js';
import { BotController } from './controller.js';
import { createControlServer } from './control-api.js';
import { RconClient } from './rcon.js';
import { configureSafeMovements } from './movement.js';
import { createLanguagePlanner } from './planner.js';

const { pathfinder, Movements, goals } = pathfinderPackage;
const host = process.env.MC_HOST ?? '161.97.115.217';
const port = Number(process.env.MC_PORT ?? 25565);
const username = process.env.BOT_USERNAME ?? 'Vicky';
const owner = (process.env.OWNER_USERNAME ?? 'itforget').toLowerCase();
const reconnectMs = Number(process.env.RECONNECT_MS ?? 10000);
const controlPort = Number(process.env.CONTROL_API_PORT ?? 3000);

let bot;
let controller;
let controlServer;
let rcon;
let commandEpoch = 0;
const planner = createLanguagePlanner();

function gameState() {
  const status = controller?.status?.() ?? { online: false };
  return {
    ...status,
    position: bot?.entity?.position ? { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z } : null,
    inventory: controller?.inventoryCounts?.() ?? {}
  };
}

function say(message) { if (bot?.player) bot.chat(String(message).slice(0, 240)); }

function startControlApi() {
  if (!process.env.CONTROL_API_KEY) { console.warn('CONTROL_API_KEY is not set; HTTP control API is disabled.'); return; }
  controlServer = createControlServer({
    apiKey: process.env.CONTROL_API_KEY,
    planner,
    getGameState: gameState,
    getStatus: () => controller?.status() ?? { online: false },
    executeCommand: async (command) => {
      if (command.type === 'stop') commandEpoch += 1;
      if (['time', 'weather', 'difficulty', 'teleport', 'whitelist'].includes(command.type)) {
        if (!rcon) throw new Error('RCON is not configured.');
        return rcon.execute(command);
      }
      return controller.execute(command);
    }
  });
  controlServer.listen(controlPort, '0.0.0.0', () => console.log(`Control API listening on port ${controlPort}`));
}

function connect() {
  bot = mineflayer.createBot({ host, port, username, version: false, auth: 'offline', checkTimeoutInterval: 60000 });
  bot.loadPlugin(pathfinder);
  controller = new BotController({ bot, goals, say, host, port });
  bot.once('spawn', () => {
    const movements = configureSafeMovements(new Movements(bot));
    bot.pathfinder.setMovements(movements);
    say('Estou online. Use "Vicky ajuda" para ver meus comandos.');
  });
  bot.on('entitySpawn', entity => controller.onEntitySpawn(entity));
  bot.on('chat', async (sender, message) => {
    if (sender === bot.username || !/^vicky(?:agent)?(?:\s|,|$)/i.test(message.trim())) return;
    if (owner && sender.toLowerCase() !== owner) return;
    const command = parseChatCommand(message, username);
    if (command?.type === 'stop') commandEpoch += 1;
    if (!command) {
      if (!process.env.HERMES_API_URL || !process.env.HERMES_API_KEY) return;
      const epoch = commandEpoch;
      const planned = await planner.plan({ owner: sender, request: String(message).slice(0, 600), gameState: gameState() });
      if (epoch !== commandEpoch) return;
      if (!planned.ok) return say('Não consegui planejar esse pedido com segurança.');
      if (planned.command && planned.requiresConfirmation) return say(`${planned.reply || 'Tenho uma proposta.'} Confirme pelo POST /command autenticado.`);
      if (planned.command && planner.safeCommands.has(planned.command.type)) {
        try {
          const result = await controller.execute({ ...planned.command, sender });
          return say(result?.message || planned.reply || 'Concluído.');
        } catch (error) { return say(error.message); }
      }
      return say(planned.reply || 'Não tenho uma ação segura para esse pedido.');
    }
    if (command.requiresConfirmation) { say('Esse trabalho exige autorização explícita pela API HTTP autenticada.'); return; }
    try {
      if (command.type === 'help') return say('Comandos: siga [jogador], pare, venha, proteja, encontre diamantes, status. Coleta/construção: API autenticada com confirmação.');
      const result = await controller.execute({ ...command, sender });
      if (result?.message) say(result.message);
      else if (command.type === 'status') say(`Online em ${host}:${port}${result.following ? `, seguindo ${result.following}` : ''}.`);
    } catch (error) { say(error.message); }
  });
  bot.on('kicked', reason => console.error('Bot kicked:', reason));
  bot.on('error', error => console.error('Bot error:', error.message));
  bot.on('end', () => { console.error(`Bot disconnected; reconnecting in ${reconnectMs}ms`); setTimeout(connect, reconnectMs); });
}

if (process.env.RCON_HOST && process.env.RCON_PASSWORD) rcon = new RconClient({ host: process.env.RCON_HOST, port: Number(process.env.RCON_PORT ?? 25575), password: process.env.RCON_PASSWORD });
startControlApi();
connect();

export { connect };
