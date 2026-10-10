const HOSTILE_MOBS = new Set([
  'blaze', 'cave_spider', 'creeper', 'drowned', 'elder_guardian', 'ender_dragon',
  'enderman', 'endermite', 'evoker', 'ghast', 'guardian', 'hoglin', 'husk',
  'magma_cube', 'phantom', 'piglin_brute', 'pillager', 'ravager', 'shulker',
  'silverfish', 'skeleton', 'slime', 'spider', 'stray', 'vex', 'vindicator',
  'warden', 'witch', 'wither', 'wither_skeleton', 'zoglin', 'zombie',
  'zombie_villager', 'zombified_piglin'
]);

const RESOURCE_NAMES = new Set(['ferro', 'iron', 'carvao', 'coal', 'cobre', 'copper', 'ouro', 'gold', 'madeira', 'wood', 'pedra', 'stone']);

export function parseChatCommand(message, botName = 'vicky') {
  const words = String(message ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || words[0].toLowerCase() !== botName.toLowerCase()) return null;
  const rawCommand = words.slice(1).join(' ');
  const command = rawCommand.toLowerCase();
  if (!command || command === 'ajuda' || command === 'help') return { type: 'help' };
  if (/^(siga|segue)(?:\s+(.+))?$/.test(command)) {
    const [, target] = rawCommand.match(/^(?:siga|segue)(?:\s+(.+))?$/i) ?? [];
    return { type: 'follow', target: target || undefined };
  }
  if (/^(pare|parar|stop)$/.test(command)) return { type: 'stop' };
  if (/^(venha|vem|come)$/.test(command)) return { type: 'come' };
  if (/^status$/.test(command)) return { type: 'status' };
  if (/^(proteja|proteger|proteção|protecao|protect)$/.test(command)) return { type: 'protect' };
  if (/^(?:encontre|procure|ache) diamantes?$/.test(command)) return { type: 'find_diamonds', visibleOnly: true };
  const collect = command.match(/^(?:colete|coletar|collect)\s+(.+)$/);
  if (collect && RESOURCE_NAMES.has(collect[1])) return { type: 'collect_resource', resource: collect[1], requiresConfirmation: true };
  if (/^(?:construa|construir|build)(?: uma)? casa(?: pequena)?$/.test(command)) return { type: 'build_house', requiresConfirmation: true };
  return null;
}

export function isHostileMob(entity) {
  return entity?.type === 'mob' && HOSTILE_MOBS.has(String(entity.name ?? '').toLowerCase());
}

export function hasRequiredMaterials(counts = {}) {
  return Number(counts.oak_planks ?? 0) >= 20 && Number(counts.glass ?? 0) >= 8;
}

export { HOSTILE_MOBS, RESOURCE_NAMES };
