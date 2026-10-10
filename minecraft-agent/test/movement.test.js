import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSafeMovements } from '../src/movement.js';

test('safe movement configuration disables digging and tower scaffolding', () => {
  const movements = { canDig: true, allow1by1towers: true, scaffoldingBlocks: ['dirt'] };
  configureSafeMovements(movements);
  assert.equal(movements.canDig, false);
  assert.equal(movements.allow1by1towers, false);
  assert.deepEqual(movements.scaffoldingBlocks, []);
});
