import { B, MC, MR, STARTER, MONSTERS } from './config.js';
import { state } from './state.js';
import { genRand } from './utils.js';

// === Terrain Generation ===

export function genTerrain(r, c) {
  const h1 = genRand(r, c, 0);
  const h2 = genRand(r, c, 1);
  const h3 = genRand(r, c, 2);

  const lc = [[7, 14], [18, 36], [33, 10], [42, 40], [12, 28],
              [25, 8], [44, 20], [8, 44], [35, 46], [22, 18]];
  for (let i = 0; i < lc.length; i++) {
    const [lx, ly] = lc[i];
    const dx = c - lx, dy = r - ly;
    const rds = 2 + (h2 * (i % 5 + 1)) % 4;
    if (Math.sqrt(dx * dx + dy * dy) < rds && h1 < 0.55) return 'water';
  }
  if (h2 > 0.92) return 'mountain';
  if (h1 > 0.60 && h1 < 0.84) return 'tree';
  return 'grass';
}

export function fullGenMap() {
  state.mapData.length = 0;
  for (let r = 0; r < MR; r++) {
    state.mapData[r] = [];
    for (let c = 0; c < MC; c++) {
      state.mapData[r][c] = { terrain: genTerrain(r, c), buildingId: null, wall: false };
    }
  }
}

// === Cell Operations ===

export function canPlace(r, c, sz, bid) {
  if (r < 0 || c < 0 || r + sz > MR || c + sz > MC) return false;
  for (let dr = 0; dr < sz; dr++) {
    for (let dc = 0; dc < sz; dc++) {
      const cell = state.mapData[r + dr][c + dc];
      const allowWater = bid === 'bridge';
      if (cell.terrain === 'mountain' || (!allowWater && cell.terrain === 'water') ||
          cell.buildingId || cell.wall) return false;
    }
  }
  return true;
}

export function occupyCells(r, c, sz, bid) {
  for (let dr = 0; dr < sz; dr++) {
    for (let dc = 0; dc < sz; dc++) {
      // Bridges preserve water terrain
      if (bid !== 'bridge') {
        state.mapData[r + dr][c + dc].terrain = 'grass';
      }
      state.mapData[r + dr][c + dc].buildingId = (dr === 0 && dc === 0) ? bid : '__occ__';
      state.mapData[r + dr][c + dc].wall = false;
    }
  }
}

export function clearCells(r, c, sz) {
  for (let dr = 0; dr < sz; dr++) {
    for (let dc = 0; dc < sz; dc++) {
      state.mapData[r + dr][c + dc].buildingId = null;
      state.mapData[r + dr][c + dc].wall = false;
    }
  }
}

// === Initial Building Placement ===

export function placeBuildings() {
  state.bPos = {};
  const cR = Math.floor(MR / 2), cC = Math.floor(MC / 2);
  let bR = cR, bC = cC, bG = 0;
  const sr = 5;

  for (let dr = -5; dr <= 5; dr++) {
    for (let dc = -8; dc <= 8; dc++) {
      const rr = cR + dr, cc = cC + dc;
      if (rr - sr < 0 || rr + sr >= MR || cc - sr < 0 || cc + sr >= MC) continue;
      let g = 0;
      for (let r = rr - sr; r <= rr + sr; r++) {
        for (let c = cc - sr; c <= cc + sr; c++) {
          if (state.mapData[r][c].terrain !== 'water' && state.mapData[r][c].terrain !== 'mountain') g++;
        }
      }
      if (g > bG) { bG = g; bR = rr; bC = cc; }
    }
  }

  for (let dr = -1; dr <= 1; dr++) {
    let p = false;
    for (let dc = -1; dc <= 1; dc++) {
      if (canPlace(bR + dr, bC + dc, 1, 'castle')) {
        occupyCells(bR + dr, bC + dc, 1, 'castle');
        state.bPos.castle = { r: bR + dr, c: bC + dc };
        p = true;
        break;
      }
    }
    if (p) break;
  }
  if (!state.bPos.castle) {
    occupyCells(bR, bC, 1, 'castle');
    state.bPos.castle = { r: bR, c: bC };
  }

  const rest = STARTER.filter(id => id !== 'castle');
  for (const id of rest) {
    const sz = B[id].size || 1;
    let p = false;
    for (let dr = -sr; dr <= sr && !p; dr++) {
      for (let dc = -sr; dc <= sr && !p; dc++) {
        if (canPlace(bR + dr, bC + dc, sz, id)) {
          occupyCells(bR + dr, bC + dc, sz, id);
          state.bPos[id] = { r: bR + dr, c: bC + dc };
          p = true;
        }
      }
    }
  }
}

// === Restore Buildings From Save ===

export function restoreBuildingsFromSave() {
  state.bPos = {};
  for (const [id, pos] of Object.entries(state.gs.bPositions)) {
    const baseId = id.includes('_') ? id.split('_')[0] : id;
    if (pos && pos.r >= 0 && pos.r < MR && pos.c >= 0 && pos.c < MC && B[baseId]) {
      state.bPos[id] = { r: pos.r, c: pos.c };
      const sz = B[baseId].size || 1;
      occupyCells(pos.r, pos.c, sz, baseId);
    }
  }
  if (!state.bPos.castle) placeBuildings();
}

// === Generate Treasures ===

export function genTreasures() {
  const treasures = [];
  for (let i = 0; i < 20; i++) {
    let r, c, tries = 0;
    do {
      r = Math.floor(Math.random() * MR);
      c = Math.floor(Math.random() * MC);
      tries++;
    } while (tries < 50 && (
      !state.mapData[r] || !state.mapData[r][c] ||
      state.mapData[r][c].terrain === 'water' ||
      state.mapData[r][c].buildingId ||
      state.mapData[r][c].wall
    ));
    if (tries < 50) {
      treasures.push({ r, c, collected: false });
    }
  }
  state.gs.treasures = treasures;
}

// === Generate Monsters ===

function distToCastle(r, c) {
  if (!state.bPos.castle) return 0;
  const cr = state.bPos.castle.r, cc = state.bPos.castle.c;
  return Math.sqrt((r - cr) ** 2 + (c - cc) ** 2);
}

export function genMonsters() {
  const monsters = [];
  let id = 1;

  // Regular monsters (spawn in matching terrain, away from castle)
  const regularTypes = ['wolf', 'serpent', 'golem', 'bandit'];
  for (const type of regularTypes) {
    const def = MONSTERS[type];
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 of each
    for (let i = 0; i < count; i++) {
      let r, c, tries = 0;
      do {
        r = Math.floor(Math.random() * MR);
        c = Math.floor(Math.random() * MC);
        tries++;
      } while (tries < 100 && (
        r < 0 || r >= MR || c < 0 || c >= MC ||
        !state.mapData[r] || !state.mapData[r][c] ||
        state.mapData[r][c].buildingId ||
        state.mapData[r][c].wall ||
        state.mapData[r][c].terrain !== def.terrain ||
        distToCastle(r, c) < def.minDist
      ));
      if (tries < 100) {
        monsters.push({ id: id++, type, r, c, alive: true, hp: def.hp });
      }
    }
  }

  // Boss monsters (exactly one of each at far distance)
  const bossTypes = ['dragon', 'titan', 'wraith'];
  for (const type of bossTypes) {
    const def = MONSTERS[type];
    let r, c, tries = 0;
    do {
      r = Math.floor(Math.random() * MR);
      c = Math.floor(Math.random() * MC);
      tries++;
    } while (tries < 200 && (
      r < 0 || r >= MR || c < 0 || c >= MC ||
      !state.mapData[r] || !state.mapData[r][c] ||
      state.mapData[r][c].buildingId ||
      state.mapData[r][c].wall ||
      state.mapData[r][c].terrain !== def.terrain ||
      distToCastle(r, c) < def.minDist
    ));
    if (tries < 200) {
      monsters.push({ id: id++, type, r, c, alive: true, hp: def.hp });
    }
  }

  state.gs.monsters = monsters;
}

// === Generate Ruins ===

export function genRuins() {
  const ruins = [];
  for (let i = 0; i < 5; i++) {
    let r, c, tries = 0;
    do {
      r = Math.floor(Math.random() * MR);
      c = Math.floor(Math.random() * MC);
      tries++;
    } while (tries < 100 && (
      r < 5 || r >= MR - 5 || c < 5 || c >= MC - 5 ||
      !state.mapData[r] || !state.mapData[r][c] ||
      state.mapData[r][c].terrain === 'water' ||
      state.mapData[r][c].buildingId || state.mapData[r][c].wall ||
      distToCastle(r, c) < 15
    ));
    if (tries < 100) {
      ruins.push({ r, c, explored: false });
    }
  }
  state.gs.ruins = ruins;
}

// === Wave Monsters (spawned at map edges) ===

export function genWaveMonsters(count) {
  if (!state.gs.monsters) state.gs.monsters = [];
  const types = ['wolf', 'serpent', 'golem', 'bandit'];
  let id = Date.now();
  const spawned = [];
  const directions = ['北方', '南方', '西侧', '东侧'];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const def = MONSTERS[type];
    const edge = i % 4;
    let placed = false;
    for (let tries = 0; tries < 40 && !placed; tries++) {
      let r, c;
      switch (edge) {
        case 0: r = 0; c = Math.floor(Math.random() * MC); break;
        case 1: r = MR - 1; c = Math.floor(Math.random() * MC); break;
        case 2: r = Math.floor(Math.random() * MR); c = 0; break;
        case 3: r = Math.floor(Math.random() * MR); c = MC - 1; break;
      }
      if (state.mapData[r] && state.mapData[r][c] &&
          state.mapData[r][c].terrain !== 'water' &&
          !state.mapData[r][c].buildingId &&
          !state.mapData[r][c].wall) {
        const monster = { id: id++, type, r, c, alive: true, hp: def.hp, wave: true, edge };
        state.gs.monsters.push(monster);
        spawned.push(monster);
        placed = true;
      }
    }
  }
  return {
    spawned,
    count: spawned.length,
    directions: [...new Set(spawned.map(m => directions[m.edge]))]
  };
}
