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
  const p = { gold: 0, food: 0, stone: 0, wood: 0, soldiers: 0, gems: 0 };
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

export function woodCap() {
  let c = 1000;
  const lumberL = state.gs.buildings.lumberMill || 0;
  if (lumberL > 0) c += lumberL * 600;
  return c;
}

export function gemCap() {
  let c = 300;
  const templeL = state.gs.buildings.temple || 0;
  const alchemyL = state.gs.buildings.alchemyLab || 0;
  if (templeL > 0) c += templeL * 80;
  if (alchemyL > 0) c += alchemyL * 120;
  return c;
}

// === Population & Power ===

export function maxPop() {
  let total = 0;
  for (const [id, level] of Object.entries(state.gs.buildings)) {
    if (!B[id] || level <= 0) continue;
    const effects = B[id].effects(level);
    if (effects.mp) total += effects.mp;
  }
  return total;
}

export function addSoldiers(amount) {
  const cap = maxPop();
  if (cap <= 0) return 0;
  const current = state.gs.resources.soldiers || 0;
  const added = Math.max(0, Math.min(amount, cap - current));
  state.gs.resources.soldiers = current + added;
  return added;
}

export function power() {
  let p = 0;
  const br = state.gs.buildings.barracks || 0;
  if (br > 0) p += B.barracks.effects(br).pb;
  const at = state.gs.buildings.arrowTower || 0;
  if (at > 0) p += B.arrowTower.effects(at).towerAtk;
  const beastL = state.gs.buildings.beastPen || 0;
  if (beastL > 0) p += B.beastPen.effects(beastL).cavalryPower;
  const soldierMult = beastL > 0 ? B.beastPen.effects(beastL).soldierPower : 1;
  p += Math.floor((state.gs.resources.soldiers || 0) * 2 * soldierMult);
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
  const alchemyL = state.gs.buildings.alchemyLab || 0;
  if (alchemyL > 0) {
    const alchemy = B.alchemyLab.effects(alchemyL);
    bonusAtk += alchemy.heroAtk;
    bonusDef += alchemy.heroDef;
  }
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
  const tavernL = state.gs.buildings.tavern || 0;
  const speed = tavernL > 0 ? B.tavern.effects(tavernL).trainSpeed : 0;
  return Math.max(4, Math.floor(count * 12 * (1 - speed)));
}

export function startTraining(count) {
  const barracksL = state.gs.buildings.barracks || 0;
  if (barracksL <= 0 || state.gs.trainQueue.total > 0) return false;
  const room = Math.floor(maxPop() - (state.gs.resources.soldiers || 0));
  const actualCount = Math.max(0, Math.min(count, room));
  if (actualCount <= 0) return false;
  const cost = trainCost(actualCount);
  if ((state.gs.resources.food || 0) < cost.food) return false;
  state.gs.resources.food -= cost.food;
  state.gs.trainQueue = { count: 0, total: actualCount, ticks: trainTime(1), level: barracksL };
  return true;
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
      addSoldiers(q.total);
      q.count = 0;
      q.total = 0;
      q.ticks = 0;
    }
  }
}
