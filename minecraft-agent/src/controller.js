import { isHostileMob, hasRequiredMaterials } from './commands.js';

const RESOURCE_BLOCKS = {
  ferro: ['iron_ore', 'deepslate_iron_ore'], iron: ['iron_ore', 'deepslate_iron_ore'],
  carvao: ['coal_ore', 'deepslate_coal_ore'], coal: ['coal_ore', 'deepslate_coal_ore'],
  cobre: ['copper_ore', 'deepslate_copper_ore'], copper: ['copper_ore', 'deepslate_copper_ore'],
  ouro: ['gold_ore', 'deepslate_gold_ore'], gold: ['gold_ore', 'deepslate_gold_ore'],
  madeira: ['oak_log', 'birch_log', 'spruce_log'], wood: ['oak_log', 'birch_log', 'spruce_log'],
  pedra: ['stone'], stone: ['stone']
};

const TOOL_NAMES = {
  pickaxe: /(?:wooden|stone|iron|golden|diamond|netherite)_pickaxe$/,
  axe: /(?:wooden|stone|iron|golden|diamond|netherite)_axe$/
};
const DROP_NAMES = {
  iron_ore: ['raw_iron', 'iron_ore'], deepslate_iron_ore: ['raw_iron', 'iron_ore'],
  coal_ore: ['coal'], deepslate_coal_ore: ['coal'], copper_ore: ['raw_copper', 'copper_ore'],
  deepslate_copper_ore: ['raw_copper', 'copper_ore'], gold_ore: ['raw_gold', 'gold_ore'],
  deepslate_gold_ore: ['raw_gold', 'gold_ore'], oak_log: ['oak_log'], birch_log: ['birch_log'],
  spruce_log: ['spruce_log'], stone: ['cobblestone', 'stone']
};
const OFFSETS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const AIR_NAMES = new Set(['air', 'cave_air', 'void_air']);

function positionDistance(a, b) {
  if (a?.distanceTo) return a.distanceTo(b);
  if (!a || !b) return Infinity;
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0), (a.z ?? 0) - (b.z ?? 0));
}
function offsetPosition(position, dx, dy, dz) {
  if (typeof position?.offset === 'function') return position.offset(dx, dy, dz);
  return { x: position.x + dx, y: position.y + dy, z: position.z + dz };
}
function differencePosition(a, b) {
  if (typeof a?.minus === 'function') return a.minus(b);
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function inventorySnapshot(bot) {
  const result = {};
  for (const item of bot?.inventory?.items?.() ?? []) result[item.name] = (result[item.name] ?? 0) + Number(item.count ?? 0);
  return result;
}
function inventoryDelta(before, after, names) { return names.some(name => (after[name] ?? 0) > (before[name] ?? 0)); }
function isReplaceable(block) {
  return !block || AIR_NAMES.has(block.name) || block.replaceable === true || block.boundingBox === 'empty';
}

export class BotController {
  constructor({ bot, goals, say = () => {}, host = 'server', port = 25565 } = {}) {
    this.bot = bot; this.goals = goals; this.say = say; this.host = host; this.port = port;
    this.followTarget = undefined; this.protecting = false; this.lastAction = 'idle';
    this.protectionTimer = undefined; this.attackedEntities = new Set();
  }

  status() { return { ok: true, online: Boolean(this.bot?.player), following: this.followTarget ?? null, protecting: this.protecting, action: this.lastAction, endpoint: `${this.host}:${this.port}` }; }

  follow(target) {
    const entity = this.bot?.players?.[target]?.entity;
    if (!entity) throw new Error(`Não encontrei ${target}.`);
    this.followTarget = target; this.bot.pathfinder.setGoal(new this.goals.GoalFollow(entity, 2), true);
    this.lastAction = `following:${target}`; return { ok: true, message: `Vou seguir ${target}.` };
  }

  stop() {
    this.followTarget = undefined; this.protecting = false;
    if (this.protectionTimer) clearInterval(this.protectionTimer);
    this.protectionTimer = undefined; this.attackedEntities.clear();
    this.bot?.pathfinder?.setGoal(null); this.lastAction = 'idle'; return { ok: true, message: 'Parei.' };
  }

  come(sender) { return this.follow(sender); }

  protect() {
    this.protecting = true; this.lastAction = 'protecting';
    if (!this.protectionTimer) {
      this.protectionTimer = setInterval(() => this.scanForThreats(), 500);
      this.protectionTimer.unref?.();
    }
    this.scanForThreats();
    return { ok: true, message: 'Proteção contra mobs hostis ativada.' };
  }

  scanForThreats() {
    if (!this.protecting || !this.bot?.entity || typeof this.bot.attack !== 'function') return false;
    const entities = Object.values(this.bot.entities ?? {});
    const candidates = entities.filter(entity => isHostileMob(entity) && !this.attackedEntities.has(entity) && positionDistance(this.bot.entity.position, entity.position) <= 3.1);
    const target = candidates.sort((a, b) => positionDistance(this.bot.entity.position, a.position) - positionDistance(this.bot.entity.position, b.position))[0];
    if (!target) return false;
    this.attackedEntities.add(target);
    this.bot.attack(target);
    return true;
  }

  onEntitySpawn(entity) {
    if (this.bot?.entities && entity?.id != null) this.bot.entities[entity.id] = entity;
    if (!this.protecting || !isHostileMob(entity) || this.attackedEntities.has(entity) || !this.bot?.entity) return false;
    if (positionDistance(this.bot.entity.position, entity.position) > 3.1 || typeof this.bot.attack !== 'function') return false;
    this.attackedEntities.add(entity);
    this.bot.attack(entity);
    return true;
  }

  isVisibleBlock(block) {
    if (!block?.position || typeof this.bot?.canSeeBlock !== 'function' || !this.bot.canSeeBlock(block)) return false;
    return OFFSETS.some(([dx, dy, dz]) => isReplaceable(this.bot.blockAt?.(offsetPosition(block.position, dx, dy, dz))));
  }

  findDiamonds() {
    const block = this.bot?.findBlock?.({ matching: candidate => ['diamond_ore', 'deepslate_diamond_ore'].includes(candidate?.name) && this.isVisibleBlock(candidate), maxDistance: 32 });
    if (!block) return { ok: false, available: false, message: 'Não vejo minério de diamante acessível; não uso raio-X.' };
    this.bot.pathfinder.setGoal(new this.goals.GoalNear(block.position.x, block.position.y, block.position.z, 1));
    this.lastAction = 'finding_diamonds'; return { ok: true, available: true, message: 'Encontrei minério de diamante visível e estou indo até ele.' };
  }

  async gotoWithin(position, range = 2) {
    const goal = new this.goals.GoalNear(position.x, position.y, position.z, range);
    if (typeof this.bot?.pathfinder?.goto === 'function') await this.bot.pathfinder.goto(goal);
    else this.bot?.pathfinder?.setGoal?.(goal);
  }

  async equipToolFor(blockName) {
    const toolType = blockName.endsWith('_log') ? 'axe' : 'pickaxe';
    const item = (this.bot?.inventory?.items?.() ?? []).find(candidate => TOOL_NAMES[toolType].test(candidate.name) && candidate.count > 0);
    if (item && typeof this.bot.equip === 'function') await this.bot.equip(item, 'hand');
  }

  async collectResource(resource) {
    const names = RESOURCE_BLOCKS[resource];
    if (!names) throw new Error('Recurso não permitido.');
    const block = this.bot?.findBlock?.({ matching: candidate => names.includes(candidate?.name) && this.isVisibleBlock(candidate), maxDistance: 24 });
    if (!block) return { ok: false, available: false, message: `Não encontrei ${resource} visível por perto.` };
    if (typeof this.bot.dig !== 'function') return { ok: false, available: true, message: `Encontrei ${resource}, mas não consigo minerar agora.` };
    this.lastAction = `collecting:${resource}`;
    await this.gotoWithin(block.position, 3);
    await this.equipToolFor(block.name);
    const before = inventorySnapshot(this.bot);
    await this.bot.dig(block);
    const afterBlock = this.bot.blockAt?.(block.position);
    const completed = !afterBlock || !names.includes(afterBlock.name);
    const after = inventorySnapshot(this.bot);
    const pickedUp = inventoryDelta(before, after, DROP_NAMES[block.name] ?? [block.name]);
    if (!completed) return { ok: false, available: true, completed: false, pickedUp, message: `Não consegui minerar ${resource}.` };
    return { ok: true, available: true, completed: true, pickedUp, message: pickedUp ? `Coletei um bloco de ${resource}.` : `Minerei um bloco de ${resource}; o item ainda não foi confirmado no inventário.` };
  }

  inventoryCounts() { return inventorySnapshot(this.bot); }

  housePlan(origin) {
    const targets = [];
    // A solid floor and roof, glass perimeter, and two interior door-frame blocks.
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) targets.push({ kind: 'oak_planks', pos: origin.offset(x, 0, z) });
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) targets.push({ kind: 'oak_planks', pos: origin.offset(x, 3, z) });
    for (const [x, z] of [[0, 0], [2, 0], [0, 2], [2, 2], [1, 0], [1, 2], [0, 1], [2, 1]]) targets.push({ kind: 'glass', pos: origin.offset(x, 1, z) });
    targets.push({ kind: 'oak_planks', pos: origin.offset(1, 2, 1) }, { kind: 'oak_planks', pos: origin.offset(1, 2, 2) });
    return targets;
  }

  async buildHouse() {
    if (!hasRequiredMaterials(this.inventoryCounts())) throw new Error('Materiais insuficientes: preciso de 20 tábuas de carvalho e 8 vidros; não vou coletar sem autorização separada.');
    if (!this.bot?.entity || typeof this.bot.placeBlock !== 'function' || typeof this.bot.equip !== 'function') throw new Error('Construção indisponível antes do spawn.');
    const origin = this.bot.entity.position.floored().offset(1, 0, 1);
    const targets = this.housePlan(origin);
    for (const target of targets) {
      const existing = this.bot.blockAt?.(target.pos);
      if (!isReplaceable(existing)) throw new Error(`Construção abortada: posição ocupada em ${target.pos.x},${target.pos.y},${target.pos.z}.`);
    }
    let placed = 0;
    for (const target of targets) {
      await this.gotoWithin(target.pos, 3);
      const existing = this.bot.blockAt?.(target.pos);
      if (!isReplaceable(existing)) return { ok: false, placed, partial: true, message: `Construção interrompida após ${placed} blocos: posição ocupada.` };
      const item = (this.bot.inventory.items?.() ?? []).find(candidate => candidate.name === target.kind && candidate.count > 0);
      if (!item) return { ok: false, placed, partial: true, message: `Construção interrompida após ${placed} blocos: item ausente ${target.kind}.` };
      await this.bot.equip(item, 'hand');
      let reference;
      let face;
      for (const [dx, dy, dz] of OFFSETS) {
        const candidate = this.bot.blockAt?.(offsetPosition(target.pos, dx, dy, dz));
        if (candidate && !isReplaceable(candidate)) { reference = candidate; face = differencePosition(target.pos, reference.position); break; }
      }
      if (!reference) return { ok: false, placed, partial: true, message: `Construção interrompida após ${placed} blocos: sem referência alcançável.` };
      await this.bot.placeBlock(reference, face);
      placed += 1;
    }
    this.lastAction = 'house_built';
    return { ok: true, placed, partial: false, message: `Abrigo 3x3 construído com ${placed} blocos, porta e teto.` };
  }

  async execute(command) {
    switch (command.type) {
      case 'status': return this.status(); case 'follow': return this.follow(command.target); case 'stop': return this.stop();
      case 'come': return this.come(command.sender); case 'protect': return this.protect(); case 'find_diamonds': return this.findDiamonds();
      case 'collect_resource': return this.collectResource(command.resource); case 'build_house': return this.buildHouse();
      default: throw new Error('Comando não permitido pelo controlador.');
    }
  }
}

export { isReplaceable };
