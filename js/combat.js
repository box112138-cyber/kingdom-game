import { MONSTERS } from './config.js';
import { B } from './config.js';
import { state, addLog } from './state.js';
import { addSoldiers, getHeroStats } from './economy.js';
import { trackKill } from './achievements.js';
import { recordMonsterDefeated } from './quests.js';

// === Bestiary tracking ===

function dropEquipment(bossType) {
  const eq = state.gs.heroes.barbarianKing.equipment;
  const drops = {
    dragon: { weapon: { name: '龙牙剑', atk: 15, icon: '🗡️' }, armor: { name: '龙鳞甲', def: 10, icon: '🛡️' } },
    titan:  { weapon: { name: '巨人锤', atk: 20, icon: '🔨' }, ring: { name: '力量戒', hp: 80, icon: '💍' } },
    wraith: { armor: { name: '幽灵披风', def: 12, icon: '👘' }, ring: { name: '灵魂戒', hp: 60, icon: '💍' } }
  };
  const bossDrops = drops[bossType];
  if (!bossDrops) return;
  const keys = Object.keys(bossDrops);
  const slot = keys[Math.floor(Math.random() * keys.length)];
  const item = bossDrops[slot];
  if (eq[slot]) {
    // Replace existing equipment
    const old = eq[slot];
    eq[slot] = item;
    addLog('⚔️ 获得 ' + item.icon + ' ' + item.name + '（替换了' + old.name + '）');
  } else {
    eq[slot] = item;
    addLog('⚔️ 获得装备：' + item.icon + ' ' + item.name);
  }
}

function addToBestiary(monsterType) {
  if (!state.gs.bestiary) state.gs.bestiary = [];
  if (!state.gs.bestiary.includes(monsterType)) {
    state.gs.bestiary.push(monsterType);
    const def = MONSTERS[monsterType];
    // Check for collection rewards
    const regularDefeated = ['wolf', 'serpent', 'golem', 'bandit'].filter(t => state.gs.bestiary.includes(t));
    const bossDefeated = ['dragon', 'titan', 'wraith'].filter(t => state.gs.bestiary.includes(t));

    if (regularDefeated.length === 4) {
      state.gs.resources.gems = (state.gs.resources.gems || 0) + 50;
      addLog('🏆 图鉴完成：已击败全部普通怪物！ +50💎');
    }
    if (bossDefeated.length === 3) {
      state.gs.resources.gems = (state.gs.resources.gems || 0) + 200;
      addLog('👑 图鉴完成：已击败全部 Boss！ +200💎');
    }
  }
}

function grantRewards(rewards) {
  const actual = {};
  for (const [key, value] of Object.entries(rewards)) {
    if (key === 'soldiers') actual[key] = addSoldiers(value);
    else {
      state.gs.resources[key] = (state.gs.resources[key] || 0) + value;
      actual[key] = value;
    }
  }
  return actual;
}

// === Combat Resolution ===

// Returns: { victory: bool, msg: string, rewards: object }
export function resolveCombat(monsterId) {
  const monster = state.gs.monsters.find(m => m.id === monsterId);
  if (!monster || !monster.alive) return null;
  const def = MONSTERS[monster.type];
  if (!def) return null;

  const hero = getHeroStats();
  const soldiers = state.gs.resources.soldiers || 0;

  // Player power
  const heroPower = hero.atk * 2;
  const armyPower = soldiers * 1;
  const totalPower = heroPower + armyPower;

  // Monster stats
  const monsterHP = monster.hp;
  const monsterAtk = def.atk;
  const monsterDef = def.def;

  // Damage calculations
  const dmgToMonster = Math.max(1, totalPower - monsterDef);
  const dmgToPlayer = Math.max(1, monsterAtk - hero.def);

  // Determine victory
  const victory = dmgToMonster >= monsterHP;

  // Calculate soldier losses (proportional to damage taken)
  let soldierLoss = 0;
  if (soldiers > 0) {
    const lossRatio = Math.min(0.3, dmgToPlayer / Math.max(1, heroPower + armyPower));
    soldierLoss = Math.max(0, Math.floor(soldiers * lossRatio));
    // Hospital saves soldiers
    const hospL = state.gs.buildings.hospital || 0;
    if (hospL > 0) {
      const saved = Math.floor(soldierLoss * B.hospital.effects(hospL).soldierSave);
      soldierLoss -= saved;
    }
  }

  // Apply results
  if (victory) {
    monster.alive = false;
    addToBestiary(monster.type);
    trackKill();
    // Boss drops equipment
    if (def.boss) dropEquipment(monster.type);
    if (soldierLoss > 0) {
      state.gs.resources.soldiers = Math.max(0, soldiers - soldierLoss);
    }
    // Grant rewards
    const rewards = grantRewards({ ...def.reward });
    const labels = { gold: 'G', food: 'F', wood: 'W', stone: 'S', gems: '💎' };
    const rewardStr = Object.entries(rewards).map(([k, v]) => '+' + v + (labels[k] || k)).join(' ');
    const lossStr = soldierLoss > 0 ? ' 阵亡' + soldierLoss + '兵' : '';
    addLog('⚔️ 击败' + def.name + '！ ' + rewardStr + lossStr);
    return { victory: true, msg: '击败' + def.name + '！' + rewardStr + lossStr, rewards };
  } else {
    monster.hp = Math.max(1, monster.hp - dmgToMonster);
    const loss = Math.max(1, Math.floor(soldiers * 0.2));
    state.gs.resources.soldiers = Math.max(0, soldiers - loss);
    addLog('💀 击伤' + def.name + '，剩余HP:' + monster.hp + '，损失' + loss + '兵');
    return { victory: false, msg: '击伤' + def.name + ' 剩余HP:' + monster.hp + ' 损失' + loss + '兵', rewards: {} };
  }
}

// === Manual Combat (match-3) ===

export function resolveManualCombat(monsterId, score) {
  const monster = state.gs.monsters.find(m => m.id === monsterId);
  if (!monster || !monster.alive) return null;
  const def = MONSTERS[monster.type];
  const dmg = Math.floor(score / 5);
  if (dmg >= monster.hp) {
    monster.alive = false;
    addToBestiary(monster.type);
    trackKill();
    if (def.boss) dropEquipment(monster.type);
    const rewards = grantRewards({ ...def.reward });
    const labels = { gold: 'G', food: 'F', wood: 'W', stone: 'S', gems: '💎' };
    const rewardStr = Object.entries(rewards).map(([k, v]) => '+' + v + (labels[k] || k)).join(' ');
    addLog('🎮 三消击败' + def.name + '！伤害' + dmg + ' ' + rewardStr);
    const questChanged = recordMonsterDefeated();
    return { victory: true, msg: '三消击败' + def.name + '！' + rewardStr, questChanged };
  } else {
    monster.hp -= dmg;
    addLog('🎮 三消对' + def.name + '造成' + dmg + '伤害（剩余HP:' + monster.hp + '）');
    return { victory: false, msg: '造成' + dmg + '伤害，剩余HP:' + monster.hp };
  }
}
