import { state, addLog, saveGame } from './state.js';
import { addSoldiers } from './economy.js';

const DAILY_REWARDS = [
  { gold: 120, food: 60 },
  { gold: 160, wood: 35 },
  { gold: 200, stone: 30 },
  { food: 140, wood: 45 },
  { gold: 260, gems: 5 },
  { stone: 70, soldiers: 2 },
  { gold: 420, gems: 12 }
];

const LABELS = { gold: 'G', food: 'F', wood: 'W', stone: 'S', soldiers: '兵', gems: '💎' };

export function initDailyTribute(options = {}) {
  const btn = document.getElementById('dailyBtn');
  if (!btn) return;
  const refresh = () => updateDailyButton(btn);
  btn.addEventListener('click', function () {
    if (claimDailyTribute()) {
      refresh();
      if (typeof options.onClaim === 'function') options.onClaim();
    }
  });
  refresh();
}

export function claimDailyTribute(now = new Date()) {
  ensureDaily();
  const today = dayKey(now);
  if (state.gs.daily.lastClaim === today) {
    addLog('今日贡品已领取');
    return false;
  }

  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const nextStreak = state.gs.daily.lastClaim === yesterday ? state.gs.daily.streak + 1 : 1;
  const reward = DAILY_REWARDS[(nextStreak - 1) % DAILY_REWARDS.length];
  for (const [key, value] of Object.entries(reward)) {
    if (key === 'soldiers') addSoldiers(value);
    else state.gs.resources[key] = (state.gs.resources[key] || 0) + value;
  }

  state.gs.daily.lastClaim = today;
  state.gs.daily.streak = nextStreak;
  addLog('🎁 领取每日贡品（连续' + nextStreak + '天）：' + rewardText(reward));
  saveGame();
  return true;
}

function ensureDaily() {
  if (!state.gs.daily) state.gs.daily = { lastClaim: '', streak: 0 };
}

function updateDailyButton(btn) {
  ensureDaily();
  const ready = state.gs.daily.lastClaim !== dayKey(new Date());
  btn.textContent = ready ? '贡品*' : '贡品';
  btn.disabled = !ready;
  btn.title = ready ? '领取今日贡品' : '今日贡品已领取';
}

function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function rewardText(reward) {
  return Object.entries(reward).map(([key, value]) => '+' + value + (LABELS[key] || key)).join(' ');
}
