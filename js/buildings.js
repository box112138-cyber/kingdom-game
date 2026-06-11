import { B } from './config.js';
import { state, addLog } from './state.js';

// === Building Costs ===

export function buildCost(bid, l) {
  const d = B[bid];
  if (l >= d.maxL) return null;
  const ct = {};
  for (const [k, v] of Object.entries(d.baseCost)) {
    ct[k] = Math.floor(v * Math.pow(d.costScale, l));
  }
  const ws = state.gs.buildings.workshop || 0;
  if (ws > 0) {
    const rd = B.workshop.effects(ws).cr;
    for (const k of Object.keys(ct)) {
      ct[k] = Math.floor(ct[k] * (1 - rd));
    }
  }
  return ct;
}

export function canAffordB(bid, l) {
  const c = buildCost(bid, l);
  if (!c) return false;
  return Object.entries(c).every(([k, v]) => (state.gs.resources[k] || 0) >= v);
}

export function meetsReq(bid) {
  const d = B[bid];
  if (!d.requires) return true;
  return Object.entries(d.requires).every(([id, rl]) => (state.gs.buildings[id] || 0) >= rl);
}

// === Upgrade Timing ===

export function upgradeTicks(bid, l) {
  let base = (bid === 'castle' && l === 1) ? 50 : Math.floor(30 + l * 10);
  // Library speed bonus
  const libL = state.gs.buildings.library || 0;
  if (libL > 0) {
    base = Math.floor(base * (1 - B.library.effects(libL).buildSpeed));
  }
  return Math.max(10, base);
}

// === Builder Count ===

export function builderCount() {
  let n = 1; // base 1 builder always available
  for (const k of Object.keys(state.bPos)) {
    if (k.startsWith('builderHut')) n++;
  }
  return n;
}

export function anyBuilderPos() {
  for (const k of Object.keys(state.bPos)) {
    if (k.startsWith('builderHut')) return state.bPos[k];
  }
  return null;
}

// === Upgrade Action (returns true if queued) ===

export function upgradeB(bid) {
  const d = B[bid], l = state.gs.buildings[bid] || 1;
  if (l >= d.maxL || !meetsReq(bid) || !canAffordB(bid, l)) return false;

  const bc = builderCount();
  if (state.gs.upgradeQueue.length >= bc) return false;

  const ct = buildCost(bid, l);
  for (const [k, v] of Object.entries(ct)) {
    state.gs.resources[k] -= v;
  }

  const endTick = state.gs.tickCount + upgradeTicks(bid, l);
  state.gs.upgradeQueue.push({ bid, targetL: l + 1, endTick });

  addLog(d.icon + ' ' + d.name + ' -> 等级' + (l + 1) +
         ' (' + (upgradeTicks(bid, l) / 10).toFixed(1) + 's)');
  return true;
}

// === Process Completed Upgrades (returns array of completed) ===

export function processUpgrades() {
  const completed = [];
  for (let i = state.gs.upgradeQueue.length - 1; i >= 0; i--) {
    if (state.gs.tickCount >= state.gs.upgradeQueue[i].endTick) {
      completed.push(state.gs.upgradeQueue[i]);
      state.gs.upgradeQueue.splice(i, 1);
    }
  }
  for (const q of completed) {
    state.gs.buildings[q.bid] = q.targetL;
    addLog(B[q.bid].icon + ' ' + B[q.bid].name + ' 升级完成 -> 等级' + q.targetL);
  }
  return completed;
}
