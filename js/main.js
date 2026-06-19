import { B, MC, MR } from './config.js';
import { rf } from './utils.js';
import {
  state, createState, initBuildings, initState, isClaimed, addLog, saveGame, normalizeGameState
} from './state.js';
import { fullGenMap, placeBuildings, restoreBuildingsFromSave, occupyCells, genTreasures, genMonsters, genRuins } from './map.js';
import { computeProd, startTraining, upgradeHero, tickTraining } from './economy.js';
import { upgradeB, processUpgrades } from './buildings.js';
import { doTerrainAction } from './terrain.js';
import {
  toggleShop, updateShopSidebar, updateShopDot, buyBuilding,
  placeBuilding, reclaimBuilding, cancelPlace
} from './shop.js';
import { toggleGame, handleGameClick, showHint, GM } from './match3.js';
import {
  renderMap, rebuildUI, renderUpgradePanel,
  showFloatCard, hideFloatCard, showReward, spawnWorker,
  updateCell, updateWorkers, applyWorkerTransform, resourceCap
} from './renderer.js';
import {
  applyT, setZ, zoomIn, zoomOut, zoomReset, focusOnCastle,
  updatePlayerPos, followPlayer, handleClick, refreshViewportCache,
  setupKeyboard, setupViewport, setupFloatCardDrag, setupMoveToggle, updatePlayerAvatar
} from './player.js';
import { showInterior, hideInterior } from './interiors.js';
import { initMultiplayer, markWorldDirty, updatePresence } from './multiplayer.js';
import { initCharacterPicker, openCharacterPicker } from './character.js';
import { checkQuests, recordCharacterCreated } from './quests.js';
import { processMonsterWaveTick, processResourceTick, processWorldEventTick } from './systems.js';
import { initDailyTribute } from './daily.js';

// ========== Match-3 Score Conversion ==========

function convertMatchScore() {
  if (GM.manualMode && GM.manualMonsterId) {
    const manualMonsterId = GM.manualMonsterId;
    const manualScore = GM.score;
    import('./combat.js').then(m => {
      const result = m.resolveManualCombat(manualMonsterId, manualScore);
      if (result) addLog('⚔️ ' + result.msg);
      if (result && result.questChanged) handleQuestChange(true);
    });
    GM.manualMonsterId = null;
  }
  if (!GM.score) return;
  const gold = Math.floor(GM.score / 10);
  const gems = Math.floor(GM.score / 200);
  state.gs.resources.gold = (state.gs.resources.gold || 0) + gold;
  state.gs.resources.gems = (state.gs.resources.gems || 0) + gems;
  if (gold > 0) {
    addLog('🎮 消消乐得分 ' + GM.score + ' -> +' + gold + 'G' + (gems > 0 ? ' +' + gems + '💎' : ''));
    markWorldDirty();
  }
  GM.score = 0;
}

// ========== Load Game ==========

function loadGame() {
  try {
    const d = localStorage.getItem('kingdom_v13');
    if (d) {
      const data = JSON.parse(d);
      state.gs = normalizeGameState(data);
      state.cooldowns = data.cooldowns || {};
      state.firstHarvest = data.firstHarvest !== false;
      if (data.player) {
        state.player.r = data.player.r;
        state.player.c = data.player.c;
      }

      fullGenMap();
      restoreBuildingsFromSave();
      renderUpgradePanel();
      return true;
    }
  } catch (e) { console.error('loadGame error:', e); }
  return false;
}

// ========== Reset Game ==========

function resetGame() {
  if (!confirm('确认重置？')) return;
  state.gs = createState();
  initBuildings(state.gs);
  state.selectedCell = null;
  state.moveMode = false;
  state.movingBid = null;
  state.fcBid = null;
  hideFloatCard();
  state.cooldowns = {};
  state.firstHarvest = true;
  document.getElementById('workers').innerHTML = '';
  state.workers = [];
  localStorage.removeItem('kingdom_v13');
  fullGenMap();
  placeBuildings();
  genTreasures();
  genMonsters();
  state.gs.bPositions = { ...state.bPos };
  if (state.bPos.castle) {
    state.player.r = state.bPos.castle.r;
    state.player.c = state.bPos.castle.c;
  } else {
    state.player.r = Math.floor(MR / 2);
    state.player.c = Math.floor(MC / 2);
  }
  updatePlayerPos();
  focusOnCastle();
  rebuildUI();
  updateShopSidebar();
  updateShopDot();
  addLog('已重置');
  markWorldDirty();
  openCharacterPicker({ title: '创建角色', allowClose: false });
}

// ========== Prestige ==========

function doPrestige() {
  if ((state.gs.buildings.castle || 0) < B.castle.maxL) return;
  if (!confirm('确认转生？\n保留：英雄等级、装备、宝石的30%\n重置：所有建筑、资源、地图\n威望 +1，获得 +5% 产出加成')) return;

  const keepGems = Math.floor((state.gs.resources.gems || 0) * 0.3);
  const keepHero = { ...state.gs.heroes };
  const nextPrestige = (state.gs.prestige || 0) + 1;

  // Reset state
  state.gs = createState();
  initBuildings(state.gs);
  state.gs.resources.gems = keepGems;
  state.gs.heroes = keepHero;
  state.gs.prestige = nextPrestige;

  state.selectedCell = null;
  state.moveMode = false;
  state.movingBid = null;
  state.fcBid = null;
  state.cooldowns = {};
  state.firstHarvest = true;
  document.getElementById('workers').innerHTML = '';
  state.workers = [];

  fullGenMap();
  placeBuildings();
  genTreasures();
  genMonsters();
  genRuins();
  state.gs.bPositions = { ...state.bPos };
  state.player.r = state.bPos.castle ? state.bPos.castle.r : Math.floor(MR / 2);
  state.player.c = state.bPos.castle ? state.bPos.castle.c : Math.floor(MC / 2);
  updatePlayerPos();
  focusOnCastle();
  renderMap();
  rebuildUI();
  updateShopSidebar();
  updateShopDot();
  addLog('✨ 转生成功！威望等级 ' + state.gs.prestige + '（+5%产出加成）');
  markWorldDirty();
}

// ========== Float Card Button Click ==========

function fcBtnClick() {
  if (state.fcBid === 'heroThrone') {
    if (upgradeHero()) {
      addLog('英雄 -> 等级' + state.gs.heroes.barbarianKing.level);
      updateShopSidebar();
      updateShopDot();
      showFloatCard('heroThrone');
    }
  } else if (state.fcBid === 'barracks') {
    if (startTraining(5)) {
      addLog('开始训练士兵');
      rebuildUI();
      renderUpgradePanel();
      showFloatCard('barracks');
      markWorldDirty();
    } else if (upgradeB(state.fcBid)) {
      updateShopSidebar();
      updateShopDot();
      spawnWorker(state.fcBid);
      renderUpgradePanel();
      renderMap();
      markWorldDirty();
      hideFloatCard();
    }
  } else if (state.fcBid === 'C') {
    // Claim territory
    if (state.selectedCell && (state.gs.resources.gold || 0) >= 50) {
      const key = state.selectedCell.r + ',' + state.selectedCell.c;
      state.gs.claimedCells[key] = true;
      state.gs.resources.gold -= 50;
      addLog('声明了领地 (' + state.selectedCell.r + ',' + state.selectedCell.c + ')');
      updateCell(state.selectedCell.r, state.selectedCell.c);
      handleQuestChange(checkQuests());
      markWorldDirty();
      hideFloatCard();
    }
  } else if (state.fcBid && state.fcBid.length === 1) {
    if (state.selectedCell) {
      const result = doTerrainAction(state.selectedCell.r, state.selectedCell.c);
      if (result) {
        updateCell(state.selectedCell.r, state.selectedCell.c);
        showReward(state.selectedCell.r, state.selectedCell.c, result.message);
        hideFloatCard();
        handleQuestChange(result.questChanged);
        markWorldDirty();
      }
    }
  } else if (state.fcBid) {
    if (upgradeB(state.fcBid)) {
      updateShopSidebar();
      updateShopDot();
      spawnWorker(state.fcBid);
      renderUpgradePanel();
      renderMap();
      markWorldDirty();
      hideFloatCard();
    }
  }
}

// ========== Main Tick ==========

function tick() {
  state.gs.tickCount++;
  tickTraining();
  const completed = processUpgrades();

  for (const q of completed) {
    if (q.workerId != null) {
      const w = state.workers.find(wk => wk.workerId === q.workerId);
      if (w) w.phase = w.phase === 'toBuild' ? 'toHut' : 'toHut';
    }
  }
  updateWorkers();

  const prod = computeProd();
  processResourceTick(prod);
  processWorldEventTick();
  const waveResult = processMonsterWaveTick();
  if (waveResult.mapChanged) {
    renderMap();
  }
  handleQuestChange(checkQuests());

  if (completed.length) {
    renderUpgradePanel();
    renderMap();
    rebuildUI();
    updateShopSidebar();
    updateShopDot();
    markWorldDirty();
  }

  if (state.gs.tickCount % 10 === 0) {
    renderUpgradePanel();
    const keys = ['gold', 'food', 'stone', 'wood', 'soldiers', 'gems'];
    document.querySelectorAll('.res-item').forEach((el, i) => {
      const k = keys[i];
      if (!k) return;
      const ve = el.querySelector('.res-value'), re = el.querySelector('.res-rate');
      if (ve) {
        const cap = resourceCap(k);
        ve.textContent = cap ? rf(state.gs.resources[k] || 0) + '/' + rf(cap) : rf(state.gs.resources[k] || 0);
      }
      if (re) {
        const rt = prod[k] || 0;
        re.textContent = rt > 0 ? '+' + rt.toFixed(1) + '/s' : '0/s';
      }
    });
  }

  if (state.gs.tickCount % 50 === 0) {
    rebuildUI();
    updateShopSidebar();
    updateShopDot();
  }
}

// ========== Resource Bar Update (1s interval) ==========

function updateResourceBar() {
  const prod = computeProd();
  const keys = ['gold', 'food', 'stone', 'wood', 'soldiers', 'gems'];
  document.querySelectorAll('.res-item').forEach((el, i) => {
    const k = keys[i];
    if (!k) return;
    const ve = el.querySelector('.res-value'), re = el.querySelector('.res-rate');
    if (ve) {
      const cap = resourceCap(k);
      ve.textContent = cap ? rf(state.gs.resources[k] || 0) + '/' + rf(cap) : rf(state.gs.resources[k] || 0);
    }
    if (re) {
      const rt = prod[k] || 0;
      re.textContent = rt > 0 ? '+' + rt.toFixed(1) + '/s' : '0/s';
    }
  });
}

// ========== Button Wiring ==========

function setupButtons() {
  document.getElementById('shopBtn').addEventListener('click', toggleShop);
  document.querySelector('.shop-close').addEventListener('click', toggleShop);

  document.getElementById('gameBtn').addEventListener('click', function () {
    const ov = document.getElementById('gameOverlay');
    if (ov.classList.contains('show')) convertMatchScore();
    toggleGame();
  });
  document.querySelector('.game-close').addEventListener('click', function () {
    convertMatchScore();
    toggleGame();
  });
  document.getElementById('hintBtn').addEventListener('click', showHint);

  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('zoomResetBtn').addEventListener('click', zoomReset);

  document.getElementById('fcBtn').addEventListener('click', fcBtnClick);
  document.getElementById('fcClose').addEventListener('click', hideFloatCard);
  document.getElementById('fcReclaim').addEventListener('click', function () {
    reclaimBuilding();
    hideFloatCard();
    state.selectedCell = null;
    updateShopSidebar();
    updateShopDot();
    renderMap();
    markWorldDirty();
  });
  document.getElementById('fcEnter').addEventListener('click', function () {
    const bid = state.fcBid;
    if (bid) { hideFloatCard(); showInterior(bid); }
  });

  document.getElementById('saveBtn').addEventListener('click', saveGame);
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('prestigeBtn').addEventListener('click', doPrestige);

  // Dynamic shop content (event delegation)
  document.getElementById('buildShop').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const bid = btn.dataset.bid;
    if (action === 'buy') { buyBuilding(bid); markWorldDirty(); }
    else if (action === 'place') placeBuilding(bid);
    else if (action === 'cancelPlace') { e.preventDefault(); cancelPlace(); markWorldDirty(); }
  });

  // Match-3 grid click (event delegation)
  document.getElementById('gameGrid').addEventListener('click', function (e) {
    const cell = e.target.closest('.game-cell');
    if (!cell) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    if (!isNaN(r) && !isNaN(c)) handleGameClick(r, c);
  });

  // Interior overlay - close on background click
  document.getElementById('interiorOverlay').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) hideInterior();
  });
}

// ========== Start Game ==========

function startGame() {
  initState();
  const loaded = loadGame();
  if (!loaded) {
    fullGenMap();
    placeBuildings();
    genTreasures();
    genMonsters();
    genRuins();
    state.gs.bPositions = { ...state.bPos };
  }
  if (state.bPos.castle) {
    state.player.r = state.bPos.castle.r;
    state.player.c = state.bPos.castle.c;
  } else {
    state.player.r = Math.floor(MR / 2);
    state.player.c = Math.floor(MC / 2);
  }
  updatePlayerPos();
  focusOnCastle();
  applyWorkerTransform();

  setupButtons();
  setupKeyboard();
  setupViewport();
  setupFloatCardDrag();
  setupMoveToggle();
  initMultiplayer({ onSnapshotApplied: updatePlayerAvatar });
  initCharacterPicker({ onChange: function () { updatePlayerAvatar(); updatePresence(); handleQuestChange(recordCharacterCreated()); } });
  initDailyTribute({ onClaim: function () { rebuildUI(); markWorldDirty(); } });

  renderMap();
  rebuildUI();
  updateShopSidebar();
  updateShopDot();

  // Tutorial for new players
  if (!loaded) {
    addLog('👋 欢迎来到王国崛起！WASD移动，采集资源，建造王国');
    addLog('💡 提示：建造农场和金矿来获取稳定收入');
    openCharacterPicker({ title: '创建角色', allowClose: false });
  }

  refreshViewportCache();
  window.addEventListener('resize', refreshViewportCache);

  setInterval(tick, 100);
  setInterval(saveGame, 30000);
  setInterval(updateResourceBar, 1000);
  setInterval(function () { markWorldDirty(); updatePresence(); }, 5000);
}

window.addEventListener('DOMContentLoaded', startGame);

function handleQuestChange(changed) {
  if (!changed) return;
  rebuildUI();
  updateShopSidebar();
  updateShopDot();
  markWorldDirty();
}
