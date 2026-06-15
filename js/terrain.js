import { B, CD_WATER, CD_TREE, CD_MOUNT } from './config.js';
import { state, addLog } from './state.js';
import { canPlace, clearCells, occupyCells } from './map.js';
import { trackTree, trackStone, trackFish } from './achievements.js';

// === Terrain Action Definitions ===

const ACTIONS = {
  tree: {
    name: '砍伐', rewards: { wood: 12 },
    onDone(cell) { cell.terrain = 'grass'; },
    cd: CD_TREE
  },
  water: {
    name: '钓鱼', rewards: { food: 18 },
    onDone() {},
    cd: CD_WATER
  },
  mountain: {
    name: '采矿', rewards: { stone: 10 },
    onDone(cell) { cell.terrain = 'grass'; },
    cd: CD_MOUNT
  }
};

// === Do Terrain Action (modifies state, returns result or null) ===

export function doTerrainAction(r, c) {
  const cell = state.mapData[r][c];
  const terrain = cell.terrain;
  const act = ACTIONS[terrain];
  if (!act) return null;

  const key = r + ',' + c;
  if (state.cooldowns[key] && state.cooldowns[key] > state.gs.tickCount) return null;

  let rt = '';
  const ic = { gold: 'G', food: 'F', wood: 'W', stone: 'S', gems: '💎' };

  // Port fishing bonus
  const portL = state.gs.buildings.port || 0;
  if (portL > 0 && cell.terrain === 'water') {
    const bonus = Math.floor(act.rewards.food * B.port.effects(portL).fishBonus);
    act.rewards = { ...act.rewards, food: act.rewards.food + bonus };
  }

  for (const [k, v] of Object.entries(act.rewards)) {
    state.gs.resources[k] = (state.gs.resources[k] || 0) + v;
    rt += v + ic[k] + ' ';
  }

  const gemAmt = state.firstHarvest
    ? 50
    : (Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 50) + 1);
  if (gemAmt > 0) {
    state.gs.resources.gems = (state.gs.resources.gems || 0) + gemAmt;
    rt += gemAmt + '💎';
  }
  state.firstHarvest = false;

  state.cooldowns[key] = state.gs.tickCount + act.cd;
  if (act.onDone) act.onDone(cell);

  addLog(act.name + ': ' + rt.trim());
  // Achievement tracking
  if (terrain === 'tree') trackTree();
  else if (terrain === 'water') trackFish();
  else if (terrain === 'mountain') trackStone();
  return { name: act.name, rewards: act.rewards, gemAmt, message: rt.trim() };
}

// === Building Move Mode ===

export function toggleMoveMode() {
  state.moveMode = !state.moveMode;
  state.movingBid = null;
  state.selectedCell = null;
}

export function isValidMoveTarget(r, c) {
  if (!state.movingBid) return true;
  return canPlace(r, c, B[state.movingBid].size || 1, state.movingBid);
}

export function tryMoveBuilding(r, c) {
  if (!state.moveMode) return false;

  if (state.movingBid) {
    const sz = B[state.movingBid].size || 1;
    if (isValidMoveTarget(r, c)) {
      const old = state.bPos[state.movingBid];
      if (old) clearCells(old.r, old.c, sz);
      occupyCells(r, c, sz, state.movingBid);
      state.bPos[state.movingBid] = { r, c };
      state.gs.bPositions = { ...state.bPos };
      addLog('移动了' + B[state.movingBid].name);
    }
    state.movingBid = null;
    state.selectedCell = null;
    return true;
  } else {
    const cell = state.mapData[r][c];
    if (cell.buildingId && cell.buildingId !== '__occ__') {
      state.movingBid = cell.buildingId;
      state.selectedCell = { r, c };
      return true;
    }
  }
  return false;
}

// === Cooldown Helper ===

export function getCooldownRemaining(key) {
  const cd = state.cooldowns[key];
  return cd ? Math.max(0, Math.ceil((cd - state.gs.tickCount) / 10)) : 0;
}
