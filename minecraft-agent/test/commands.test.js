import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChatCommand, isHostileMob, hasRequiredMaterials } from '../src/commands.js';

test('parses Portuguese follow, stop, come and status commands', () => {
  assert.deepEqual(parseChatCommand('Vicky siga Steve'), { type: 'follow', target: 'Steve' });
  assert.deepEqual(parseChatCommand('vicky pare'), { type: 'stop' });
  assert.deepEqual(parseChatCommand('Vicky venha'), { type: 'come' });
  assert.deepEqual(parseChatCommand('vicky status'), { type: 'status' });
});

test('parses protect and visible diamond search without promising xray', () => {
  assert.deepEqual(parseChatCommand('Vicky proteja'), { type: 'protect' });
  assert.deepEqual(parseChatCommand('Vicky encontre diamantes'), { type: 'find_diamonds', visibleOnly: true });
});

test('marks resource collection and house building as explicitly authorized jobs', () => {
  assert.deepEqual(parseChatCommand('Vicky colete ferro'), {
    type: 'collect_resource', resource: 'ferro', requiresConfirmation: true
  });
  assert.deepEqual(parseChatCommand('Vicky construa uma casa pequena'), {
    type: 'build_house', requiresConfirmation: true
  });
  assert.equal(parseChatCommand('Vicky colete ferro').requiresConfirmation, true);
});

test('does not treat arbitrary or administrative chat text as a command', () => {
  assert.equal(parseChatCommand('Vicky op Steve'), null);
  assert.equal(parseChatCommand('hello'), null);
});

test('hostile classifier excludes players and passive mobs', () => {
  assert.equal(isHostileMob({ type: 'mob', name: 'zombie' }), true);
  assert.equal(isHostileMob({ type: 'mob', name: 'creeper' }), true);
  assert.equal(isHostileMob({ type: 'player', name: 'Steve' }), false);
  assert.equal(isHostileMob({ type: 'mob', name: 'cow' }), false);
});

test('house material check is strict and does not authorize gathering', () => {
  assert.equal(hasRequiredMaterials({ oak_planks: 20, glass: 8 }), true);
  assert.equal(hasRequiredMaterials({ oak_planks: 19, glass: 8 }), false);
  assert.equal(hasRequiredMaterials({ oak_planks: 20 }), false);
});
