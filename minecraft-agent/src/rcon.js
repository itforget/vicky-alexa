import net from 'node:net';

const ADMIN_COMMANDS = new Set(['time', 'weather', 'difficulty', 'teleport', 'whitelist']);
const VALID = {
  time: new Set(['day', 'night']), weather: new Set(['clear', 'rain', 'thunder']),
  difficulty: new Set(['peaceful', 'easy', 'normal', 'hard']), whitelist: new Set(['add', 'remove', 'on', 'off'])
};

function encodePacket(id, type, body) {
  const payload = Buffer.from(`${id}\0${type}\0${body}\0`, 'utf8');
  const packet = Buffer.alloc(4 + payload.length);
  packet.writeInt32LE(payload.length, 0); payload.copy(packet, 4);
  return packet;
}

export class RconClient {
  constructor({ host, port = 25575, password, timeoutMs = 5000 } = {}) {
    this.host = host; this.port = port; this.password = password; this.timeoutMs = timeoutMs; this.socket = null; this.nextId = 1;
  }
  async connect() {
    if (this.socket) return;
    this.socket = await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('RCON timeout')); }, this.timeoutMs);
      socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
      socket.once('error', reject);
    });
    await this.request(3, this.password);
  }
  request(type, body) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const packet = encodePacket(id, type, body);
      let data = Buffer.alloc(0);
      const onData = (chunk) => {
        data = Buffer.concat([data, chunk]);
        if (data.length < 4 || data.readInt32LE(0) + 4 > data.length) return;
        const length = data.readInt32LE(0); const payload = data.subarray(4, 4 + length);
        this.socket.off('data', onData); const responseId = payload.readInt32LE(0);
        if (responseId !== id) return reject(new Error('Unexpected RCON response'));
        resolve(payload.subarray(12, payload.length - 2).toString('utf8'));
      };
      this.socket.on('data', onData); this.socket.once('error', reject); this.socket.write(packet);
    });
  }
  async execute(command) {
    if (!ADMIN_COMMANDS.has(command?.type)) throw new Error('RCON command is not allowlisted.');
    let text;
    if (command.type === 'time') { if (!VALID.time.has(command.value)) throw new Error('Invalid time value'); text = `time set ${command.value}`; }
    if (command.type === 'weather') { if (!VALID.weather.has(command.value)) throw new Error('Invalid weather value'); text = `weather ${command.value}`; }
    if (command.type === 'difficulty') { if (!VALID.difficulty.has(command.value)) throw new Error('Invalid difficulty value'); text = `difficulty ${command.value}`; }
    if (command.type === 'teleport') { if (!/^[A-Za-z0-9_]{1,16}$/.test(command.player) || ![command.x, command.y, command.z].every(Number.isFinite)) throw new Error('Invalid teleport'); text = `tp ${command.player} ${command.x} ${command.y} ${command.z}`; }
    if (command.type === 'whitelist') { if (!VALID.whitelist.has(command.action) || !/^[A-Za-z0-9_]{1,16}$/.test(command.player)) throw new Error('Invalid whitelist operation'); text = command.action === 'on' || command.action === 'off' ? `whitelist ${command.action}` : `whitelist ${command.action} ${command.player}`; }
    await this.connect(); return { ok: true, response: await this.request(2, text) };
  }
  close() { this.socket?.destroy(); this.socket = null; }
}
