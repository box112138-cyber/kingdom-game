import { state, addLog } from './state.js';
import { foodCap, goldCap, stoneCap } from './economy.js';
import { genWaveMonsters } from './map.js';

const WEATHERS = [
  { name: '晴天', icon: '☀️', foodMult: 1.0, goldMult: 1.0, effect: '' },
  { name: '多云', icon: '⛅', foodMult: 1.1, goldMult: 0.9, effect: '粮食+10%' },
  { name: '雨天', icon: '🌧️', foodMult: 1.3, goldMult: 0.8, effect: '粮食+30% 金币-20%' },
  { name: '风暴', icon: '⛈️', foodMult: 0.7, goldMult: 0.7, effect: '产出-30%' }
];

const RANDOM_EVENTS = [
  { msg: '🎉 丰收！粮食 +50', apply() { state.gs.resources.food = (state.gs.resources.food || 0) + 50; } },
  { msg: '💰 商人来访！金币 +80', apply() { state.gs.resources.gold = (state.gs.resources.gold || 0) + 80; } },
  { msg: '👥 难民涌入！+5 人口上限（临时）', apply() {} },
  { msg: '💎 矿脉发现！宝石 +5', apply() { state.gs.resources.gems = (state.gs.resources.gems || 0) + 5; state.gs.resources.stone = (state.gs.resources.stone || 0) + 20; } },
  { msg: '🐺 野狼出没！损失 5 粮食', apply() { state.gs.resources.food = Math.max(0, (state.gs.resources.food || 0) - 5); } },
  { msg: '🔥 火灾！损失 30 木材', apply() { state.gs.resources.wood = Math.max(0, (state.gs.resources.wood || 0) - 30); } },
  { msg: '⚡ 雷暴中……士兵士气下降', apply() {} }
];

export function processResourceTick(prod) {
  addResource('gold', prod.gold / 10, goldCap());
  addResource('food', prod.food / 10, foodCap());
  addResource('stone', prod.stone / 10, stoneCap());
  if (prod.gems) state.gs.resources.gems = (state.gs.resources.gems || 0) + prod.gems / 10;

  const weather = weatherLabel();
  if (weather.foodMult !== 1.0) {
    const delta = (prod.food / 10) * (weather.foodMult - 1.0);
    state.gs.resources.food = Math.max(0, Math.min(foodCap(), (state.gs.resources.food || 0) + delta));
  }

  if (isNight()) {
    state.gs.resources.gold = Math.max(0, (state.gs.resources.gold || 0) - (prod.gold / 10) * 0.2);
  }

  processSoldierFoodTick();
}

export function processWorldEventTick() {
  if (state.gs.tickCount % (2000 + Math.floor(Math.random() * 3000)) === 1) {
    const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    event.apply();
    addLog(event.msg);
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
  const alertOffset = watchLevel > 0 ? 100 * watchLevel : 100;
  if (state.gs.tickCount % 600 === 600 - alertOffset) {
    addLog('⚠️ 警报：怪物即将来袭！' + (alertOffset / 10).toFixed(0) + '秒后到达');
  }
  if (state.gs.tickCount % 600 === 0 && state.gs.tickCount > 0) {
    const waveSize = 2 + Math.floor(state.gs.tickCount / 6000);
    genWaveMonsters(waveSize);
    addLog('⚔️ 第' + Math.floor(state.gs.tickCount / 600) + '波怪物来袭！(' + waveSize + '只)');
    return { mapChanged: true };
  }
  return { mapChanged: false };
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
