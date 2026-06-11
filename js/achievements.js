import { state, addLog } from './state.js';

const ACHIEVEMENTS = [
  { id: 'tree10', name: '伐木工', desc: '砍伐 10 棵树', check(a) { return a.trees >= 10; }, reward: { gold: 50 } },
  { id: 'tree50', name: '森林守护者', desc: '砍伐 50 棵树', check(a) { return a.trees >= 50; }, reward: { gems: 10 } },
  { id: 'stone20', name: '矿工', desc: '采集 20 次石料', check(a) { return a.stone >= 20; }, reward: { gold: 80 } },
  { id: 'fish30', name: '渔夫', desc: '钓鱼 30 次', check(a) { return a.fish >= 30; }, reward: { food: 100 } },
  { id: 'kill5', name: '猎手', desc: '击败 5 只怪物', check(a) { return a.kills >= 5; }, reward: { gems: 15 } },
  { id: 'kill20', name: '屠魔者', desc: '击败 20 只怪物', check(a) { return a.kills >= 20; }, reward: { gems: 50 } },
  { id: 'build10', name: '建筑师', desc: '建造 10 座建筑', check(a) { return a.buildings >= 10; }, reward: { gold: 200 } },
  { id: 'castle5', name: '城主', desc: '城堡达到 Lv5', check() { return (state.gs.buildings.castle || 0) >= 5; }, reward: { gems: 30 } },
  { id: 'castle10', name: '国王', desc: '城堡达到 Lv10', check() { return (state.gs.buildings.castle || 0) >= 10; }, reward: { gems: 100 } },
  { id: 'gold1k', name: '富翁', desc: '金币达到 1000', check() { return (state.gs.resources.gold || 0) >= 1000; }, reward: { gems: 5 } },
  { id: 'gold10k', name: '巨富', desc: '金币达到 10000', check() { return (state.gs.resources.gold || 0) >= 10000; }, reward: { gems: 30 } },
  { id: 'bestiaryAll', name: '怪物学家', desc: '击败全部 4 种普通怪物', check() { return ['wolf','serpent','golem','bandit'].every(t => state.gs.bestiary.includes(t)); }, reward: { gems: 50 } }
];

export function checkAchievements() {
  const a = state.gs.achievements;
  const labels = { gold: 'G', food: 'F', gems: '💎' };
  for (const ach of ACHIEVEMENTS) {
    if (a.unlocked.includes(ach.id)) continue;
    if (ach.check(a)) {
      a.unlocked.push(ach.id);
      for (const [k, v] of Object.entries(ach.reward)) {
        state.gs.resources[k] = (state.gs.resources[k] || 0) + v;
      }
      const rewards = Object.entries(ach.reward).map(([k, v]) => '+' + v + (labels[k] || k)).join(' ');
      addLog('🏆 成就解锁：' + ach.name + '！ ' + rewards);
    }
  }
}

export function trackTree() { state.gs.achievements.trees++; checkAchievements(); }
export function trackStone() { state.gs.achievements.stone++; checkAchievements(); }
export function trackFish() { state.gs.achievements.fish++; checkAchievements(); }
export function trackKill() { state.gs.achievements.kills++; checkAchievements(); }
export function trackBuild() { state.gs.achievements.buildings++; checkAchievements(); }
