import { B, createInteriors } from './config.js';

// ========== Central Mutable State ==========
// All game state lives on this single object so modules can freely mutate it.
// Modules that import `state` can set `state.firstHarvest = false` etc.

export const state = {
  // Game data
  mapData: [],
  bPos: {},
  gs: null,
  cooldowns: {},
  firstHarvest: true,

  // UI interaction
  selectedCell: null,
  moveMode: false,
  movingBid: null,
  buyQty: 1,
  fcBid: null,
  pendingBid: null,
  cdTimer: null,

  // Camera / viewport
  viewZoom: 1.5,
  viewPanX: 0,
  viewPanY: 0,

  // Player
  player: { r: 0, c: 0 },

  // Mouse drag
  isDrag: false,
  dsX: 0, dsY: 0, dpX: 0, dpY: 0, dMoved: false,
  fcDrag: false, fcOffX: 0, fcOffY: 0,

  // Interior
  interiorBid: null,
  intPlayer: null,

  // Map render cache
  altCache: new Map(),

  // Workers
  workers: [],
  _workerIdCounter: 0,

  // Multiplayer
  online: {
    connected: false,
    room: '',
    playerId: '',
    name: '',
    role: 'offline',
    peers: new Map()
  }
};

export const MIN_Z = 0.08;
export const MAX_Z = 7.0;

// Interiors config (derived, immutable)
export const INTERIORS = createInteriors();

// ========== State Management ==========

export function createState() {
  return {
    resources: { gold: 500, food: 300, soldiers: 0, wood: 50, stone: 30, gems: 0 },
    buildings: {},
    tickCount: 0,
    logs: [],
    claimedCells: {},
    bPositions: {},
    trainQueue: { count: 0, total: 0, ticks: 0, level: 1 },
    heroes: { barbarianKing: { level: 1, equipment: { weapon: null, armor: null, ring: null } } },
    walls: 0,
    upgradeQueue: [],
    collectedItems: [],
    treasures: [],
    monsters: [],
    bestiary: [],
    ruins: [],
    prestige: 0,
    achievements: { trees: 0, stone: 0, fish: 0, kills: 0, buildings: 0, unlocked: [] }
  };
}

export function initBuildings(s) {
  for (const id of ['castle', 'farm', 'mine']) {
    if (s.buildings[id] == null) s.buildings[id] = 1;
  }
}

export function initState() {
  state.gs = createState();
  initBuildings(state.gs);
}

export function isClaimed(r, c) {
  return state.gs.claimedCells[r + ',' + c] === true;
}

export function addLog(msg) {
  const n = new Date();
  const t = ('0' + n.getHours()).slice(-2) + ':' +
            ('0' + n.getMinutes()).slice(-2) + ':' +
            ('0' + n.getSeconds()).slice(-2);
  state.gs.logs.push({ time: t, msg: msg });
  if (state.gs.logs.length > 50) state.gs.logs.shift();
}

export function saveGame() {
  try {
    const d = {
      resources: { ...state.gs.resources },
      buildings: { ...state.gs.buildings },
      tickCount: state.gs.tickCount,
      claimedCells: { ...state.gs.claimedCells },
      bPositions: { ...state.bPos },
      trainQueue: { ...state.gs.trainQueue },
      heroes: { ...state.gs.heroes },
      walls: state.gs.walls,
      cooldowns: { ...state.cooldowns },
      player: { r: state.player.r, c: state.player.c },
      firstHarvest: state.firstHarvest,
      logs: state.gs.logs.slice(-30),
      collectedItems: [...state.gs.collectedItems],
      inventory: state.gs.inventory ? { ...state.gs.inventory } : {},
      upgradeQueue: state.gs.upgradeQueue ? state.gs.upgradeQueue.map(q => ({ ...q })) : [],
      treasures: state.gs.treasures ? [...state.gs.treasures] : [],
      monsters: state.gs.monsters ? state.gs.monsters.map(m => ({ ...m })) : [],
      bestiary: state.gs.bestiary ? [...state.gs.bestiary] : [],
      achievements: state.gs.achievements ? { ...state.gs.achievements, unlocked: [...(state.gs.achievements.unlocked || [])] } : { unlocked: [] },
      ruins: state.gs.ruins ? [...state.gs.ruins] : [],
      prestige: state.gs.prestige || 0
    };
    localStorage.setItem('kingdom_v13', JSON.stringify(d));
  } catch (e) { /* ignore */ }
}
