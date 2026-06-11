import { B } from './config.js';
import { state, addLog } from './state.js';
import { canPlace, occupyCells, clearCells } from './map.js';
import { canAffordB, meetsReq } from './buildings.js';
import { rf } from './utils.js';

// === Shop Toggle ===

export function toggleShop() {
  const ov = document.getElementById('shopOverlay');
  if (ov.classList.contains('show')) {
    ov.classList.remove('show');
  } else {
    hideFloatCard();
    ov.classList.add('show');
    updateShopSidebar();
  }
}

// === Shop Sidebar Updates ===

export function updateShopSidebar() {
  document.getElementById('shopStock').textContent = state.gs.walls;
  document.getElementById('shopQty').textContent = state.buyQty;
  const total = 100 * state.buyQty;
  const canBuy = (state.gs.resources.gold || 0) >= total;
  document.getElementById('shopTotal').innerHTML = canBuy
    ? rf(total)
    : '<span style="color:var(--red)">' + rf(total) + '</span>';
  updateBuildShop();
  updateShopDot();
}

export function changeBuyQty(delta) {
  state.buyQty = Math.max(1, Math.min(99, state.buyQty + delta));
  updateShopSidebar();
}

// === Wall Buying ===

export function buyWall(count) {
  const cost = 100 * count;
  if ((state.gs.resources.gold || 0) < cost) return;
  state.gs.resources.gold -= cost;
  state.gs.walls += count;
  addLog('购买了' + count + '个城墙');
  updateShopSidebar();
}

// === Building Shop (Dynamic List) ===

export function updateBuildShop() {
  try {
    let h = '';
    const ids = ['farm', 'mine', 'quarry', 'lumberMill', 'goldStorage', 'granary', 'stoneStorage',
                 'barracks', 'builderHut', 'bridge', 'statue', 'garden', 'fountain',
                 'market', 'temple', 'heroThrone', 'watchtower', 'hospital',
                 'port', 'library', 'arrowTower', 'workshop'];
    for (const id of ids) {
      const def = B[id];
      const cost = def.baseCost;
      const costStr = Object.entries(cost).map(([k, v]) => rf(v) + ' ' + k).join(' ');
      const ul = meetsReq(id);
      const af = canAffordB(id, 1);
      const inv = state.gs.inventory && state.gs.inventory[id] ? state.gs.inventory[id] : 0;

      if (!ul) {
        h += '<div style="color:var(--stone);font-size:10px">' +
             def.icon + ' ' + def.name + ' (需要' +
             Object.entries(def.requires).map(([rid, rl]) => B[rid].name + '等级' + rl).join('') +
             ')</div>';
      } else {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px">' +
             '<span>' + def.icon + ' ' + def.name + (inv > 0 ? ' x' + inv : '') +
             ' <span style="font-size:9px;color:var(--text-dim)">' + costStr + '</span></span>' +
             '<span style="display:flex;gap:2px">' +
             '<button data-action="buy" data-bid="' + id + '" style="font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--gold-dark);background:' + (af ? 'var(--gold)' : 'var(--stone)') + ';color:#1a1a2e;cursor:' + (af ? 'pointer' : 'default') + ';font-weight:bold" ' + (af ? '' : 'disabled') + '>购买</button>' +
             (inv > 0 ? '<button data-action="place" data-bid="' + id + '" style="font-size:10px;padding:2px 6px;border-radius:3px;border:1px solid var(--blue);background:var(--blue);color:#fff;cursor:pointer;font-weight:bold">放置</button>' : '') +
             '</span></div>';
      }
    }
    document.getElementById('buildShop').innerHTML = h;

    const pendingEl = document.getElementById('pendingBuild');
    if (state.pendingBid) {
      pendingEl.innerHTML = '点击地图放置: ' + B[state.pendingBid].icon + ' ' + B[state.pendingBid].name +
                            ' <a href="#" data-action="cancelPlace" style="color:var(--red)">取消</a>';
    } else {
      pendingEl.innerHTML = '';
    }
  } catch (e) { console.error('updateBuildShop error:', e); }
}

// === Building Purchase & Placement ===

export function buyBuilding(bid) {
  const def = B[bid];
  if (!canAffordB(bid, 1)) return;
  const cost = def.baseCost;
  for (const k in cost) state.gs.resources[k] -= cost[k];
  if (!state.gs.inventory) state.gs.inventory = {};
  state.gs.inventory[bid] = (state.gs.inventory[bid] || 0) + 1;
  addLog('购买了' + def.name);
  updateShopSidebar();
  toggleShop();
  placeBuilding(bid);
}

export function placeBuilding(bid) {
  if (!state.gs.inventory || !state.gs.inventory[bid]) return;
  state.pendingBid = bid;
  updateShopSidebar();
  document.getElementById('placementHint').classList.add('show');
}

export function cancelPlace() {
  state.pendingBid = null;
  updateShopSidebar();
  document.getElementById('placementHint').classList.remove('show');
}

// === Building Reclaim ===

export function reclaimBuilding() {
  if (!state.selectedCell || !state.fcBid || state.fcBid === 'castle') return;
  const r = state.selectedCell.r, c = state.selectedCell.c;
  const bid = state.fcBid;

  let foundKey = null;
  for (const [k, v] of Object.entries(state.bPos)) {
    if (v.r === r && v.c === c && k.startsWith(bid)) { foundKey = k; break; }
  }
  if (!foundKey) return;

  const sz = B[bid].size || 1;
  clearCells(r, c, sz);
  delete state.bPos[foundKey];
  if (!state.gs.inventory) state.gs.inventory = {};
  state.gs.inventory[bid] = (state.gs.inventory[bid] || 0) + 1;
  addLog('收回了' + B[bid].name);
}

// === Shop Notification Dot ===

export function updateShopDot() {
  let has = false;
  if (state.gs.inventory) {
    for (const k of Object.keys(state.gs.inventory)) {
      if (state.gs.inventory[k] > 0) { has = true; break; }
    }
  }
  document.getElementById('shopDot').classList.toggle('show', has);
}

// hideFloatCard is from renderer, used in toggleShop
import { hideFloatCard } from './renderer.js';
