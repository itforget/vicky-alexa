import test from 'node:test';
import assert from 'node:assert/strict';
import { createControlServer } from '../src/control-api.js';

test('HTTP control API authenticates, allowlists and confirms commands', async (t) => {
  const calls = [];
  const server = createControlServer({
    apiKey: 'secret',
    executeCommand: async (command) => { calls.push(command); return { ok: true, command }; }
  });
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => server.close());
  const port = server.address().port;

  let response = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'status' })
  });
  assert.equal(response.status, 401);

  response = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'command', value: 'op Steve' })
  });
  assert.equal(response.status, 403);

  response = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'build_house' })
  });
  assert.equal(response.status, 409);
  assert.equal(calls.length, 0);

  response = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'build_house', confirm: true })
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
});

test('HTTP control API rejects a payload as soon as streamed bytes exceed the limit', async (t) => {
  const server = createControlServer({ apiKey: 'secret', executeCommand: async () => ({ ok: true }) });
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => server.close());
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/command`, {
    method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'status', padding: 'x'.repeat(17_000) })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_json' });
});

