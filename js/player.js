import { B, MC, MR, CS } from './config.js';
import { state, INTERIORS, MIN_Z, MAX_Z, addLog } from './state.js';
import { canPlace, occupyCells } from './map.js';
import { doTerrainAction, tryMoveBuilding, toggleMoveMode } from './terrain.js';
import { updateShopSidebar, updateShopDot, cancelPlace } from './shop.js';
import {
  renderMap, showFloatCard, showTerrainCard, hideFloatCard, showReward,
  updateSelOverlay, updateCell, updateCells, applyWorkerTransform
} from './renderer.js';
import { showInterior, hideInterior, moveIntPlayer } from './interiors.js';
import { resolveCombat } from './combat.js';
import { trackBuild } from './achievements.js';
import { startManualCombat } from './match3.js';
import { markWorldDirty, renderRemotePlayers, updatePresence } from './multiplayer.js';

// ========== Camera / Viewport ==========
let cachedVW = 0, cachedVH = 0;

export function refreshViewportCache() {
  const vp = document.getElementById('mapViewport');
  cachedVW = vp.clientWidth;
  cachedVH = vp.clientHeight;
}

export function applyT() {
  const layEl = document.getElementById('mapLayer');
  layEl.style.transform = 'translate(' + state.viewPanX + 'px,' + state.viewPanY + 'px) scale(' + state.viewZoom + ')';
  document.getElementById('zoomLabel').textContent = Math.round(state.viewZoom * 100) + '%';
  updatePlayerPos();
  applyWorkerTransform();
  renderRemotePlayers();
}

export function setZ(nz, mx, my) {
  const o = state.viewZoom;
  state.viewZoom = Math.max(MIN_Z, Math.min(MAX_Z, nz));
  if (mx != null) {
    state.viewPanX = mx - (mx - state.viewPanX) * (state.viewZoom / o);
    state.viewPanY = my - (my - state.viewPanY) * (state.viewZoom / o);
  }
  applyT();
}

export function zoomIn() {
  if (!cachedVW || !cachedVH) refreshViewportCache();
  setZ(state.viewZoom * 1.25, cachedVW / 2, cachedVH / 2);
}

export function zoomOut() {
  if (!cachedVW || !cachedVH) refreshViewportCache();
  setZ(state.viewZoom / 1.25, cachedVW / 2, cachedVH / 2);
}

export function zoomReset() {
  focusOnCastle();
}

export function focusOnCastle() {
  if (!state.bPos.castle) return;
  if (!cachedVW || !cachedVH) refreshViewportCache();
  const cr = state.bPos.castle.r, cc = state.bPos.castle.c;
  state.viewZoom = 1.5;
  state.viewPanX = cachedVW / 2 - (cc + 0.5) * CS * state.viewZoom;
  state.viewPanY = cachedVH / 2 - (cr + 0.5) * CS * state.viewZoom;
  applyT();
}

// ========== Player Position ==========

export function updatePlayerPos() {
  const plEl = document.getElementById('player');
  plEl.style.left = ((state.player.c * CS + CS / 2) * state.viewZoom + state.viewPanX) + 'px';
  plEl.style.top = ((state.player.r * CS + CS / 2) * state.viewZoom + state.viewPanY) + 'px';
}

export function updatePlayerAvatar() {
  const plEl = document.getElementById('player');
  if (plEl) plEl.textContent = (state.gs.character && state.gs.character.avatar) || '🧑';
}

export function followPlayer() {
  if (!cachedVW || !cachedVH) refreshViewportCache();
  const vw = cachedVW, vh = cachedVH;
  if (!vw || !vh) return;
  const px = (state.player.c * CS + CS / 2) * state.viewZoom + state.viewPanX;
  const py = (state.player.r * CS + CS / 2) * state.viewZoom + state.viewPanY;
  const marginX = vw * 0.25, marginY = vh * 0.25;
  if (px < marginX) state.viewPanX += marginX - px;
  else if (px > vw - marginX) state.viewPanX -= (px - (vw - marginX));
  if (py < marginY) state.viewPanY += marginY - py;
  else if (py > vh - marginY) state.viewPanY -= (py - (vh - marginY));
  applyT();
}

// ========== Helpers ==========

// Returns all [r, c] coords covered by a building placed at (r, c) with size sz
function areaCoords(r, c, sz) {
  const coords = [];
  for (let dr = 0; dr < sz; dr++) {
    for (let dc = 0; dc < sz; dc++) {
      coords.push([r + dr, c + dc]);
    }
  }
  return coords;
}

// ========== Map Click Handler ==========

export function handleClick(r, c) {
  if (state.pendingBid) {
    const sz = B[state.pendingBid].size || 1;
    if (canPlace(r, c, sz, state.pendingBid)) {
      occupyCells(r, c, sz, state.pendingBid);
      if (!state.gs.buildings[state.pendingBid]) state.gs.buildings[state.pendingBid] = 1;
      state.bPos[state.pendingBid + '_' + Date.now()] = { r, c };
      state.gs.inventory[state.pendingBid]--;
      if (state.gs.inventory[state.pendingBid] <= 0) delete state.gs.inventory[state.pendingBid];
      state.pendingBid = null;
      updateShopSidebar();
      updateShopDot();
      document.getElementById('placementHint').classList.remove('show');
      trackBuild();
      updateCells(areaCoords(r, c, sz));
      markWorldDirty();
      return;
    } else {
      addLog('没有空间！');
      return;
    }
  }

  if (state.moveMode) {
    tryMoveBuilding(r, c);
    renderMap();
    markWorldDirty();
    return;
  }

  let tr = r, tc = c;
  const cell = state.mapData[r][c];
  if (cell.buildingId === '__occ__') {
    for (let dr = -2; dr <= 0; dr++) {
      for (let dc = -2; dc <= 0; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && state.mapData[rr] && state.mapData[rr][cc] &&
            state.mapData[rr][cc].buildingId && state.mapData[rr][cc].buildingId !== '__occ__') {
          tr = rr; tc = cc; break;
        }
      }
    }
  }
  state.selectedCell = { r: tr, c: tc };
  updateSelOverlay();
  const mc = state.mapData[tr][tc];
  if (mc && mc.buildingId && mc.buildingId !== '__occ__') {
    showFloatCard(mc.buildingId);
  } else {
    showTerrainCard(tr, tc, mc);
  }
}

// ========== Debounced card display ==========

let moveDebounce = null;

function scheduleCardUpdate() {
  if (moveDebounce) clearTimeout(moveDebounce);
  moveDebounce = setTimeout(() => {
    moveDebounce = null;
    const r = state.player.r, c = state.player.c;
    let tr = r, tc = c;
    const cell = state.mapData[r][c];
    if (cell && cell.buildingId === '__occ__') {
      for (let dr = -2; dr <= 0; dr++) {
        for (let dc = -2; dc <= 0; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && state.mapData[rr] && state.mapData[rr][cc] &&
              state.mapData[rr][cc].buildingId && state.mapData[rr][cc].buildingId !== '__occ__') {
            tr = rr; tc = cc; break;
          }
        }
      }
    }
    const mc = state.mapData[tr][tc];
    if (mc && mc.buildingId && mc.buildingId !== '__occ__') {
      showFloatCard(mc.buildingId);
    } else {
      hideFloatCard();
    }
  }, 250);
}

// ========== Keyboard Input ==========

export function setupKeyboard() {
  window.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Space' || e.key === 'Escape') && state.interiorBid) {
      e.preventDefault();
      hideInterior();
      return;
    }
    if (e.key === 'Escape') {
      const go = document.getElementById('gameOverlay');
      if (go && go.classList.contains('show')) {
        e.preventDefault();
        import('./match3.js').then(m => m.toggleGame());
        return;
      }
    }
    if (document.getElementById('gameOverlay').classList.contains('show')) return;

    if (state.interiorBid) {
      const arrows = {
        w: [-1, 0], a: [0, -1], s: [1, 0], d: [0, 1],
        arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1]
      };
      const dir = arrows[e.key.toLowerCase()];
      if (dir) { e.preventDefault(); moveIntPlayer(dir[0], dir[1]); }
      return;
    }

    if ((e.key === ' ' || e.key === 'Space') && !state.pendingBid && !state.moveMode) {
      const cell = state.mapData[state.player.r][state.player.c];
      // Enter ruin
      const ruin = state.gs.ruins && state.gs.ruins.find(ru => ru.r === state.player.r && ru.c === state.player.c && !ru.explored);
      if (ruin) {
        e.preventDefault();
        ruin.explored = true;
        updateCell(state.player.r, state.player.c);
        hideFloatCard();
        showInterior('ruin');
        addLog('进入废墟探索……');
        markWorldDirty();
        return;
      }
      if (cell.buildingId && cell.buildingId !== '__occ__' && INTERIORS[cell.buildingId]) {
        e.preventDefault();
        hideFloatCard();
        showInterior(cell.buildingId);
        return;
      }
    }

    // Escape cancel placement
    if (e.key === 'Escape' && state.pendingBid) { e.preventDefault(); cancelPlace(); return; }

    // H key: help
    if (e.key === 'h' && !e.ctrlKey) {
      showHelp();
      return;
    }

    // M key: manual combat against adjacent monster
    if (e.key === 'm' && !e.ctrlKey) {
      const adj = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of adj) {
        const ar = state.player.r + dr, ac = state.player.c + dc;
        if (ar >= 0 && ar < MR && ac >= 0 && ac < MC) {
          const monster = state.gs.monsters && state.gs.monsters.find(m => m.r === ar && m.c === ac && m.alive);
          if (monster) {
            e.preventDefault();
            startManualCombat(monster.id);
            return;
          }
        }
      }
    }

    const key = e.key.toLowerCase();
    const arrows = {
      w: 'up', a: 'left', s: 'down', d: 'right',
      arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right'
    };
    const dir = arrows[key];
    if (!dir) return;

    e.preventDefault();
    let nr = state.player.r, nc = state.player.c;
    if (dir === 'up') nr--;
    else if (dir === 'down') nr++;
    else if (dir === 'left') nc--;
    else if (dir === 'right') nc++;

    if (nr < 0 || nr >= MR || nc < 0 || nc >= MC) return;
    const cell = state.mapData[nr][nc];

    // Terrain action: update only the affected cell
    if (cell.terrain === 'water' || cell.terrain === 'mountain') {
      // Bridges on water allow passage; ports grant nearby water walk
      const onBridge = cell.buildingId === 'bridge';
      const nearPort = (() => {
        if (cell.terrain !== 'water') return false;
        const portL = state.gs.buildings.port || 0;
        if (portL <= 0) return false;
        const range = B.port.effects(portL).waterWalk;
        for (const [k, v] of Object.entries(state.bPos)) {
          if (k.startsWith('port') && Math.abs(v.r - nr) + Math.abs(v.c - nc) <= range) return true;
        }
        return false;
      })();
      if (!onBridge && !nearPort) {
        state.selectedCell = { r: nr, c: nc };
        updateSelOverlay();
        const result = doTerrainAction(nr, nc);
        if (result) {
          updateCell(nr, nc);
          showReward(nr, nc, result.message);
          hideFloatCard();
          markWorldDirty();
        } else {
          showTerrainCard(nr, nc, cell);
        }
        return;
      }
    }

    if (cell.wall) return;

    // Check for monster at target cell
    const monster = state.gs.monsters && state.gs.monsters.find(m => m.r === nr && m.c === nc && m.alive);
    if (monster) {
      state.selectedCell = { r: nr, c: nc };
      updateSelOverlay();
      const result = resolveCombat(monster.id);
      if (result) {
        updateCell(nr, nc);
        showReward(nr, nc, result.msg);
        markWorldDirty();
        if (!result.victory) {
          hideFloatCard();
          return; // can't move into monster cell on defeat
        }
      }
    }

    // Check for treasure at target cell
    const treasure = state.gs.treasures && state.gs.treasures.find(t => t.r === nr && t.c === nc && !t.collected);
    if (treasure) {
      treasure.collected = true;
      const gold = 40 + Math.floor(Math.random() * 60);
      const gems = Math.random() < 0.3 ? Math.floor(Math.random() * 10) + 1 : 0;
      state.gs.resources.gold = (state.gs.resources.gold || 0) + gold;
      let rt = '+' + gold + 'G';
      if (gems > 0) { state.gs.resources.gems = (state.gs.resources.gems || 0) + gems; rt += ' +' + gems + '💎'; }
      addLog('🎁 发现宝箱！ ' + rt);
      updateCell(nr, nc);
      showReward(nr, nc, rt);
      markWorldDirty();
    }

    // Normal movement: no map rebuild, just move player + overlay
    // Check for ruin at target cell
    const ruin = state.gs.ruins && state.gs.ruins.find(ru => ru.r === nr && ru.c === nc && !ru.explored);
    if (ruin) {
      state.selectedCell = { r: nr, c: nc };
      updateSelOverlay();
      showFloatCard('ruin');
      return;
    }
    state.player.r = nr; state.player.c = nc;
    updatePlayerPos();
    updatePresence();
    followPlayer();
    state.selectedCell = { r: nr, c: nc };
    updateSelOverlay();
    scheduleCardUpdate();
  });
}

// ========== Help Overlay ==========

export function showHelp() {
  document.getElementById('helpOverlay').style.display = 'flex';
}

// ========== Viewport Mouse Drag & Zoom ==========

export function setupViewport() {
  const vp = document.getElementById('mapViewport');

  vp.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    setZ(state.viewZoom * (e.deltaY < 0 ? 1.12 : 0.88), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  vp.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (e.target.closest('#floatCard') || e.target.closest('.map-controls') ||
        e.target.closest('.side-panel') || e.target.closest('.shop-overlay') ||
        e.target.closest('.shop-btn') || e.target.closest('.game-overlay') ||
        e.target.closest('.game-btn') || e.target.closest('.interior-overlay')) return;
    state.isDrag = true;
    state.dMoved = false;
    state.dsX = e.clientX; state.dsY = e.clientY;
    state.dpX = state.viewPanX; state.dpY = state.viewPanY;
    vp.classList.add('dragging');
  });

  window.addEventListener('mousemove', function (e) {
    if (state.isDrag) {
      const dx = e.clientX - state.dsX, dy = e.clientY - state.dsY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.dMoved = true;
      state.viewPanX = state.dpX + dx; state.viewPanY = state.dpY + dy;
      applyT();
    }
    if (state.fcDrag) {
      const card = document.getElementById('floatCard');
      const parentRect = card.parentElement.getBoundingClientRect();
      card.style.left = (e.clientX - parentRect.left - state.fcOffX) + 'px';
      card.style.top = (e.clientY - parentRect.top - state.fcOffY) + 'px';
      card.style.bottom = 'auto';
      card.style.transform = 'none';
    }
  });

  window.addEventListener('mouseup', function (e) {
    if (state.isDrag) {
      state.isDrag = false;
      vp.classList.remove('dragging');
      if (e.target.closest('#floatCard') || e.target.closest('.map-controls') ||
          e.target.closest('.shop-overlay') || e.target.closest('.shop-btn') ||
          e.target.closest('.game-overlay') || e.target.closest('.game-btn')) return;
      if (!state.dMoved) {
        const rect = vp.getBoundingClientRect();
        const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
        const gx = (vx - state.viewPanX) / state.viewZoom;
        const gy = (vy - state.viewPanY) / state.viewZoom;
        const c = Math.floor(gx / CS), r = Math.floor(gy / CS);
        if (r >= 0 && r < MR && c >= 0 && c < MC) handleClick(r, c);
      }
    }
    state.fcDrag = false;
  });
}

// ========== Float Card Drag ==========

export function setupFloatCardDrag() {
  document.getElementById('fcDrag').addEventListener('mousedown', function (e) {
    state.fcDrag = true;
    const card = document.getElementById('floatCard');
    const rect = card.getBoundingClientRect();
    state.fcOffX = e.clientX - rect.left;
    state.fcOffY = e.clientY - rect.top;
    e.stopPropagation();
  });
}

// ========== Move Mode Toggle ==========

export function setupMoveToggle() {
  document.getElementById('moveToggle').addEventListener('click', function () {
    toggleMoveMode();
    const btn = document.getElementById('moveToggle');
    if (state.moveMode) btn.classList.add('active');
    else btn.classList.remove('active');
    renderMap();
  });
}
