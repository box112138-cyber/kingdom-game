import { B, MC, MR, CS, MONSTERS } from './config.js';
import { state, INTERIORS, isClaimed, addLog } from './state.js';
import { rf } from './utils.js';
import { canPlace } from './map.js';
import { buildCost, canAffordB, meetsReq, upgradeTicks, builderCount } from './buildings.js';
import { getHeroStats, heroUpgradeCost, computeProd, maxPop, power } from './economy.js';

// ========== Cell DOM Cache ==========
// After a full renderMap(), holds direct references to every cell element.
// Incremental updates use these references (O(1) per cell, no DOM search).

let cellEls = null;

function ensureCache() {
  if (cellEls) return;
  cellEls = new Array(MR);
  const ly = document.getElementById('mapLayer');
  for (const child of ly.children) {
    const r = parseInt(child.dataset.row);
    const c = parseInt(child.dataset.col);
    if (!isNaN(r) && !isNaN(c)) {
      if (!cellEls[r]) cellEls[r] = new Array(MC);
      cellEls[r][c] = child;
    }
  }
}

function invalidateCache() {
  cellEls = null;
}

// ========== Single-cell data builder ==========
// Returns everything needed to render one cell, reused by both
// renderMap (full rebuild) and updateCell (incremental).

function buildCellData(r, c) {
  const cell = state.mapData[r][c];
  if (!cell) return null;

  const cl = isClaimed(r, c);
  let bg;
  if (cell.wall) bg = '#6b6b5a';
  else if (cell.buildingId === '__occ__') bg = '#8bb870';
  else if (cell.terrain === 'grass') bg = cl ? '#7ab860' : (altV(r, c) ? '#6aaf50' : '#74b85a');
  else if (cell.terrain === 'water') bg = altV(r, c) ? '#5b9ed4' : '#68b0e0';
  else if (cell.terrain === 'tree') bg = altV(r, c) ? '#509040' : '#5a9a4a';
  else if (cell.terrain === 'mountain') bg = altV(r, c) ? '#b8b0a0' : '#c4bca8';
  else if (cell.terrain === 'path') bg = '#c4a870';
  else bg = '#444';

  let cls = '';
  if (cl) cls += ' claimed-land';
  if (state.moveMode && !state.movingBid && isValidMoveTarget(r, c)) cls += ' move-valid';
  if (state.pendingBid && canPlace(r, c, B[state.pendingBid].size || 1, state.pendingBid)) cls += ' move-valid';
  if (cell.buildingId === '__occ__') { cls += ' occ-part'; }
  else if (cell.buildingId) { cls += ' has-building'; }

  const cdk = r + ',' + c;
  const dimmed = !!(state.cooldowns[cdk] && state.cooldowns[cdk] > state.gs.tickCount);

  let inner = '';
  if (cell.buildingId && cell.buildingId !== '__occ__') {
    const def = B[cell.buildingId];
    if (def) {
          let bl = state.gs.buildings[cell.buildingId] || 1;
          for (const [k, v] of Object.entries(state.bPos)) {
            if (v.r === r && v.c === c && !k.startsWith(cell.buildingId)) { bl = 1; break; }
          }
      const sz = def.size || 1;
      const bc = sz >= 2 ? ' big' : '';
      if (def.image) {
        inner = '<img src="' + def.image + '" class="building-img' + bc + '" alt="' + def.name + '">';
      } else {
        inner = '<span class="building-emoji' + bc + '">' + def.icon + '</span>';
      }
      inner += '<span class="cell-level">' + bl + '</span>';
    }
  } else if (cell.wall) {
    inner = '<span class="building-emoji">🧱</span>';
  } else if (cell.terrain === 'water') {
    inner = '<span class="cell-decor">🌊</span>';
  } else if (cell.terrain === 'tree') {
    inner = '<span class="cell-decor">🌲</span>';
  } else if (cell.terrain === 'mountain') {
    inner = '<span class="cell-decor">⛰️</span>';
  } else if (cl) {
    inner = '<span class="claimed-flag">*</span>';
  }

  // Treasure indicator
  if (!cell.buildingId && !cell.wall) {
    const treasure = state.gs.treasures && state.gs.treasures.find(t => t.r === r && t.c === c && !t.collected);
    if (treasure) inner = '<span class="cell-decor" style="font-size:24px">🎁</span>';
  }

  // Monster indicator
  if (!cell.buildingId && !cell.wall) {
    const monster = state.gs.monsters && state.gs.monsters.find(m => m.r === r && m.c === c && m.alive);
    if (monster) {
      const def = MONSTERS[monster.type];
      if (def) inner = '<span class="cell-decor" style="font-size:24px">' + def.icon + '</span>';
    }
  }

  // Ruin indicator
  if (!cell.buildingId && !cell.wall) {
    const ruin = state.gs.ruins && state.gs.ruins.find(ru => ru.r === r && ru.c === c && !ru.explored);
    if (ruin) inner = '<span class="cell-decor" style="font-size:24px">🏚️</span>';
  }

  return { bg, cls, dimmed, inner };
}

function altV(r, c) {
  const k = r * MC + c;
  if (!state.altCache.has(k)) state.altCache.set(k, (r + c) % 2 === 0);
  return state.altCache.get(k);
}

// ========== Incremental Cell Update (O(1), no innerHTML on parent) ==========

export function updateCell(r, c) {
  ensureCache();
  const el = cellEls[r] && cellEls[r][c];
  if (!el) return;
  const data = buildCellData(r, c);
  if (!data) return;

  el.style.background = data.bg;
  el.className = 'map-cell' + data.cls;
  el.style.filter = data.dimmed ? 'brightness(0.55)' : '';
  el.innerHTML = data.inner
    ? '<div class="cell-content">' + data.inner + '</div>'
    : '';
}

export function updateCells(coords) {
  for (const [r, c] of coords) {
    updateCell(r, c);
  }
}

// ========== Full Map Render (used for initial load & periodic refresh) ==========

export function renderMap() {
  const ly = document.getElementById('mapLayer');
  ly.style.width = (MC * CS) + 'px';
  ly.style.height = (MR * CS) + 'px';
  let html = '';

  for (let r = 0; r < MR; r++) {
    for (let c = 0; c < MC; c++) {
      const data = buildCellData(r, c);
      if (!data) continue;
      html += '<div class="map-cell' + data.cls + '" style="left:' + (c * CS) +
              'px;top:' + (r * CS) + 'px;width:' + CS + 'px;height:' + CS +
              'px;background:' + data.bg + ';' +
              (data.dimmed ? 'filter:brightness(0.55);' : '') +
              '" data-row="' + r + '" data-col="' + c + '">' +
              (data.inner ? '<div class="cell-content">' + data.inner + '</div>' : '') +
              '</div>';
    }
  }
  ly.innerHTML = html;
  invalidateCache();
  ensureCache();
  updateSelOverlay();
}

// ========== Selection Overlay ==========

export function updateSelOverlay() {
  const el = document.getElementById('selOverlay');
  if (!state.selectedCell) {
    el.style.display = 'none';
    el.className = '';
    return;
  }
  const cx = (state.selectedCell.c * CS + CS / 2) * state.viewZoom + state.viewPanX;
  const cy = (state.selectedCell.r * CS + CS / 2) * state.viewZoom + state.viewPanY;
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.className = state.moveMode ? 'move' : 'normal';
}

// ========== Full UI Rebuild (resource bar, stats, logs — NOT the map) ==========

export function rebuildUI() {
  try {
    const prod = computeProd();
    const rl = [
      { k: 'gold', n: '金币', i: 'G', c: 'var(--gold)' },
      { k: 'food', n: '粮食', i: 'F', c: 'var(--green)' },
      { k: 'stone', n: '石料', i: 'S', c: 'var(--stone)' },
      { k: 'wood', n: '木材', i: 'W', c: 'var(--wood)' },
      { k: 'soldiers', n: '士兵', i: 'A', c: 'var(--blue)' },
      { k: 'gems', n: '宝石', i: '💎', c: 'var(--purple)' }
    ];
    document.getElementById('resources').innerHTML = rl.map(function (r) {
      const v = state.gs.resources[r.k] || 0, rt = prod[r.k] || 0;
      return '<div class="res-item"><div class="res-icon">' + r.i +
             '</div><div class="res-info"><span class="res-name">' + r.n +
             '</span><span class="res-value" style="color:' + r.c + '">' + rf(v) +
             '</span><span class="res-rate">' + (rt > 0 ? '+' + rt.toFixed(1) + '/s' : '0/s') +
             '</span></div></div>';
    }).join('');

    document.getElementById('statCastle').textContent = state.gs.buildings.castle || 1;
    document.getElementById('statClaimed').textContent = Object.keys(state.gs.claimedCells).length;
    document.getElementById('statPopCap').textContent = maxPop();
    document.getElementById('statPower').textContent = power();
    document.getElementById('statGps').textContent = prod.gold.toFixed(1);
    document.getElementById('statBestiary').textContent = (state.gs.bestiary || []).length + '/7';
    document.getElementById('statAchieve').textContent = (state.gs.achievements && state.gs.achievements.unlocked ? state.gs.achievements.unlocked.length : 0) + '/12';
    document.getElementById('statPrestige').textContent = state.gs.prestige || 0;

    const rec = state.gs.logs.slice(-20).reverse();
    document.getElementById('logList').innerHTML = rec.map(function (l) {
      return '<div class="log-item"><span class="time">' + l.time + '</span>' + l.msg + '</div>';
    }).join('') || '<div class="log-item">等待中...</div>';
  } catch (e) { console.error('rebuildUI error:', e); }
}

// ========== Upgrade Panel ==========

export function renderUpgradePanel() {
  const panel = document.getElementById('upgradePanel');
  if (!state.gs.upgradeQueue.length) { panel.innerHTML = ''; return; }
  panel.innerHTML = state.gs.upgradeQueue.map(q => {
    const def = B[q.bid];
    const remaining = Math.max(0, Math.ceil((q.endTick - state.gs.tickCount) / 10));
    const total = upgradeTicks(q.bid, q.targetL - 1) / 10;
    const pct = Math.min(100, Math.max(0, 100 - (remaining / total) * 100));
    return '<div class="upgrade-item">' + def.icon + ' ' + def.name + ' Lv.' + q.targetL +
           ' <span style="color:var(--gold);font-size:9px">' + remaining + 's</span>' +
           '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
  }).join('');
}

// ========== Worker Animation ==========

const WORKER_SPEED = 1.5; // grid units per tick (100ms)

export function spawnWorker(bid) {
  const pos = state.bPos[bid];
  if (!pos) return;

  let hutR = 1, hutC = 1;
  for (const k of Object.keys(state.bPos)) {
    if (k.startsWith('builderHut')) {
      const hut = state.bPos[k];
      hutR = hut.r; hutC = hut.c;
      break;
    }
  }

  const workerId = ++state._workerIdCounter;
  const lastQ = state.gs.upgradeQueue[state.gs.upgradeQueue.length - 1];
  if (lastQ && lastQ.bid === bid) lastQ.workerId = workerId;

  const el = document.createElement('div');
  el.className = 'worker';
  el.textContent = '🧑‍🔧';
  el.style.left = (hutC * CS + CS / 2) + 'px';
  el.style.top = (hutR * CS + CS / 2) + 'px';
  document.getElementById('workers').appendChild(el);

  state.workers.push({
    bid, workerId, el,
    hutR, hutC,
    buildR: pos.r, buildC: pos.c,
    curR: hutR + 0.5, curC: hutC + 0.5,
    phase: 'toBuild'
  });
}

export function applyWorkerTransform() {
  const wEl = document.getElementById('workers');
  if (!wEl) return;
  wEl.style.transform = 'translate(' + state.viewPanX + 'px,' + state.viewPanY + 'px) scale(' + state.viewZoom + ')';
}

export function updateWorkers() {
  for (let i = state.workers.length - 1; i >= 0; i--) {
    const w = state.workers[i];

    let tx, ty;
    if (w.phase === 'toBuild') {
      tx = w.buildC + 0.5; ty = w.buildR + 0.5;
    } else if (w.phase === 'toHut') {
      tx = w.hutC + 0.5; ty = w.hutR + 0.5;
    } else {
      continue; // waiting
    }

    const dx = tx - w.curC, dy = ty - w.curR;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) {
      w.curC = tx; w.curR = ty;
      w.el.style.left = (w.curC * CS) + 'px';
      w.el.style.top = (w.curR * CS) + 'px';
      w.phase = w.phase === 'toBuild' ? 'waiting' : 'remove';
    } else {
      const step = Math.min(dist, WORKER_SPEED);
      w.curC += (dx / dist) * step;
      w.curR += (dy / dist) * step;
      w.el.style.left = (w.curC * CS) + 'px';
      w.el.style.top = (w.curR * CS) + 'px';
    }

    if (w.phase === 'remove') {
      w.el.remove();
      state.workers.splice(i, 1);
    }
  }
}

// ========== Float Card ==========

export function showFloatCard(bid) {
  try {
    let l = state.gs.buildings[bid] || 1;
    if (state.selectedCell) {
      for (const [k, v] of Object.entries(state.bPos)) {
        if (v.r === state.selectedCell.r && v.c === state.selectedCell.c && !k.startsWith(bid)) { l = 1; break; }
      }
    }
    const def = B[bid];
    const mx = l >= def.maxL;
    const ul = meetsReq(bid);
    const af = canAffordB(bid, l);
    state.fcBid = bid;

    const card = document.getElementById('floatCard');
    card.style.left = '50%';
    card.style.bottom = '12px';
    card.style.top = 'auto';
    card.style.transform = 'translateX(-50%)';

    document.getElementById('fcTitle').textContent = def.icon + ' ' + def.name + ' 等级' + l + '/' + def.maxL;

    if (bid === 'heroThrone') {
      const hero = getHeroStats();
      const hc = heroUpgradeCost();
      document.getElementById('fcStats').innerHTML =
        '<div style="text-align:center;margin:8px 0"><img src="assets/images/秦梧.png" ' +
        'style="width:140px;height:140px;border-radius:14px;border:2px solid var(--gold-dark);object-fit:cover"></div>' +
        '<div style="font-size:13px">生命:' + hero.hp + ' 攻击:' + hero.atk + ' 防御:' + hero.def + '</div>';
      const btn = document.getElementById('fcBtn'), cst = document.getElementById('fcCost');
      if (mx) {
        btn.style.display = 'none';
      } else {
        const hasG = state.gs.resources.gold >= hc.gold, hasF = state.gs.resources.food >= hc.food;
        cst.innerHTML = (hasG ? hc.gold + 'G' : '<span style="color:var(--red)">' + hc.gold + 'G</span>') +
                        ' ' + (hasF ? hc.food + 'F' : '<span style="color:var(--red)">' + hc.food + 'F</span>');
        btn.textContent = '升级英雄 -> 等级' + (hero.level + 1);
        btn.style.display = 'block';
      }
    } else {
      const p = def.prod(l), e = def.effects(l);
      const ls = [];
      if (p.gold) ls.push('金币+' + p.gold.toFixed(1) + '/s');
      if (p.food) ls.push('粮食+' + p.food.toFixed(1) + '/s');
      if (p.stone) ls.push('石料+' + p.stone.toFixed(1) + '/s');
      if (e.mp) ls.push('人口上限+' + e.mp);
      if (e.gsb) ls.push('金币上限+' + e.gsb);
      if (e.fsb) ls.push('粮食上限+' + e.fsb);
      document.getElementById('fcStats').textContent = ls.join(' | ');

      const btn = document.getElementById('fcBtn'), cst = document.getElementById('fcCost');
      const upgrading = state.gs.upgradeQueue.some(q => q.bid === bid);
      const bc = builderCount();
      const busy = state.gs.upgradeQueue.length >= bc;

      if (upgrading) {
        btn.style.display = 'none';
        cst.textContent = '升级中...';
      } else if (busy) {
        btn.style.display = 'none';
        cst.textContent = '工人忙碌中 (' + state.gs.upgradeQueue.length + '/' + bc + ')';
      } else if (!ul) {
        btn.style.display = 'none';
        cst.textContent = '需要: ' + Object.entries(def.requires).map(([rid, rl]) => B[rid].name + '等级' + rl).join(' ');
      } else if (mx) {
        btn.style.display = 'none';
      } else {
        const ct = buildCost(bid, l);
        const costStr = Object.entries(ct).map(([k, v]) => {
          const has = (state.gs.resources[k] || 0) >= v;
          return has ? rf(v) + ' ' + k : '<span style="color:var(--red)">' + rf(v) + ' ' + k + '</span>';
        }).join(' ');
        cst.innerHTML = costStr;
        const et = (upgradeTicks(bid, l) / 10).toFixed(1);
        btn.textContent = '升级 -> 等级' + (l + 1) + ' (' + et + 's)';
        btn.style.display = 'block';
      }
    }

    card.style.display = 'block';

    const rBtn = document.getElementById('fcReclaim');
    if (bid === 'castle') {
      rBtn.style.display = 'none';
    } else {
      rBtn.style.display = 'block';
      rBtn.textContent = '收回 ' + def.name;
    }

    const eBtn = document.getElementById('fcEnter');
    if (INTERIORS[bid]) {
      eBtn.style.display = 'block';
      eBtn.textContent = '进入内部 (Space)';
    } else {
      eBtn.style.display = 'none';
    }
  } catch (e) { console.error('showFloatCard error:', e); }
}

export function hideFloatCard() {
  state.fcBid = null;
  if (state.cdTimer) { clearInterval(state.cdTimer); state.cdTimer = null; }
  document.getElementById('floatCard').style.display = 'none';
  document.getElementById('fcReclaim').style.display = 'none';
  document.getElementById('fcEnter').style.display = 'none';
}

// ========== Terrain Card ==========

export function showTerrainCard(r, c, cell) {
  const card = document.getElementById('floatCard');
  state.fcBid = null;
  if (state.cdTimer) { clearInterval(state.cdTimer); state.cdTimer = null; }

  document.getElementById('fcReclaim').style.display = 'none';
  document.getElementById('fcEnter').style.display = 'none';
  card.style.left = '50%';
  card.style.bottom = '12px';
  card.style.top = 'auto';
  card.style.transform = 'translateX(-50%)';

  const btn = document.getElementById('fcBtn');
  const cst = document.getElementById('fcCost');
  const fcStats = document.getElementById('fcStats');
  const fcTitle = document.getElementById('fcTitle');
  btn.style.display = 'none';
  cst.textContent = '';

  const key = r + ',' + c;

  function renderCD() {
    const cd = state.cooldowns[key];
    const rem = cd ? Math.max(0, Math.ceil((cd - state.gs.tickCount) / 10)) : 0;

    if (cell.terrain === 'tree') {
      fcTitle.textContent = '树木';
      fcStats.textContent = rem > 0 ? '冷却中 ' + rem + 's' : '砍伐获取木材';
      if (!rem) { btn.textContent = '砍伐 (+12木材)'; btn.style.display = 'block'; state.fcBid = 'T'; }
      else { btn.style.display = 'none'; }
    } else if (cell.terrain === 'water') {
      fcTitle.textContent = '水域';
      fcStats.textContent = rem > 0 ? '冷却中 ' + rem + 's' : '钓鱼获取粮食';
      if (!rem) { btn.textContent = '钓鱼 (+18粮食)'; btn.style.display = 'block'; state.fcBid = 'W'; }
      else { btn.style.display = 'none'; }
    } else if (cell.terrain === 'mountain') {
      fcTitle.textContent = '山脉';
      fcStats.textContent = rem > 0 ? '冷却中 ' + rem + 's' : '采矿获取石料';
      if (!rem) { btn.textContent = '采矿 (+10石料)'; btn.style.display = 'block'; state.fcBid = 'M'; }
      else { btn.style.display = 'none'; }
    } else if (cell.wall) {
      fcTitle.textContent = '城墙';
      fcStats.textContent = '防御建筑';
    } else if (cell.terrain === 'grass') {
      fcTitle.textContent = '空地';
      if (cl) { fcStats.textContent = '已声明领地'; }
      else {
        fcStats.textContent = '声明领地 (-50G)';
        btn.textContent = '声明领土';
        btn.style.display = 'block';
        state.fcBid = 'C'; // Claim action
      }
    }

    if (rem <= 0 && state.cdTimer) { clearInterval(state.cdTimer); state.cdTimer = null; renderCD(); }
  }

  renderCD();
  if (state.cooldowns[key] && state.cooldowns[key] > state.gs.tickCount) {
    state.cdTimer = setInterval(renderCD, 500);
  }
  card.style.display = 'block';
}

// ========== Reward Flash ==========

export function showReward(r, c, text) {
  const ly = document.getElementById('mapLayer');
  const cx = c * CS + CS / 2, cy = r * CS + CS / 2;
  const el = document.createElement('div');
  el.className = 'reward-flash';
  el.style.left = cx + 'px';
  el.style.top = cy + 'px';
  el.textContent = text;
  ly.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function isValidMoveTarget(r, c) {
  if (!state.movingBid) return true;
  return canPlace(r, c, B[state.movingBid].size || 1, state.movingBid);
}
