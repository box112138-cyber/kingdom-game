import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const ROOT = process.cwd();
const rooms = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
};

const server = createServer(async function (req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  const cleanPath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const filePath = join(ROOT, cleanPath || 'index.html');
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': mime[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', function (ws) {
  ws.id = randomId();
  ws.roomName = '';
  ws.name = '玩家';

  ws.on('message', function (raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.type === 'join') joinRoom(ws, msg);
    else if (msg.type === 'presence') relayPresence(ws, msg);
    else if (msg.type === 'snapshot') updateSnapshot(ws, msg);
  });

  ws.on('close', function () {
    leaveRoom(ws);
  });
});

function joinRoom(ws, msg) {
  leaveRoom(ws);
  const roomName = safeText(msg.room || 'main', 24) || 'main';
  const room = getRoom(roomName);
  ws.roomName = roomName;
  ws.name = safeText(msg.name || '玩家', 12) || '玩家';
  room.clients.set(ws.id, ws);
  ws.send(JSON.stringify({
    type: 'joined',
    playerId: ws.id,
    role: hostId(room) === ws.id ? 'host' : 'peer',
    revision: room.revision,
    snapshot: room.snapshot
  }));
  broadcastRole(room);
}

function leaveRoom(ws) {
  if (!ws.roomName) return;
  const room = rooms.get(ws.roomName);
  if (!room) return;
  room.clients.delete(ws.id);
  broadcast(room, { type: 'peer-left', playerId: ws.id }, ws.id);
  if (room.clients.size === 0) rooms.delete(ws.roomName);
  else broadcastRole(room);
  ws.roomName = '';
}

function relayPresence(ws, msg) {
  const room = rooms.get(ws.roomName);
  if (!room) return;
  broadcast(room, {
    type: 'presence',
    playerId: ws.id,
    name: safeText(msg.name || ws.name, 12),
    avatar: safeText(msg.avatar || '🧑', 4),
    r: clampInt(msg.r, 0, 49),
    c: clampInt(msg.c, 0, 49)
  }, ws.id);
}

function updateSnapshot(ws, msg) {
  const room = rooms.get(ws.roomName);
  if (!room || !msg.snapshot) return;
  room.snapshot = msg.snapshot;
  room.revision++;
  broadcast(room, { type: 'snapshot', revision: room.revision, snapshot: room.snapshot }, ws.id);
}

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { clients: new Map(), snapshot: null, revision: 0 });
  return rooms.get(name);
}

function hostId(room) {
  return room.clients.keys().next().value || '';
}

function broadcastRole(room) {
  const host = hostId(room);
  for (const client of room.clients.values()) {
    send(client, { type: 'role', role: client.id === host ? 'host' : 'peer' });
  }
}

function broadcast(room, msg, exceptId) {
  for (const client of room.clients.values()) {
    if (client.id !== exceptId) send(client, msg);
  }
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function safeText(value, max) {
  return String(value).replace(/[<>]/g, '').trim().slice(0, max);
}

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

server.listen(PORT, function () {
  console.log('Kingdom Game server running at http://localhost:' + PORT);
});
