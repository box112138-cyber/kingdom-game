import { state, addLog } from './state.js';
import { addSoldiers, foodCap, gemCap, goldCap, maxPop, power, stoneCap, woodCap } from './economy.js';
import { genWaveMonsters } from './map.js';

const WEATHERS = [
  { name: '晴天', icon: '☀️', foodMult: 1.0, goldMult: 1.0, effect: '' },
  { name: '多云', icon: '⛅', foodMult: 1.1, goldMult: 0.9, effect: '粮食+10%' },
  { name: '雨天', icon: '🌧️', foodMult: 1.3, goldMult: 0.8, effect: '粮食+30% 金币-20%' },
  { name: '风暴', icon: '⛈️', foodMult: 0.7, goldMult: 0.7, effect: '产出-30%' }
];

const RANDOM_EVENTS = [
  { apply() { state.gs.resources.food = (state.gs.resources.food || 0) + 50; return '🎉 丰收！粮食 +50'; } },
  { apply() { state.gs.resources.gold = (state.gs.resources.gold || 0) + 80; return '💰 商人来访！金币 +80'; } },
  { apply() { return '👥 难民加入！士兵 +' + addSoldiers(2); } },
  { apply() { state.gs.resources.gems = (state.gs.resources.gems || 0) + 5; state.gs.resources.stone = (state.gs.resources.stone || 0) + 20; return '💎 矿脉发现！宝石 +5 石料 +20'; } },
  { apply() { state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - 5); return '🐺 野狼出没！损失 5 粮食'; } },
  { apply() { state.gs.resources.wood = Math.max(0, (state.gs.resources.wood || 0) - 30); return '🔥 火灾！损失 30 木材'; } },
  { apply() { state.gs.resources.soldiers = Math.max(0, (state.gs.resources.soldiers || 0) - 1); return '⚡ 雷暴惊扰军营，士兵 -1'; } }
];

let nextEventTick = 2500;

export function processResourceTick(prod) {
  const weather = weatherLabel();
  addResource('gold', (prod.gold * weather.goldMult) / 10, goldCap());
  addResource('food', (prod.food * weather.foodMult) / 10, foodCap());
  addResource('stone', prod.stone / 10, stoneCap());
  addResource('wood', prod.wood / 10, woodCap());
  addResource('soldiers', prod.soldiers / 10, maxPop());
  addResource('gems', prod.gems / 10, gemCap());

  if (isNight()) {
    state.gs.resources.gold = Math.max(0, (state.gs.resources.gold || 0) - (prod.gold / 10) * 0.2);
  }

  processSoldierFoodTick();
}

export function processWorldEventTick() {
  if (state.gs.tickCount >= nextEventTick) {
    const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    addLog(event.apply());
    nextEventTick = state.gs.tickCount + 2000 + Math.floor(Math.random() * 3000);
  }

  if (state.gs.tickCount % 1800 === 0) {
    const weather = weatherLabel();
    addLog(weather.icon + ' 天气转为：' + weather.name + (weather.effect ? ' (' + weather.effect + ')' : ''));
  }

  if (state.gs.tickCount % 6000 === 0 && state.gs.tickCount > 0) {
    addLog(isNight() ? '🌙 夜幕降临……' : '☀️ 天亮了！');
  }
}

export function processMonsterWaveTick() {
  const watchLevel = state.gs.buildings.watchtower || 0;
  const alertOffset = Math.min(500, watchLevel > 0 ? 100 * watchLevel : 100);
  if (state.gs.tickCount % 600 === 600 - alertOffset) {
    addLog('⚠️ 警报：怪物即将来袭！' + (alertOffset / 10).toFixed(0) + '秒后到达');
  }
  let mapChanged = false;
  if (state.gs.tickCount % 20 === 0) mapChanged = moveWaveMonsters() || mapChanged;
  if (state.gs.tickCount % 600 === 0 && state.gs.tickCount > 0) {
    const waveSize = 2 + Math.floor(state.gs.tickCount / 6000);
    const wave = genWaveMonsters(waveSize);
    if (wave.count > 0) {
      addLog('⚔️ 第' + Math.floor(state.gs.tickCount / 600) + '波怪物从' + wave.directions.join('、') + '来袭！(' + wave.count + '只)');
      mapChanged = true;
    } else {
      addLog('⚔️ 远方有怪物活动，但没有找到可进入王国的路线');
    }
  }
  return { mapChanged };
}

function moveWaveMonsters() {
  if (!state.bPos.castle || !state.gs.monsters) return false;
  let changed = false;
  const castle = state.bPos.castle;
  for (const monster of state.gs.monsters) {
    if (!monster.alive || !monster.wave) continue;
    const dist = Math.abs(monster.r - castle.r) + Math.abs(monster.c - castle.c);
    if (dist <= 1) {
      resolveWaveAttack(monster);
      changed = true;
      continue;
    }
    const next = nextStepToward(monster.r, monster.c, castle.r, castle.c);
    if (!next) continue;
    monster.r = next.r;
    monster.c = next.c;
    changed = true;
  }
  return changed;
}

function nextStepToward(r, c, targetR, targetC) {
  const candidates = [
    { r: r + Math.sign(targetR - r), c },
    { r, c: c + Math.sign(targetC - c) },
    { r: r - Math.sign(targetR - r), c },
    { r, c: c - Math.sign(targetC - c) }
  ];
  let best = null;
  let bestDist = Infinity;
  for (const pos of candidates) {
    if (!state.mapData[pos.r] || !state.mapData[pos.r][pos.c]) continue;
    const cell = state.mapData[pos.r][pos.c];
    if (cell.terrain === 'water' || cell.buildingId || cell.wall) continue;
    const occupied = state.gs.monsters.some(m => m.alive && m.r === pos.r && m.c === pos.c);
    if (occupied) continue;
    const dist = Math.abs(pos.r - targetR) + Math.abs(pos.c - targetC);
    if (dist < bestDist) { best = pos; bestDist = dist; }
  }
  return best;
}

function resolveWaveAttack(monster) {
  monster.alive = false;
  const defense = power();
  const loss = Math.max(5, Math.floor(40 - defense * 0.15));
  state.gs.resources.gold = Math.max(0, (state.gs.resources.gold || 0) - loss);
  state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - Math.floor(loss / 2));
  addLog('🚨 来袭怪物突破到城堡附近，造成损失：-' + loss + 'G -' + Math.floor(loss / 2) + 'F');
}

function addResource(key, amount, maxValue) {
  const current = state.gs.resources[key] || 0;
  state.gs.resources[key] = Math.min(current + amount, maxValue);
}


function weatherLabel() {
  const idx = Math.floor(state.gs.tickCount / 1800) % WEATHERS.length;
  return WEATHERS[idx];
}

function isNight() {
  return (Math.floor(state.gs.tickCount / 6000) % 2) === 1;
}

function processSoldierFoodTick() {
  const soldiers = state.gs.resources.soldiers || 0;
  if (soldiers <= 0) return;
  const foodCost = soldiers * 0.005;
  state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - foodCost);
  if (state.gs.resources.food <= 0) {
    const desert = Math.max(1, Math.floor(soldiers * 0.1));
    state.gs.resources.soldiers -= desert;
    if (state.gs.tickCount % 50 === 0) addLog('🍞 缺粮！' + desert + '名士兵逃跑了');
  }
}
