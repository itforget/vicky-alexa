import mineflayer from 'mineflayer';
import pathfinderPackage from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPackage;

const host = process.env.MC_HOST ?? '161.97.115.217';
const port = Number(process.env.MC_PORT ?? 25565);
const username = process.env.BOT_USERNAME ?? 'Vicky';
const owner = (process.env.OWNER_USERNAME ?? '').toLowerCase();
const reconnectMs = Number(process.env.RECONNECT_MS ?? 10000);

let bot;
let movements;
let followTarget;

function say(message) {
  if (bot?.player) bot.chat(String(message).slice(0, 240));
}

function connect() {
  bot = mineflayer.createBot({
    host,
    port,
    username,
    version: false,
    auth: 'offline',
    checkTimeoutInterval: 60000,
  });
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);
    say('Estou online. Use "Vicky ajuda" para ver meus comandos.');
  });

  bot.on('chat', (sender, message) => {
    if (sender === bot.username) return;
    const parts = message.trim().split(/\s+/);
    if (parts.length === 0 || parts[0].toLowerCase() !== 'vicky') return;
    const command = (parts[1] ?? 'ajuda').toLowerCase();
    const targetName = parts[2] || sender;

    if (owner && sender.toLowerCase() !== owner) {
      say(`${sender}, só aceito comandos do meu dono.`);
      return;
    }

    if (command === 'ajuda') {
      say('Comandos: Vicky siga [jogador], Vicky pare, Vicky venha, Vicky status.');
      return;
    }
    if (command === 'siga' || command === 'segue') {
      const target = bot.players[targetName]?.entity;
      if (!target) return say(`Não encontrei ${targetName}.`);
      followTarget = targetName;
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
      say(`Vou seguir ${targetName}.`);
      return;
    }
    if (command === 'pare' || command === 'parar') {
      followTarget = undefined;
      bot.pathfinder.setGoal(null);
      say('Parei.');
      return;
    }
    if (command === 'venha' || command === 'vem') {
      const target = bot.players[sender]?.entity;
      if (!target) return say('Não consigo localizar você agora.');
      followTarget = sender;
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
      say('Estou indo.');
      return;
    }
    if (command === 'status') {
      say(`Online em ${host}:${port}${followTarget ? `, seguindo ${followTarget}` : ''}.`);
      return;
    }
    say('Não conheço esse comando. Diga Vicky ajuda.');
  });

  bot.on('kicked', (reason) => console.error('Bot kicked:', reason));
  bot.on('error', (error) => console.error('Bot error:', error.message));
  bot.on('end', () => {
    console.error(`Bot disconnected; reconnecting in ${reconnectMs}ms`);
    setTimeout(connect, reconnectMs);
  });
}

connect();
