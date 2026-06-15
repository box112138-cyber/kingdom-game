import { DEFAULT_CHARACTER, state, saveGame } from './state.js';

export const CHARACTER_AVATARS = [
  '🧑', '👩', '👨', '🧒', '👧', '👦',
  '🧑🏻', '👩🏻', '👨🏻', '🧑🏼', '👩🏼', '👨🏼',
  '🧑🏽', '👩🏽', '👨🏽', '🧑🏾', '👩🏾', '👨🏾',
  '🧑🏿', '👩🏿', '👨🏿', '🧙', '🧝', '🧛',
  '🧚', '🧜', '🧞', '🥷', '🧑‍🌾', '🧑‍🏭'
];

let selectedAvatar = DEFAULT_CHARACTER.avatar;
let onClose = null;
let onChange = null;

export function normalizeCharacter(character) {
  const current = character || {};
  const avatar = CHARACTER_AVATARS.includes(current.avatar) ? current.avatar : DEFAULT_CHARACTER.avatar;
  const name = sanitizeName(current.name || DEFAULT_CHARACTER.name);
  return { name, avatar };
}

export function initCharacterPicker(options = {}) {
  onChange = typeof options.onChange === 'function' ? options.onChange : null;
  ensureCharacter();
  renderAvatarChoices();
  document.getElementById('characterBtn').addEventListener('click', function () {
    openCharacterPicker({ title: '创建角色', allowClose: true });
  });
  document.getElementById('characterSave').addEventListener('click', saveCharacterFromPicker);
  document.getElementById('characterCancel').addEventListener('click', closeCharacterPicker);
}

export function ensureCharacter() {
  state.gs.character = normalizeCharacter(state.gs.character);
  applyCharacterToUI();
}

export function applyCharacterToUI() {
  const character = normalizeCharacter(state.gs.character);
  const nameInput = document.getElementById('onlineName');
  const characterName = document.getElementById('characterName');
  if (nameInput && (!nameInput.value || nameInput.value.startsWith('玩家'))) nameInput.value = character.name;
  if (characterName) characterName.value = character.name;
  selectedAvatar = character.avatar;
  notifyChange();
  updateSelectedAvatarUI();
}

export function openCharacterPicker(options = {}) {
  ensureCharacter();
  onClose = typeof options.onClose === 'function' ? options.onClose : null;
  document.getElementById('characterTitle').textContent = options.title || '创建角色';
  document.getElementById('characterCancel').style.display = options.allowClose === false ? 'none' : '';
  document.getElementById('characterName').value = state.gs.character.name;
  selectedAvatar = state.gs.character.avatar;
  updateSelectedAvatarUI();
  document.getElementById('characterOverlay').classList.add('show');
}

function saveCharacterFromPicker() {
  const name = sanitizeName(document.getElementById('characterName').value || DEFAULT_CHARACTER.name);
  state.gs.character = { name, avatar: selectedAvatar };
  state.online.name = name;
  const onlineName = document.getElementById('onlineName');
  if (onlineName) onlineName.value = name;
  localStorage.setItem('kingdom_online_name', name);
  applyCharacterToUI();
  saveGame();
  closeCharacterPicker();
}

function notifyChange() {
  if (onChange) onChange();
}

function closeCharacterPicker() {
  document.getElementById('characterOverlay').classList.remove('show');
  if (onClose) {
    const done = onClose;
    onClose = null;
    done();
  }
}

function renderAvatarChoices() {
  const grid = document.getElementById('characterAvatars');
  grid.innerHTML = CHARACTER_AVATARS.map(function (avatar) {
    return '<button class="avatar-choice" data-avatar="' + avatar + '" type="button">' + avatar + '</button>';
  }).join('');
  grid.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-avatar]');
    if (!btn) return;
    selectedAvatar = btn.dataset.avatar;
    updateSelectedAvatarUI();
  });
}

function updateSelectedAvatarUI() {
  document.querySelectorAll('.avatar-choice').forEach(function (btn) {
    btn.classList.toggle('selected', btn.dataset.avatar === selectedAvatar);
  });
  const preview = document.getElementById('characterPreview');
  if (preview) preview.textContent = selectedAvatar + ' 选择你的王国化身';
}

function sanitizeName(value) {
  const clean = String(value).replace(/[<>]/g, '').trim().slice(0, 12);
  return clean || DEFAULT_CHARACTER.name;
}
