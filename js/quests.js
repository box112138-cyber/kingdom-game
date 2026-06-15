import { state, addLog, createQuestState } from './state.js';

export const QUESTS = [
  { id: 'create_character', title: '创建角色', desc: '选择你的王国化身', type: 'characterCreated', target: 1, reward: { gold: 80 } },
  { id: 'gather_wood', title: '砍伐树木', desc: '砍伐 1 棵树获取木材', type: 'harvest', terrain: 'tree', target: 1, reward: { wood: 30 } },
  { id: 'claim_land', title: '扩张领土', desc: '声明 1 块领地', type: 'claimedCells', target: 1, reward: { gold: 120 } },
  { id: 'place_building', title: '添置建筑', desc: '购买并放置 1 座新建筑', type: 'buildingPlaced', target: 1, reward: { food: 80, stone: 30 } },
  { id: 'defeat_monster', title: '守护王国', desc: '击败 1 只怪物', type: 'monsterDefeated', target: 1, reward: { gold: 180, gems: 5 } },
  { id: 'save_gold', title: '积累财富', desc: '金币达到 1000', type: 'resource', resource: 'gold', target: 1000, reward: { gems: 10 } }
];

export function ensureQuests() {
  if (!state.gs.quests) state.gs.quests = createQuestState();
  if (!state.gs.quests.stats) state.gs.quests.stats = createQuestState().stats;
  if (!state.gs.quests.stats.harvests) state.gs.quests.stats.harvests = createQuestState().stats.harvests;
  updateActiveQuests(state.gs.quests);
}

export function getVisibleQuests() {
  ensureQuests();
  return state.gs.quests.active.map(id => QUESTS.find(q => q.id === id)).filter(Boolean);
}

export function getQuestProgress(quest) {
  ensureQuests();
  const stats = state.gs.quests.stats;
  if (quest.type === 'characterCreated') return stats.characterCreated ? 1 : 0;
  if (quest.type === 'harvest') return stats.harvests[quest.terrain] || 0;
  if (quest.type === 'claimedCells') return Object.keys(state.gs.claimedCells || {}).length;
  if (quest.type === 'buildingPlaced') return stats.buildingsPlaced || 0;
  if (quest.type === 'monsterDefeated') return stats.monstersDefeated || 0;
  if (quest.type === 'resource') return Math.floor(state.gs.resources[quest.resource] || 0);
  return 0;
}

export function checkQuests() {
  ensureQuests();
  let changed = false;
  for (const quest of getVisibleQuests()) {
    if (state.gs.quests.completed.includes(quest.id)) continue;
    if (getQuestProgress(quest) < quest.target) continue;
    completeQuest(quest);
    changed = true;
  }
  if (changed) updateActiveQuests(state.gs.quests);
  return changed;
}

export function recordCharacterCreated() {
  ensureQuests();
  state.gs.quests.stats.characterCreated = true;
  return checkQuests();
}

export function recordHarvest(terrain) {
  ensureQuests();
  if (state.gs.quests.stats.harvests[terrain] == null) state.gs.quests.stats.harvests[terrain] = 0;
  state.gs.quests.stats.harvests[terrain]++;
  return checkQuests();
}

export function recordBuildingPlaced() {
  ensureQuests();
  state.gs.quests.stats.buildingsPlaced++;
  return checkQuests();
}

export function recordMonsterDefeated() {
  ensureQuests();
  state.gs.quests.stats.monstersDefeated++;
  return checkQuests();
}

export function recordTreasureFound() {
  ensureQuests();
  state.gs.quests.stats.treasuresFound++;
  return checkQuests();
}

function completeQuest(quest) {
  state.gs.quests.completed.push(quest.id);
  state.gs.quests.active = state.gs.quests.active.filter(id => id !== quest.id);
  for (const [key, value] of Object.entries(quest.reward || {})) {
    state.gs.resources[key] = (state.gs.resources[key] || 0) + value;
  }
  addLog('📜 任务完成：' + quest.title + rewardText(quest.reward));
}

function updateActiveQuests(questState) {
  const completed = new Set(questState.completed || []);
  const active = (questState.active || []).filter(id => !completed.has(id) && QUESTS.some(q => q.id === id));
  for (const quest of QUESTS) {
    if (active.length >= 3) break;
    if (!completed.has(quest.id) && !active.includes(quest.id)) active.push(quest.id);
  }
  questState.active = active;
}

function rewardText(reward) {
  const entries = Object.entries(reward || {});
  if (!entries.length) return '';
  const labels = { gold: 'G', food: 'F', wood: 'W', stone: 'S', gems: '💎' };
  return ' +' + entries.map(([key, value]) => value + (labels[key] || key)).join(' +');
}
