import net from 'node:net';

const ADMIN_COMMANDS = new Set(['time', 'weather', 'difficulty', 'teleport', 'whitelist']);
const VALID = {
  time: new Set(['day', 'night']), weather: new Set(['clear', 'rain', 'thunder']),
  difficulty: new Set(['peaceful', 'easy', 'normal', 'hard']), whitelist: new Set(['add', 'remove', 'on', 'off'])
};

function encodePacket(id, type, body) {
  const payload = Buffer.from(body, 'utf8');
  const packet = Buffer.alloc(14 + payload.length);
  packet.writeInt32LE(10 + payload.length, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  payload.copy(packet, 12);
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
      const cleanup = () => { clearTimeout(timer); this.socket?.off('data', onData); this.socket?.off('error', onError); };
      const onError = (error) => { cleanup(); reject(error); };
      const timer = setTimeout(() => { cleanup(); this.close(); reject(new Error('RCON response timeout')); }, this.timeoutMs);
      const onData = (chunk) => {
        data = Buffer.concat([data, chunk]);
        while (data.length >= 4) {
          const length = data.readInt32LE(0);
          if (length < 10 || length > 1048576) return onError(new Error('Invalid RCON frame'));
          if (data.length < length + 4) return;
          const payload = data.subarray(4, 4 + length);
          data = data.subarray(length + 4);
          const responseId = payload.readInt32LE(0);
          const responseType = payload.readInt32LE(4);
          if (responseId === -1) return onError(new Error('RCON authentication failed'));
          if (responseId !== id || (type === 3 && responseType !== 2)) continue;
          cleanup(); resolve(payload.subarray(8, payload.length - 2).toString('utf8')); return;
        }
      };
      this.socket.on('data', onData); this.socket.once('error', onError); this.socket.write(packet);
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
