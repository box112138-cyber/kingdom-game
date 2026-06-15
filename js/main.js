import { B, MC, MR } from './config.js';
import { rf } from './utils.js';
import {
  state, createState, initBuildings, initState, isClaimed, addLog, saveGame
} from './state.js';
import { fullGenMap, placeBuildings, restoreBuildingsFromSave, occupyCells, genTreasures, genMonsters, genWaveMonsters, genRuins } from './map.js';
import {
  computeProd, goldCap, foodCap, stoneCap, maxPop, power,
  upgradeHero, tickTraining
} from './economy.js';
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
  updateCell, updateWorkers, applyWorkerTransform
} from './renderer.js';
import {
  applyT, setZ, zoomIn, zoomOut, zoomReset, focusOnCastle,
  updatePlayerPos, followPlayer, handleClick, refreshViewportCache,
  setupKeyboard, setupViewport, setupFloatCardDrag, setupMoveToggle
} from './player.js';
import { showInterior, hideInterior } from './interiors.js';
import { initMultiplayer, markWorldDirty, updatePresence } from './multiplayer.js';

// ========== Match-3 Score Conversion ==========

function convertMatchScore() {
  if (GM.manualMode && GM.manualMonsterId) {
    // Manual combat: score becomes damage
    import('./combat.js').then(m => {
      const result = m.resolveManualCombat(GM.manualMonsterId, GM.score);
      if (result) addLog('⚔️ ' + result.msg);
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

// ========== Weather & Day-Night ==========

const WEATHERS = [
  { name: '晴天', icon: '☀️', foodMult: 1.0, goldMult: 1.0, effect: '' },
  { name: '多云', icon: '⛅', foodMult: 1.1, goldMult: 0.9, effect: '粮食+10%' },
  { name: '雨天', icon: '🌧️', foodMult: 1.3, goldMult: 0.8, effect: '粮食+30% 金币-20%' },
  { name: '风暴', icon: '⛈️', foodMult: 0.7, goldMult: 0.7, effect: '产出-30%' }
];

function weatherLabel() {
  const idx = Math.floor(state.gs.tickCount / 1800) % WEATHERS.length; // changes every 1800 ticks (3min)
  return WEATHERS[idx];
}

function isNight() {
  return (Math.floor(state.gs.tickCount / 6000) % 2) === 1; // 6000 ticks = 10min day, 10min night
}

// ========== Random Events ==========

function triggerRandomEvent() {
  const events = [
    { msg: '🎉 丰收！粮食 +50', apply() { state.gs.resources.food = (state.gs.resources.food || 0) + 50; } },
    { msg: '💰 商人来访！金币 +80', apply() { state.gs.resources.gold = (state.gs.resources.gold || 0) + 80; } },
    { msg: '👥 难民涌入！+5 人口上限（临时）', apply() {} },
    { msg: '💎 矿脉发现！宝石 +5', apply() { state.gs.resources.gems = (state.gs.resources.gems || 0) + 5; state.gs.resources.stone = (state.gs.resources.stone || 0) + 20; } },
    { msg: '🐺 野狼出没！损失 5 粮食', apply() { state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - 5); } },
    { msg: '🔥 火灾！损失 30 木材', apply() { state.gs.resources.wood = Math.max(0, (state.gs.resources.wood || 0) - 30); } },
    { msg: '⚡ 雷暴中……士兵士气下降', apply() {} }
  ];
  const evt = events[Math.floor(Math.random() * events.length)];
  evt.apply();
  return evt.msg;
}

// ========== Load Game ==========

function loadGame() {
  try {
    const d = localStorage.getItem('kingdom_v13');
    if (d) {
      const data = JSON.parse(d);
      state.gs = Object.assign(createState(), data);
      initBuildings(state.gs);
      state.gs.claimedCells = state.gs.claimedCells || {};
      state.gs.bPositions = state.gs.bPositions || {};
      state.gs.trainQueue = state.gs.trainQueue || { count: 0, total: 0, ticks: 0, level: 1 };
      state.gs.heroes = state.gs.heroes || { barbarianKing: { level: 1, equipment: { weapon: null, armor: null, ring: null } } };
      state.gs.walls = state.gs.walls || 0;
      state.gs.resources.gems = state.gs.resources.gems || 0;
      state.gs.upgradeQueue = state.gs.upgradeQueue || [];
      state.gs.collectedItems = state.gs.collectedItems || [];
      state.gs.inventory = state.gs.inventory || {};
      state.gs.treasures = state.gs.treasures || [];
      state.gs.monsters = state.gs.monsters || [];
      state.gs.bestiary = state.gs.bestiary || [];
      state.gs.achievements = state.gs.achievements || { trees: 0, stone: 0, fish: 0, kills: 0, buildings: 0, unlocked: [] };
      state.gs.ruins = state.gs.ruins || [];
      state.gs.prestige = state.gs.prestige || 0;
      state.cooldowns = state.gs.cooldowns || {};
      state.firstHarvest = state.gs.firstHarvest !== false;
      if (state.gs.player) {
        state.player.r = state.gs.player.r;
        state.player.c = state.gs.player.c;
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
  } else if (state.fcBid === 'C') {
    // Claim territory
    if (state.selectedCell && (state.gs.resources.gold || 0) >= 50) {
      const key = state.selectedCell.r + ',' + state.selectedCell.c;
      state.gs.claimedCells[key] = true;
      state.gs.resources.gold -= 50;
      addLog('声明了领地 (' + state.selectedCell.r + ',' + state.selectedCell.c + ')');
      updateCell(state.selectedCell.r, state.selectedCell.c);
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
  const ad = (k, a, m) => {
    const c = state.gs.resources[k] || 0;
    state.gs.resources[k] = Math.min(c + a, m);
  };
  ad('gold', prod.gold / 10, goldCap());
  ad('food', prod.food / 10, foodCap());
  ad('stone', prod.stone / 10, stoneCap());
  // gems have no cap, accumulate directly
  if (prod.gems) state.gs.resources.gems = (state.gs.resources.gems || 0) + prod.gems / 10;
  // Weather modifier on food
  const w = weatherLabel();
  if (w.foodMult !== 1.0) {
    const delta = (prod.food / 10) * (w.foodMult - 1.0);
    state.gs.resources.food = Math.max(0, Math.min(foodCap(), (state.gs.resources.food || 0) + delta));
  }
  // Day/night: gold -20% at night
  if (isNight()) {
    state.gs.resources.gold = Math.max(0, (state.gs.resources.gold || 0) - (prod.gold / 10) * 0.2);
  }
  // Random events: every 2000-5000 ticks
  if (state.gs.tickCount % (2000 + Math.floor(Math.random() * 3000)) === 1) {
    const msg = triggerRandomEvent();
    addLog(msg);
  }
  // Weather change notification
  if (state.gs.tickCount % 1800 === 0) {
    const w2 = weatherLabel();
    addLog(w2.icon + ' 天气转为：' + w2.name + (w2.effect ? ' (' + w2.effect + ')' : ''));
  }
  // Day/night transition
  if (state.gs.tickCount % 6000 === 0 && state.gs.tickCount > 0) {
    addLog(isNight() ? '🌙 夜幕降临……' : '☀️ 天亮了！');
  }
  // Defense waves: every 600 ticks (60s), with warning
  const watchL = state.gs.buildings.watchtower || 0;
  const alertOffset = watchL > 0 ? 100 * watchL : 100;
  if (state.gs.tickCount % 600 === 600 - alertOffset) {
    addLog('⚠️ 警报：怪物即将来袭！' + (alertOffset / 10).toFixed(0) + '秒后到达');
  }
  if (state.gs.tickCount % 600 === 0 && state.gs.tickCount > 0) {
    const waveSize = 2 + Math.floor(state.gs.tickCount / 6000);
    genWaveMonsters(waveSize);
    addLog('⚔️ 第' + Math.floor(state.gs.tickCount / 600) + '波怪物来袭！(' + waveSize + '只)');
    renderMap();
  }
  // soldiers consume food
  const soldiers = state.gs.resources.soldiers || 0;
  if (soldiers > 0) {
    const foodCost = soldiers * 0.005; // 0.05 per sec, per 100ms = 0.005
    state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - foodCost);
    if (state.gs.resources.food <= 0 && soldiers > 0) {
      // no food, soldiers desert
      const desert = Math.max(1, Math.floor(soldiers * 0.1));
      state.gs.resources.soldiers -= desert;
      if (state.gs.tickCount % 50 === 0) addLog('🍞 缺粮！' + desert + '名士兵逃跑了');
    }
  }

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
      if (ve) ve.textContent = rf(state.gs.resources[k] || 0);
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
    if (ve) ve.textContent = rf(state.gs.resources[k] || 0);
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

  document.getElementById('buyQtyDec').addEventListener('click', function () {
    state.buyQty = Math.max(1, Math.min(99, state.buyQty - 1));
    updateShopSidebar();
  });
  document.getElementById('buyQtyInc').addEventListener('click', function () {
    state.buyQty = Math.max(1, Math.min(99, state.buyQty + 1));
    updateShopSidebar();
  });
  document.getElementById('buyWallBtn').addEventListener('click', function () {
    const cost = 100 * state.buyQty;
    if ((state.gs.resources.gold || 0) < cost) return;
    state.gs.resources.gold -= cost;
    state.gs.walls += state.buyQty;
    addLog('购买了' + state.buyQty + '个城墙');
    updateShopSidebar();
    markWorldDirty();
  });

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
  initMultiplayer();

  renderMap();
  rebuildUI();
  updateShopSidebar();
  updateShopDot();

  // Tutorial for new players
  if (!loaded) {
    addLog('👋 欢迎来到王国崛起！WASD移动，采集资源，建造王国');
    addLog('💡 提示：建造农场和金矿来获取稳定收入');
  }

  refreshViewportCache();
  window.addEventListener('resize', refreshViewportCache);

  setInterval(tick, 100);
  setInterval(saveGame, 30000);
  setInterval(updateResourceBar, 1000);
  setInterval(function () { markWorldDirty(); updatePresence(); }, 5000);
}

window.addEventListener('DOMContentLoaded', startGame);
