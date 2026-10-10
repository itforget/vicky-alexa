import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeRequest, isAllowedControlCommand, requiresConfirmation } from '../src/control-api.js';

test('requires exact bearer token and rejects missing or malformed auth', () => {
  assert.equal(authorizeRequest('Bearer secret', 'secret'), true);
  assert.equal(authorizeRequest('bearer secret', 'secret'), false);
  assert.equal(authorizeRequest(undefined, 'secret'), false);
  assert.equal(authorizeRequest('Bearer wrong', 'secret'), false);
});

test('control API has explicit allowlist and no arbitrary command passthrough', () => {
  assert.equal(isAllowedControlCommand({ type: 'status' }), true);
  assert.equal(isAllowedControlCommand({ type: 'follow', target: 'Steve' }), true);
  assert.equal(isAllowedControlCommand({ type: 'time', value: 'day' }), true);
  assert.equal(isAllowedControlCommand({ type: 'weather', value: 'clear' }), true);
  assert.equal(isAllowedControlCommand({ type: 'difficulty', value: 'normal' }), true);
  assert.equal(isAllowedControlCommand({ type: 'teleport', player: 'Steve', x: 1, y: 2, z: 3 }), true);
  assert.equal(isAllowedControlCommand({ type: 'whitelist', action: 'add', player: 'Steve' }), true);
  assert.equal(isAllowedControlCommand({ type: 'command', value: 'op Steve' }), false);
  assert.equal(isAllowedControlCommand({ type: 'time', value: 'give @a diamond' }), false);
});

test('destructive or privileged operations require confirmation', () => {
  assert.equal(requiresConfirmation({ type: 'collect_resource', resource: 'ferro' }), true);
  assert.equal(requiresConfirmation({ type: 'build_house' }), true);
  assert.equal(requiresConfirmation({ type: 'teleport', player: 'Steve', x: 1, y: 2, z: 3 }), true);
  assert.equal(requiresConfirmation({ type: 'status' }), false);
});
