import { state, INTERIORS, addLog } from './state.js';
import { createInteriors } from './config.js';
import { addSoldiers } from './economy.js';

// Get items visible at current castle level
function visibleItems(cfg) {
  const cl = state.gs.buildings.castle || 1;
  return cfg.items.filter(it => (it.minLevel || 1) <= cl);
}

function itemKey(bid, r, c) {
  return bid + ':' + r + ',' + c;
}

function hasCollected(collected, bid, r, c) {
  const key = itemKey(bid, r, c);
  const legacyKey = r + ',' + c;
  return collected.includes(key) || (bid === 'castle' && collected.includes(legacyKey));
}

// === Show/Hide Interior ===

export function showInterior(bid) {
  state.interiorBid = bid;
  const cfg = INTERIORS[bid];
  if (!cfg) return;
  // Regenerate ruin items each time
  if (bid === 'ruin') {
    const fresh = createInteriors().ruin;
    cfg.items = fresh.items;
  }
  state.intPlayer = { r: cfg.start[0], c: cfg.start[1] };
  document.getElementById('intTitle').textContent = cfg.name;
  renderInterior();
  document.getElementById('interiorOverlay').classList.add('show');
}

export function hideInterior() {
  state.interiorBid = null;
  state.intPlayer = null;
  document.getElementById('interiorOverlay').classList.remove('show');
}

// === Render Interior Grid ===

export function renderInterior() {
  const cfg = INTERIORS[state.interiorBid];
  if (!cfg) return;
  const grid = document.getElementById('intGrid');
  const collected = state.gs.collectedItems;
  let h = '';
  let uncollected = 0;

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      let cls = 'int-cell', content = '';
      if (cfg.walls.some(w => w[0] === r && w[1] === c)) {
        cls += ' wall';
      } else if (cfg.door[0] === r && cfg.door[1] === c) {
        cls += ' door';
      } else {
        if (!hasCollected(collected, state.interiorBid, r, c)) {
          const it = visibleItems(cfg).find(i => i.r === r && i.c === c);
          if (it) { content = it.e; uncollected++; }
        }
      }
      if (state.intPlayer && state.intPlayer.r === r && state.intPlayer.c === c) {
        content = '<span class="int-player">' + ((state.gs.character && state.gs.character.avatar) || '🧑') + '</span>';
      }
      h += '<div class="' + cls + '">' + content + '</div>';
    }
  }

  grid.innerHTML = h;

  // Update title to show remaining count
  const items = visibleItems(cfg);
  const total = items.length;
  const remaining = total - items.filter(i => hasCollected(collected, state.interiorBid, i.r, i.c)).length;
  document.getElementById('intTitle').textContent =
    cfg.name + ' (' + remaining + '/' + total + ')';
}

// === Move & Collect ===

export function moveIntPlayer(dr, dc) {
  if (!state.interiorBid) return;
  const cfg = INTERIORS[state.interiorBid];
  if (!cfg) return;
  const nr = state.intPlayer.r + dr, nc = state.intPlayer.c + dc;
  if (nr < 0 || nr > 6 || nc < 0 || nc > 6) return;
  if (cfg.walls.some(w => w[0] === nr && w[1] === nc)) return;

  state.intPlayer.r = nr;
  state.intPlayer.c = nc;

  // Check for item at new position
  const key = itemKey(state.interiorBid, nr, nc);
  if (!hasCollected(state.gs.collectedItems, state.interiorBid, nr, nc)) {
    const it = visibleItems(cfg).find(i => i.r === nr && i.c === nc);
    if (it && it.reward) {
      collectItem(it, key, cfg);
    } else if (it && it.trap) {
      // Trigger trap
      state.gs.collectedItems.push(key);
      state.gs.resources.gold = Math.max(0, (state.gs.resources.gold || 0) - it.damage);
      addLog('💀 触发陷阱！损失 ' + it.damage + 'G');
      showInteriorToast('💀 陷阱！-' + it.damage + 'G');
    }
  }

  renderInterior();

  if (cfg.door[0] === nr && cfg.door[1] === nc) hideInterior();
}

function collectItem(item, key, cfg) {
  // Grant rewards
  const rewards = [];
  for (const [k, v] of Object.entries(item.reward)) {
    const gained = k === 'soldiers' ? addSoldiers(v) : v;
    if (k !== 'soldiers') state.gs.resources[k] = (state.gs.resources[k] || 0) + v;
    const labels = { gold: 'G', food: 'F', wood: 'W', stone: 'S', soldiers: '兵', gems: '💎' };
    rewards.push('+' + gained + (labels[k] || k));
  }

  state.gs.collectedItems.push(key);
  addLog('拾取 ' + item.e + ' ' + rewards.join(' '));

  // Show toast
  showInteriorToast(item.e + ' ' + rewards.join(' '));

  // Check completion
  const items = visibleItems(cfg);
  const total = items.length;
  const remaining = total - items.filter(i => hasCollected(state.gs.collectedItems, state.interiorBid, i.r, i.c)).length;
  if (remaining === 0) {
    addLog('🏰 城堡内部已探索完毕！');
    setTimeout(() => showInteriorToast('🏰 探索完毕！'), 500);
  }
}

function showInteriorToast(msg) {
  const panel = document.querySelector('.interior-panel');
  if (!panel) return;
  const el = document.createElement('div');
  el.style.cssText = 'color:var(--gold);font-size:14px;font-weight:bold;margin-top:8px;animation:pin 0.3s,pout 0.3s 1.5s forwards';
  el.textContent = msg;
  panel.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}
