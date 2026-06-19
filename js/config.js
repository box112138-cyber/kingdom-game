// === Map dimensions ===
export const MC = 50, MR = 50, CS = 50;

// === Terrain action cooldowns (in ticks, 1 tick = 100ms) ===
export const CD_WATER = 60, CD_TREE = 20, CD_MOUNT = 20;

// === Building placement order ===
export const STARTER = ['castle', 'farm', 'mine'];

// === Building definitions ===
export const B = {
  castle: {
    id: 'castle', name: '城堡', icon: '🏰', image: 'assets/images/城堡.png', desc: '核心',
    size: 1, baseCost: { gold: 0 }, costScale: 1.6, maxL: 10,
    effects(l) { return { mp: l * 5 }; },
    prod(l) { return {}; }
  },
  farm: {
    id: 'farm', name: '农场', icon: '🌾', desc: '粮食',
    size: 1, baseCost: { gold: 30, wood: 10 }, costScale: 1.45, maxL: 30,
    effects(l) { return { fps: l * 0.8 }; },
    prod(l) { if (l === 0) return {}; return { food: l * 0.8 }; }
  },
  mine: {
    id: 'mine', name: '金矿', icon: '⛏️', desc: '金币',
    size: 1, baseCost: { gold: 40, wood: 15 }, costScale: 1.5, maxL: 30,
    effects(l) { return { gps: l * 1.2 }; },
    prod(l) { if (l === 0) return {}; return { gold: l * 1.2 }; }
  },
  goldStorage: {
    id: 'goldStorage', name: '金库', icon: '💰', desc: '金币上限',
    size: 1, baseCost: { gold: 60, stone: 20 }, costScale: 1.4, maxL: 20,
    effects(l) { return { gsb: l * 1200 }; },
    prod(l) { return {}; }
  },
  granary: {
    id: 'granary', name: '粮仓', icon: '🫙', desc: '粮食上限',
    size: 1, baseCost: { gold: 50, wood: 20 }, costScale: 1.4, maxL: 20,
    effects(l) { return { fsb: l * 1200 }; },
    prod(l) { return {}; }
  },
  barracks: {
    id: 'barracks', name: '兵营', icon: '⚔️', desc: '士兵',
    size: 1, baseCost: { gold: 100, food: 50 }, costScale: 1.55, maxL: 20,
    requires: { castle: 2 },
    effects(l) { return { pb: l * 3, soldierLv: l }; },
    prod(l) { return {}; }
  },
  market: {
    id: 'market', name: '市场', icon: '🏪', desc: '加成',
    size: 1, baseCost: { gold: 150, wood: 40, stone: 30 }, costScale: 1.65, maxL: 15,
    requires: { castle: 3 },
    effects(l) { return { gm: 1 + l * 0.08 }; },
    prod(l) { return {}; }
  },
  temple: {
    id: 'temple', name: '神殿', icon: '⛩️', desc: '祭坛',
    size: 1, baseCost: { gold: 200, gems: 10 }, costScale: 1.6, maxL: 15,
    requires: { castle: 3 },
    effects(l) { return {}; },
    prod(l) { if (l === 0) return {}; return { gems: l * 0.5 }; }
  },
  heroThrone: {
    id: 'heroThrone', name: '王座', icon: '👑', image: 'assets/images/秦梧.png', desc: '英雄',
    size: 1, baseCost: { gold: 250, gems: 20 }, costScale: 1.6, maxL: 15,
    requires: { castle: 3 },
    effects(l) { return { heroCap: Math.min(3 + l, 15) }; },
    prod(l) { return {}; }
  },
  tavern: {
    id: 'tavern', name: '酒馆', icon: '🍺', desc: '招募',
    size: 1, baseCost: { gold: 180, food: 80, wood: 40 }, costScale: 1.55, maxL: 12,
    requires: { castle: 3, barracks: 1 },
    effects(l) { return { mp: l * 2, trainSpeed: Math.min(l * 0.05, 0.45) }; },
    prod(l) { if (l === 0) return {}; return { soldiers: l * 0.08 }; }
  },
  builderHut: {
    id: 'builderHut', name: '工坊', icon: '🔨', desc: '工人+1',
    size: 1, baseCost: { gold: 100, wood: 30, stone: 20 }, costScale: 1.5, maxL: 5,
    requires: { castle: 2 },
    effects(l) { return { builders: 1 }; },
    prod(l) { return {}; }
  },
  quarry: {
    id: 'quarry', name: '采石场', icon: '⛰️', desc: '石料',
    size: 1, baseCost: { gold: 40, wood: 10 }, costScale: 1.45, maxL: 30,
    effects(l) { return { stps: l * 0.6 }; },
    prod(l) { if (l === 0) return {}; return { stone: l * 0.6 }; }
  },
  stoneStorage: {
    id: 'stoneStorage', name: '石库', icon: '🪨', desc: '石料上限',
    size: 1, baseCost: { gold: 50, wood: 15 }, costScale: 1.4, maxL: 20,
    effects(l) { return { ssb: l * 1000 }; },
    prod(l) { return {}; }
  },
  workshop: {
    id: 'workshop', name: '作坊', icon: '⚙️', desc: '折扣',
    size: 1, baseCost: { gold: 300, stone: 50, gems: 10 }, costScale: 1.8, maxL: 10,
    requires: { castle: 5 },
    effects(l) { return { cr: Math.min(l * 0.05, 0.4) }; },
    prod(l) { return {}; }
  },
  alchemyLab: {
    id: 'alchemyLab', name: '炼金工坊', icon: '⚗️', desc: '宝石与英雄',
    size: 1, baseCost: { gold: 420, stone: 80, gems: 20 }, costScale: 1.7, maxL: 10,
    requires: { castle: 5, temple: 2 },
    effects(l) { return { heroAtk: l * 2, heroDef: Math.floor(l * 1.2) }; },
    prod(l) { if (l === 0) return {}; return { gems: l * 0.35 }; }
  },
  watchtower: {
    id: 'watchtower', name: '瞭望塔', icon: '🗼', desc: '预警',
    size: 1, baseCost: { gold: 120, wood: 30, stone: 20 }, costScale: 1.55, maxL: 10,
    requires: { castle: 4, barracks: 2 },
    effects(l) { return { waveAlert: l * 100 }; },
    prod(l) { return {}; }
  },
  hospital: {
    id: 'hospital', name: '医院', icon: '🏥', desc: '救治',
    size: 1, baseCost: { gold: 150, wood: 40, stone: 30 }, costScale: 1.5, maxL: 10,
    requires: { castle: 4 },
    effects(l) { return { soldierSave: Math.min(l * 0.06, 0.5) }; },
    prod(l) { return {}; }
  },
  library: {
    id: 'library', name: '图书馆', icon: '📚', desc: '研究加速',
    size: 1, baseCost: { gold: 180, wood: 50, stone: 30 }, costScale: 1.6, maxL: 10,
    requires: { castle: 5 },
    effects(l) { return { buildSpeed: Math.min(l * 0.1, 0.5) }; },
    prod(l) { return {}; }
  },
  arrowTower: {
    id: 'arrowTower', name: '箭塔', icon: '🏹', desc: '防御',
    size: 1, baseCost: { gold: 200, wood: 40, stone: 50 }, costScale: 1.6, maxL: 10,
    requires: { castle: 5, barracks: 3 },
    effects(l) { return { towerAtk: l * 8 }; },
    prod(l) { return {}; }
  },
  beastPen: {
    id: 'beastPen', name: '兽栏', icon: '🐴', desc: '骑兵战力',
    size: 1, baseCost: { gold: 320, food: 160, wood: 80 }, costScale: 1.6, maxL: 10,
    requires: { castle: 4, barracks: 2 },
    effects(l) { return { cavalryPower: l * 7, soldierPower: 1 + l * 0.05 }; },
    prod(l) { return {}; }
  },
  port: {
    id: 'port', name: '港口', icon: '⚓', desc: '水上通行',
    size: 1, baseCost: { gold: 250, wood: 60, stone: 40 }, costScale: 1.55, maxL: 8,
    requires: { castle: 5, market: 2 },
    effects(l) { return { fishBonus: l * 0.3, waterWalk: l * 2 }; },
    prod(l) { return {}; }
  },
  bridge: {
    id: 'bridge', name: '桥梁', icon: '🌉', desc: '跨水域',
    size: 1, baseCost: { gold: 100, wood: 40, stone: 30 }, costScale: 1.45, maxL: 1,
    requires: { castle: 3 },
    effects(l) { return {}; },
    prod(l) { return {}; }
  },
  statue: {
    id: 'statue', name: '雕像', icon: '🗽', desc: '装饰',
    size: 1, baseCost: { gold: 100, stone: 30 }, costScale: 1.3, maxL: 5,
    effects(l) { return { mp: l * 5, beauty: l * 2 }; },
    prod(l) { return {}; }
  },
  garden: {
    id: 'garden', name: '花园', icon: '🌻', desc: '装饰',
    size: 1, baseCost: { gold: 80, wood: 20 }, costScale: 1.3, maxL: 5,
    effects(l) { return { mp: l * 3, beauty: l * 3 }; },
    prod(l) { return {}; }
  },
  fountain: {
    id: 'fountain', name: '喷泉', icon: '⛲', desc: '装饰',
    size: 1, baseCost: { gold: 150, stone: 40, gems: 5 }, costScale: 1.4, maxL: 5,
    effects(l) { return { mp: l * 5, beauty: l * 4 }; },
    prod(l) { if (l === 0) return {}; return { gems: l * 0.2 }; }
  },
  lumberMill: {
    id: 'lumberMill', name: '伐木场', icon: '🪓', desc: '木材',
    size: 1, baseCost: { gold: 50, wood: 20 }, costScale: 1.5, maxL: 20,
    requires: { castle: 2 },
    effects(l) { return { woodBonus: l * 0.5 }; },
    prod(l) { if (l === 0) return {}; return { wood: l * 0.5 }; }
  },
  ruin: {
    id: 'ruin', name: '废墟', icon: '🏚️', desc: '探索',
    size: 1, baseCost: { gold: 99999 }, costScale: 1, maxL: 1,
    effects(l) { return {}; },
    prod(l) { return {}; }
  }
};

export const SHOP_BUILDINGS = [
  'farm', 'mine', 'quarry', 'lumberMill', 'goldStorage', 'granary', 'stoneStorage',
  'barracks', 'tavern', 'builderHut', 'bridge', 'statue', 'garden', 'fountain',
  'market', 'temple', 'heroThrone', 'watchtower', 'hospital', 'beastPen',
  'port', 'library', 'arrowTower', 'workshop', 'alchemyLab'
];

// === Monster Types ===
export const MONSTERS = {
  wolf:   { name: '狼', icon: '🐺', hp: 20, atk: 5, def: 2, terrain: 'tree', reward: { gold: 30, food: 15 }, minDist: 5 },
  serpent:{ name: '水蛇', icon: '🐍', hp: 35, atk: 8, def: 3, terrain: 'water', reward: { gold: 50, food: 20 }, minDist: 8 },
  golem:  { name: '石魔', icon: '🗿', hp: 50, atk: 12, def: 5, terrain: 'mountain', reward: { gold: 80, stone: 25 }, minDist: 10 },
  bandit: { name: '强盗', icon: '🦹', hp: 30, atk: 7, def: 3, terrain: 'grass', reward: { gold: 60, gems: 3 }, minDist: 12 },
  dragon: { name: '龙', icon: '🐉', hp: 150, atk: 25, def: 10, terrain: 'mountain', reward: { gold: 500, gems: 30 }, minDist: 20, boss: true },
  titan:  { name: '巨魔', icon: '👹', hp: 200, atk: 30, def: 12, terrain: 'grass', reward: { gold: 600, gems: 40 }, minDist: 25, boss: true },
  wraith: { name: '幽灵王', icon: '👻', hp: 120, atk: 20, def: 8, terrain: 'water', reward: { gold: 400, gems: 25 }, minDist: 22, boss: true }
};

// === Interior dungeon definitions ===
export function createInteriors() {
  const ruinItems = () => {
    const pool = [
      { e: '💰', reward: { gold: 100 } }, { e: '💎', reward: { gems: 8 } },
      { e: '⚔️', reward: { soldiers: 5 } }, { e: '📦', reward: { gold: 60, wood: 20 } },
      { e: '🔮', reward: { gems: 12 } }, { e: '🪙', reward: { gold: 40, stone: 15 } },
      { e: '🗡️', reward: { soldiers: 3 } }, { e: '💠', reward: { gems: 5, gold: 30 } }
    ];
    const items = [];
    for (let i = 0; i < 5; i++) {
      const p = pool[Math.floor(Math.random() * pool.length)];
      let r, c;
      do { r = 1 + Math.floor(Math.random() * 4); c = 1 + Math.floor(Math.random() * 4); }
      while (items.some(it => it.r === r && it.c === c) || (r === 2 && c === 2));
      items.push({ r, c, ...p });
    }
    // Add a trap
    let tr, tc;
    do { tr = 1 + Math.floor(Math.random() * 4); tc = 1 + Math.floor(Math.random() * 4); }
    while (items.some(it => it.r === tr && it.c === tc));
    items.push({ r: tr, c: tc, e: '💀', trap: true, damage: 15 });
    return items;
  };

  return {
    castle: {
      name: '城堡内部',
      walls: (() => {
        const w = [];
        for (let i = 0; i < 7; i++) {
          w.push([0, i]); w.push([6, i]);
          w.push([i, 0]); w.push([i, 6]);
        }
        w.splice(w.findIndex(p => p[0] === 6 && p[1] === 3), 1);
        return w;
      })(),
      door: [6, 3],
      start: [5, 3],
      items: [
        { r: 1, c: 3, e: '👑', reward: { gold: 200, gems: 50 }, minLevel: 1 },
        { r: 2, c: 2, e: '🗡️', reward: { soldiers: 3 }, minLevel: 1 },
        { r: 2, c: 4, e: '🛡️', reward: { gold: 80 }, minLevel: 1 },
        { r: 3, c: 1, e: '📜', reward: { gold: 120 }, minLevel: 1 },
        { r: 3, c: 3, e: '🏆', reward: { gold: 300, gems: 20 }, minLevel: 1 },
        { r: 3, c: 5, e: '🔮', reward: { gems: 30 }, minLevel: 1 },
        { r: 4, c: 2, e: '💰', reward: { gold: 150 }, minLevel: 3 },
        { r: 4, c: 4, e: '🕯️', reward: { gold: 60 }, minLevel: 3 },
        { r: 1, c: 1, e: '⚜️', reward: { gold: 350, gems: 40 }, minLevel: 5 },
        { r: 1, c: 5, e: '💠', reward: { gems: 60 }, minLevel: 5 },
        { r: 5, c: 2, e: '🗝️', reward: { gold: 500, gems: 100 }, minLevel: 7 },
        { r: 5, c: 4, e: '🎖️', reward: { soldiers: 10, gold: 200 }, minLevel: 7 }
      ]
    },
    ruin: {
      name: '废墟',
      walls: (() => {
        const w = [];
        for (let i = 0; i < 5; i++) { w.push([0, i]); w.push([4, i]); w.push([i, 0]); w.push([i, 4]); }
        w.splice(w.findIndex(p => p[0] === 4 && p[1] === 2), 1);
        return w;
      })(),
      door: [4, 2],
      start: [3, 2],
      items: ruinItems()
    }
  };
}
