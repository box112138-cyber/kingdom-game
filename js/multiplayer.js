import { MC, MR, CS } from './config.js';
import { state, createState, initBuildings, addLog } from './state.js';
import { renderMap, rebuildUI, renderUpgradePanel } from './renderer.js';
import { updateShopDot, updateShopSidebar } from './shop.js';

const DEFAULT_SERVER = 'ws://localhost:8787';
const SNAPSHOT_INTERVAL = 1200;
const PRESENCE_INTERVAL = 350;

let socket = null;
let dirty = false;
let applyingRemote = false;
let lastSnapshotAt = 0;
let lastPresenceAt = 0;
let serverRevision = 0;

export function initMultiplayer() {
  const serverInput = document.getElementById('onlineServer');
  const roomInput = document.getElementById('onlineRoom');
  const nameInput = document.getElementById('onlineName');
  const connectBtn = document.getElementById('onlineConnect');
  const disconnectBtn = document.getElementById('onlineDisconnect');
  if (!serverInput || !roomInput || !nameInput || !connectBtn || !disconnectBtn) return;

  serverInput.value = localStorage.getItem('kingdom_online_server') || defaultServerUrl();
  roomInput.value = localStorage.getItem('kingdom_online_room') || 'main';
  nameInput.value = localStorage.getItem('kingdom_online_name') || randomName();

  connectBtn.addEventListener('click', function () {
    connectOnline(serverInput.value.trim() || DEFAULT_SERVER, roomInput.value.trim() || 'main', nameInput.value.trim() || randomName());
  });
  disconnectBtn.addEventListener('click', disconnectOnline);

  setInterval(function () {
    if (!isConnected()) return;
    const now = Date.now();
    if (now - lastPresenceAt >= PRESENCE_INTERVAL) {
      sendPresence();
      lastPresenceAt = now;
    }
    if (dirty && now - lastSnapshotAt >= SNAPSHOT_INTERVAL) sendSnapshot();
    prunePeers(now);
  }, 150);
}

export function markWorldDirty() {
  if (!applyingRemote) dirty = true;
}

export function updatePresence() {
  if (isConnected()) sendPresence();
}

export function renderRemotePlayers() {
  const wrap = document.getElementById('remotePlayers');
  if (!wrap) return;
  let html = '';
  for (const peer of state.online.peers.values()) {
    if (peer.r < 0 || peer.r >= MR || peer.c < 0 || peer.c >= MC) continue;
    const left = (peer.c * CS + CS / 2) * state.viewZoom + state.viewPanX;
    const top = (peer.r * CS + CS / 2) * state.viewZoom + state.viewPanY;
    html += '<div class="remote-player" style="left:' + left + 'px;top:' + top + 'px">' +
            '<span class="remote-avatar">' + escapeHtml(peer.avatar || '🧑') + '</span>' +
            '<span class="remote-name">' + escapeHtml(peer.name || '玩家') + '</span></div>';
  }
  wrap.innerHTML = html;
}

function connectOnline(url, room, name) {
  disconnectOnline();
  setStatus('连接中...', false);
  try {
    socket = new WebSocket(url);
  } catch (e) {
    setStatus('地址无效', false);
    return;
  }

  state.online.room = room;
  state.online.name = name;
  localStorage.setItem('kingdom_online_server', url);
  localStorage.setItem('kingdom_online_room', room);
  localStorage.setItem('kingdom_online_name', name);

  socket.addEventListener('open', function () {
    send({ type: 'join', room, name });
    setButtons(true);
  });
  socket.addEventListener('message', function (event) {
    handleMessage(event.data);
  });
  socket.addEventListener('close', function () {
    socket = null;
    state.online.connected = false;
    state.online.role = 'offline';
    state.online.peers.clear();
    setButtons(false);
    setStatus('单机模式', false);
    renderRemotePlayers();
  });
  socket.addEventListener('error', function () {
    setStatus('连接失败', false);
  });
}

function disconnectOnline() {
  if (socket) socket.close();
  socket = null;
}

function handleMessage(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  if (msg.type === 'joined') {
    state.online.connected = true;
    state.online.playerId = msg.playerId;
    state.online.role = msg.role || 'peer';
    serverRevision = msg.revision || 0;
    setStatus('已联机 ' + state.online.room + ' / ' + roleName(state.online.role), true);
    addLog('🌐 已加入联机房间：' + state.online.room);
    if (msg.snapshot) applySnapshot(msg.snapshot, serverRevision);
    else markWorldDirty();
    sendPresence();
  } else if (msg.type === 'role') {
    state.online.role = msg.role || 'peer';
    setStatus('已联机 ' + state.online.room + ' / ' + roleName(state.online.role), true);
  } else if (msg.type === 'snapshot') {
    applySnapshot(msg.snapshot, msg.revision || 0);
  } else if (msg.type === 'presence') {
    updatePeer(msg);
  } else if (msg.type === 'peer-left') {
    state.online.peers.delete(msg.playerId);
    renderRemotePlayers();
  } else if (msg.type === 'error') {
    setStatus(msg.message || '联机错误', false);
  }
}

function applySnapshot(snapshot, revision) {
  if (!snapshot || revision < serverRevision) return;
  serverRevision = revision;
  applyingRemote = true;
  try {
    state.gs = Object.assign(createState(), clone(snapshot.gs || {}));
    initBuildings(state.gs);
    state.gs.claimedCells = state.gs.claimedCells || {};
    state.gs.bPositions = state.gs.bPositions || {};
    state.gs.trainQueue = state.gs.trainQueue || { count: 0, total: 0, ticks: 0, level: 1 };
    state.gs.heroes = state.gs.heroes || { barbarianKing: { level: 1, equipment: { weapon: null, armor: null, ring: null } } };
    state.gs.upgradeQueue = state.gs.upgradeQueue || [];
    state.gs.collectedItems = state.gs.collectedItems || [];
    state.gs.inventory = state.gs.inventory || {};
    state.gs.treasures = state.gs.treasures || [];
    state.gs.monsters = state.gs.monsters || [];
    state.gs.bestiary = state.gs.bestiary || [];
    state.gs.ruins = state.gs.ruins || [];
    state.gs.achievements = state.gs.achievements || { trees: 0, stone: 0, fish: 0, kills: 0, buildings: 0, unlocked: [] };
    if (snapshot.mapData) state.mapData = clone(snapshot.mapData);
    state.bPos = clone(snapshot.bPos || state.gs.bPositions || {});
    state.gs.bPositions = { ...state.bPos };
    state.cooldowns = clone(snapshot.cooldowns || {});
    state.firstHarvest = snapshot.firstHarvest !== false;
    renderMap();
    renderUpgradePanel();
    rebuildUI();
    updateShopSidebar();
    updateShopDot();
    renderRemotePlayers();
    dirty = false;
  } finally {
    applyingRemote = false;
  }
}

function sendSnapshot() {
  dirty = false;
  lastSnapshotAt = Date.now();
  send({
    type: 'snapshot',
    snapshot: {
      gs: clone(state.gs),
      mapData: clone(state.mapData),
      bPos: clone(state.bPos),
      cooldowns: clone(state.cooldowns),
      firstHarvest: state.firstHarvest
    }
  });
}

function sendPresence() {
  send({ type: 'presence', r: state.player.r, c: state.player.c, name: state.online.name, avatar: '🧑' });
}

function updatePeer(msg) {
  if (!msg.playerId || msg.playerId === state.online.playerId) return;
  state.online.peers.set(msg.playerId, {
    r: Number(msg.r) || 0,
    c: Number(msg.c) || 0,
    name: msg.name || '玩家',
    avatar: msg.avatar || '🧑',
    seenAt: Date.now()
  });
  renderRemotePlayers();
}

function prunePeers(now) {
  let changed = false;
  for (const [id, peer] of state.online.peers.entries()) {
    if (now - peer.seenAt > 8000) {
      state.online.peers.delete(id);
      changed = true;
    }
  }
  if (changed) renderRemotePlayers();
}

function send(msg) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

function isConnected() {
  return socket && socket.readyState === WebSocket.OPEN && state.online.connected;
}

function setButtons(connected) {
  document.getElementById('onlineConnect').disabled = connected;
  document.getElementById('onlineDisconnect').disabled = !connected;
}

function setStatus(text, connected) {
  const el = document.getElementById('onlineStatus');
  el.textContent = text;
  el.className = connected ? 'connected' : '';
}

function roleName(role) {
  return role === 'host' ? '房主' : '成员';
}

function defaultServerUrl() {
  if (location.protocol === 'https:') return 'wss://' + location.hostname + ':8787';
  return DEFAULT_SERVER;
}

function randomName() {
  return '玩家' + Math.floor(1000 + Math.random() * 9000);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
}
