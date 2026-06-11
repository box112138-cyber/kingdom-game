import { B } from './config.js';
import { state } from './state.js';

// Adjacency check: two buildings are adjacent if within 1 cell (including diagonals)
function isAdjacent(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

function getAdjacencyBonus(bid, kind) {
  const myPos = state.bPos;
  const bonusTargets = {
    farm_granary: { from: 'farm', to: 'granary', mult: 1.2 },
    mine_market:   { from: 'mine', to: 'market', mult: 1.15 },
    quarry_stone:  { from: 'quarry', to: 'stoneStorage', mult: 1.2 },
    barracks_castle: { from: 'barracks', to: 'castle', mult: 1.0 }
  };

  for (const [key, cfg] of Object.entries(bonusTargets)) {
    if (bid === cfg.from && kind === 'prod') {
      for (const [k, v] of Object.entries(myPos)) {
        if (k.startsWith(cfg.to)) {
          for (const [k2, v2] of Object.entries(myPos)) {
            if (k2.startsWith(cfg.from) && isAdjacent(v.r, v.c, v2.r, v2.c)) return cfg.mult;
          }
        }
      }
    }
  }
  return 1.0;
}

// === Resource Production ===

export function computeProd() {
  const p = { gold: 0, food: 0, stone: 0 };
  let gm = 1;
  let mktL = 0;

  for (const [id, l] of Object.entries(state.gs.buildings)) {
    if (l === 0) continue;
    const pp = B[id].prod(l);
    // Apply adjacency bonus
    const adjBonus = getAdjacencyBonus(id, 'prod');
    for (const [k, v] of Object.entries(pp)) {
      p[k] = (p[k] || 0) + v * adjBonus;
    }
    if (id === 'market') mktL = Math.max(mktL, l);
  }

  if (mktL > 0) gm = B.market.effects(mktL).gm;
  p.gold = p.gold * gm + Object.keys(state.gs.claimedCells).length * 0.1;
  // Prestige production bonus
  const prestigeMult = 1 + (state.gs.prestige || 0) * 0.05;
  for (const k of Object.keys(p)) {
    p[k] = p[k] * prestigeMult;
  }
  return { ...p, gm };
}

// === Resource Caps ===

export function goldCap() {
  let c = 2000;
  const gb = state.gs.buildings.goldStorage || 0;
  if (gb > 0) c += B.goldStorage.effects(gb).gsb;
  return c;
}

export function foodCap() {
  let c = 2000;
  const gr = state.gs.buildings.granary || 0;
  if (gr > 0) c += B.granary.effects(gr).fsb;
  return c;
}

export function stoneCap() {
  let c = 1000;
  const ss = state.gs.buildings.stoneStorage || 0;
  if (ss > 0) c += B.stoneStorage.effects(ss).ssb;
  return c;
}

// === Population & Power ===

export function maxPop() {
  const cl = state.gs.buildings.castle || 0;
  return cl > 0 ? B.castle.effects(cl).mp : 0;
}

export function power() {
  let p = 0;
  const br = state.gs.buildings.barracks || 0;
  if (br > 0) p += B.barracks.effects(br).pb;
  const at = state.gs.buildings.arrowTower || 0;
  if (at > 0) p += B.arrowTower.effects(at).towerAtk;
  p += Math.floor((state.gs.resources.soldiers || 0) * 2);
  p += state.gs.walls * 3;
  return p;
}

// === Hero System ===

export function getHeroStats() {
  const h = state.gs.heroes.barbarianKing, l = h.level;
  const eq = h.equipment || {};
  let bonusAtk = 0, bonusDef = 0, bonusHp = 0;
  if (eq.weapon) bonusAtk = eq.weapon.atk || 0;
  if (eq.armor) bonusDef = eq.armor.def || 0;
  if (eq.ring) bonusHp = eq.ring.hp || 0;
  return {
    name: '秦梧', level: l,
    hp: 100 + l * 50 + bonusHp,
    atk: 15 + l * 10 + bonusAtk,
    def: 8 + l * 7 + bonusDef,
    equipment: eq
  };
}

export function heroUpgradeCost() {
  const l = state.gs.heroes.barbarianKing.level;
  return {
    gold: Math.floor(200 * Math.pow(1.5, l - 1)),
    food: Math.floor(100 * Math.pow(1.4, l - 1))
  };
}

export function upgradeHero() {
  const hl = state.gs.buildings.heroThrone || 0;
  if (hl <= 0) return false; // no heroThrone built
  const cap = B.heroThrone.effects(hl).heroCap;
  const l = state.gs.heroes.barbarianKing.level;
  if (l >= cap) return false;
  const cost = heroUpgradeCost();
  if (state.gs.resources.gold < cost.gold || state.gs.resources.food < cost.food) return false;
  state.gs.resources.gold -= cost.gold;
  state.gs.resources.food -= cost.food;
  state.gs.heroes.barbarianKing.level++;
  return true;
}

// === Soldier Training ===

export function trainCost(count) {
  const bl = state.gs.buildings.barracks || 1;
  return { food: (20 + bl * 5) * count };
}

export function trainTime(count) {
  return count * 12;
}

export function tickTraining() {
  const q = state.gs.trainQueue;
  if (!q.total || q.count >= q.total) return;
  q.ticks--;
  if (q.ticks <= 0) {
    q.count++;
    if (q.count < q.total) {
      q.ticks = trainTime(1);
    } else {
      state.gs.resources.soldiers = (state.gs.resources.soldiers || 0) + q.total;
      q.count = 0;
      q.total = 0;
      q.ticks = 0;
    }
  }
}
