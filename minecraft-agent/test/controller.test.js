import test from 'node:test';
import assert from 'node:assert/strict';
import { BotController } from '../src/controller.js';

test('resource collection only digs after explicit controller invocation', async () => {
  let digs = 0;
  const bot = {
    findBlock: ({ matching }) => matching({ name: 'iron_ore', position: { x: 1, y: 2, z: 3 } }) ? { name: 'iron_ore', position: { x: 1, y: 2, z: 3 } } : null,
    canSeeBlock: () => true,
    blockAt: () => null,
    pathfinder: { setGoal() {}, goto: async () => {} },
    dig: async () => { digs += 1; }
  };
  const controller = new BotController({ bot, goals: { GoalNear: class {} } });
  assert.equal(digs, 0);
  await controller.execute({ type: 'collect_resource', resource: 'ferro' });
  assert.equal(digs, 1);
});

test('house build refuses missing materials and never gathers them implicitly', async () => {
  let dug = 0;
  const bot = { inventory: { items: () => [] }, dig: async () => { dug += 1; } };
  const controller = new BotController({ bot, goals: {} });
  await assert.rejects(() => controller.execute({ type: 'build_house' }), /Materiais insuficientes/);
  assert.equal(dug, 0);
});

test('diamond search reports unavailable instead of using xray', () => {
  const bot = { findBlock: () => null, pathfinder: { setGoal() {} } };
  const controller = new BotController({ bot, goals: {} });
  assert.deepEqual(controller.findDiamonds(), { ok: false, available: false, message: 'Não vejo minério de diamante acessível; não uso raio-X.' });
});

test('protection attacks only one nearby hostile spawn and ignores distant threats', () => {
  const attacked = [];
  const bot = { entity: { position: { x: 0, y: 0, z: 0 } }, attack: entity => attacked.push(entity) };
  const controller = new BotController({ bot, goals: {} });
  controller.protect();
  const zombie = { type: 'mob', name: 'zombie', position: { x: 1, y: 0, z: 0 } };
  controller.onEntitySpawn(zombie);
  controller.onEntitySpawn(zombie);
  controller.onEntitySpawn({ type: 'mob', name: 'skeleton', position: { x: 4, y: 0, z: 0 } });
  controller.stop();
  assert.deepEqual(attacked, [zombie]);
});

test('diamond search requires line of sight and an exposed face', () => {
  const block = { name: 'diamond_ore', position: { x: 1, y: 2, z: 3 } };
  const bot = {
    findBlock: ({ matching }) => matching(block) ? block : null,
    canSeeBlock: () => true,
    blockAt: () => ({ name: 'stone', boundingBox: 'block' }),
    pathfinder: { setGoal() {} }
  };
  const controller = new BotController({ bot, goals: { GoalNear: class {} } });
  assert.equal(controller.findDiamonds().available, false);
});

test('house plan has unique positions, roof and a clear doorway', () => {
  const position = { x: 0, y: 64, z: 0, offset(x, y, z) { return { x: this.x + x, y: this.y + y, z: this.z + z }; } };
  const controller = new BotController({ bot: {}, goals: {} });
  const plan = controller.housePlan(position);
  const keys = plan.map(target => `${target.pos.x},${target.pos.y},${target.pos.z}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(plan.filter(target => target.kind === 'oak_planks').length, 20);
  assert.equal(plan.filter(target => target.kind === 'glass').length, 8);
  assert.equal(plan.some(target => target.pos.x === 1 && target.pos.y === 1 && target.pos.z === 0), false);
  assert.equal(plan.filter(target => target.pos.y === 67).length, 9);
});
