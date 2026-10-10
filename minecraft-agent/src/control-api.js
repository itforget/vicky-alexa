import http from 'node:http';
import { RESOURCE_NAMES } from './commands.js';

const ALLOWED = new Set([
  'help', 'follow', 'stop', 'come', 'protect', 'find_diamonds', 'collect_resource',
  'build_house', 'status', 'time', 'weather', 'difficulty', 'teleport', 'whitelist'
]);
const CONFIRM_REQUIRED = new Set(['collect_resource', 'build_house', 'teleport', 'whitelist', 'difficulty', 'time', 'weather']);
const VALUES = {
  time: new Set(['day', 'night']),
  weather: new Set(['clear', 'rain', 'thunder']),
  difficulty: new Set(['peaceful', 'easy', 'normal', 'hard']),
  whitelist: new Set(['add', 'remove', 'on', 'off'])
};

export function authorizeRequest(header, apiKey) {
  return Boolean(apiKey) && typeof header === 'string' && header.startsWith('Bearer ') && header.slice(7) === apiKey;
}

export function requiresConfirmation(command = {}) {
  return CONFIRM_REQUIRED.has(command.type);
}

export function isAllowedControlCommand(command = {}) {
  if (!command || typeof command !== 'object' || !ALLOWED.has(command.type)) return false;
  if (command.type === 'follow') return typeof command.target === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(command.target);
  if (command.type === 'collect_resource') return typeof command.resource === 'string' && RESOURCE_NAMES.has(command.resource);
  if (command.type === 'time' || command.type === 'weather' || command.type === 'difficulty') return VALUES[command.type].has(command.value);
  if (command.type === 'teleport') return typeof command.player === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(command.player) && [command.x, command.y, command.z].every(Number.isFinite);
  if (command.type === 'whitelist') return VALUES.whitelist.has(command.action) && typeof command.player === 'string' && /^[A-Za-z0-9_]{1,16}$/.test(command.player);
  return true;
}

async function readJson(request) {
  const limit = 16_384;
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.byteLength;
    if (size > limit) throw new Error('payload too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function createControlServer({ apiKey = process.env.CONTROL_API_KEY, executeCommand, getStatus, planner, getGameState } = {}) {
  if (typeof executeCommand !== 'function') throw new TypeError('executeCommand is required');
  return http.createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json; charset=utf-8');
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200); response.end(JSON.stringify({ ok: true, status: getStatus?.() ?? 'online' })); return;
    }
    if (request.method !== 'POST' || !['/command', '/plan'].includes(request.url)) {
      response.writeHead(404); response.end(JSON.stringify({ error: 'not_found' })); return;
    }
    if (!authorizeRequest(request.headers.authorization, apiKey)) {
      response.writeHead(401); response.end(JSON.stringify({ error: 'unauthorized' })); return;
    }
    let body;
    try { body = await readJson(request); } catch { response.writeHead(400); response.end(JSON.stringify({ error: 'invalid_json' })); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { response.writeHead(400); response.end(JSON.stringify({ error: 'invalid_json' })); return; }
    if (request.url === '/plan') {
      if (!planner || typeof planner.plan !== 'function') { response.writeHead(503); response.end(JSON.stringify({ error: 'planner_not_configured' })); return; }
      const result = await planner.plan({ owner: body.owner, request: body.request, gameState: getGameState?.() ?? getStatus?.() ?? {} });
      response.writeHead(result?.error === 'rate_limited' || result?.error === 'queue_full' ? 429 : result?.ok === false ? 502 : 200);
      response.end(JSON.stringify(result)); return;
    }
    const command = body;
    if (!isAllowedControlCommand(command)) {
      response.writeHead(403); response.end(JSON.stringify({ error: 'command_not_allowed' })); return;
    }
    if (requiresConfirmation(command) && command.confirm !== true) {
      response.writeHead(409); response.end(JSON.stringify({ error: 'confirmation_required' })); return;
    }
    try {
      const result = await executeCommand(command);
      response.writeHead(200); response.end(JSON.stringify(result ?? { ok: true }));
    } catch (error) {
      response.writeHead(400); response.end(JSON.stringify({ error: error.message || 'command_failed' }));
    }
  });
}

export { ALLOWED };
