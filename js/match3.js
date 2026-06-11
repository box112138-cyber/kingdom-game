// === Match-3 Game Module ===

export const GM = {
  ROWS: 7, COLS: 7, CSIZE: 54,
  ANIMALS: ['chicken', 'cow', 'duck', 'goat', 'horse', 'pig', 'rabbit'],
  grid: null, selected: null, score: 0, combo: 0, processing: false,
  dragCell: null, dragX: 0, dragY: 0, dragDone: false,
  hintCells: null, hintTimer: null,
  manualMode: false, manualMonsterId: null, manualTimeLeft: 30
};

let gmDragReady = false;

// === Init Game Grid ===

export function initGameGrid() {
  GM.grid = [];
  for (let r = 0; r < GM.ROWS; r++) {
    GM.grid[r] = [];
    for (let c = 0; c < GM.COLS; c++) {
      let a;
      do {
        a = Math.floor(Math.random() * GM.ANIMALS.length);
      } while (wouldMatchAt(r, c, a));
      GM.grid[r][c] = a;
    }
  }
  GM.selected = null;
  GM.score = 0;
  GM.combo = 0;
  GM.processing = false;
  GM.dragCell = null;
  GM.dragDone = false;
  GM.hintCells = null;
  clearHintTimer();
  document.getElementById('gameCombo').textContent = '';
}

function wouldMatchAt(r, c, a) {
  if (c >= 2 && GM.grid[r][c - 1] === a && GM.grid[r][c - 2] === a) return true;
  if (r >= 2 && GM.grid[r - 1] && GM.grid[r - 1][c] === a && GM.grid[r - 2] && GM.grid[r - 2][c] === a) return true;
  return false;
}

// === Find Matches ===

export function findMatches() {
  const set = new Set();
  for (let r = 0; r < GM.ROWS; r++) {
    let i = 0;
    while (i < GM.COLS) {
      const a = GM.grid[r][i];
      if (a < 0) { i++; continue; }
      let j = i + 1;
      while (j < GM.COLS && GM.grid[r][j] === a) j++;
      if (j - i >= 3) { for (let k = i; k < j; k++) set.add(r * GM.COLS + k); }
      i = j;
    }
  }
  for (let c = 0; c < GM.COLS; c++) {
    let i = 0;
    while (i < GM.ROWS) {
      const a = GM.grid[i][c];
      if (a < 0) { i++; continue; }
      let j = i + 1;
      while (j < GM.ROWS && GM.grid[j] && GM.grid[j][c] === a) j++;
      if (j - i >= 3) { for (let k = i; k < j; k++) set.add(k * GM.COLS + c); }
      i = j;
    }
  }
  const m = [];
  set.forEach(function (k) { m.push({ r: Math.floor(k / GM.COLS), c: k % GM.COLS }); });
  return m;
}

// === Hint System ===

function clearHintTimer() {
  if (GM.hintTimer) { clearTimeout(GM.hintTimer); GM.hintTimer = null; }
}

export function clearHint() {
  GM.hintCells = null;
  clearHintTimer();
}

function findHint() {
  for (let r = 0; r < GM.ROWS; r++) {
    for (let c = 0; c < GM.COLS; c++) {
      if (GM.grid[r][c] < 0) continue;

      // try swap right
      if (c + 1 < GM.COLS && GM.grid[r][c + 1] >= 0) {
        swapCells(r, c, r, c + 1);
        if (findMatches().length > 0) {
          swapCells(r, c, r, c + 1);
          return [{ r, c }, { r, c: c + 1 }];
        }
        swapCells(r, c, r, c + 1);
      }

      // try swap down
      if (r + 1 < GM.ROWS && GM.grid[r + 1] && GM.grid[r + 1][c] >= 0) {
        swapCells(r, c, r + 1, c);
        if (findMatches().length > 0) {
          swapCells(r, c, r + 1, c);
          return [{ r, c }, { r: r + 1, c }];
        }
        swapCells(r, c, r + 1, c);
      }
    }
  }
  return null;
}

export function showHint() {
  if (GM.processing) return;
  clearHint();
  const hint = findHint();
  if (!hint) {
    initGameGrid();
    renderGameGrid();
    setupGameDrag();
    const comboEl = document.getElementById('gameCombo');
    if (comboEl) comboEl.textContent = '🔀 无可操作，已重新排列';
    setTimeout(() => {
      if (comboEl) comboEl.textContent = '';
    }, 1500);
    return;
  }

  GM.hintCells = hint;
  renderGameGrid();

  clearHintTimer();
  GM.hintTimer = setTimeout(() => {
    clearHint();
    renderGameGrid();
  }, 2500);
}

// === Drop & Fill ===

function dropAndFill() {
  GM.drops = new Set();
  for (let c = 0; c < GM.COLS; c++) {
    let w = GM.ROWS - 1;
    for (let r = GM.ROWS - 1; r >= 0; r--) {
      if (GM.grid[r][c] >= 0) {
        GM.grid[w][c] = GM.grid[r][c];
        if (w !== r) { GM.grid[r][c] = -1; GM.drops.add(w + ',' + c); }
        w--;
      }
    }
    for (let r = w; r >= 0; r--) {
      GM.grid[r][c] = Math.floor(Math.random() * GM.ANIMALS.length);
      GM.drops.add(r + ',' + c);
    }
  }
}

// === Process Matches (recursive) ===

export function processMatches() {
  const matches = findMatches();
  if (!matches.length) { GM.processing = false; GM.combo = 0; return; }
  const pts = matches.length * 10 * (1 + Math.floor(GM.combo / 2) * 0.5);
  GM.score += Math.floor(pts);
  GM.combo++;
  updateGameScore();
  document.getElementById('gameCombo').textContent = GM.combo > 1
    ? '🔥 ' + GM.combo + '连击! x' + (1 + Math.floor(GM.combo / 2) * 0.5).toFixed(1)
    : '';

  const g = document.getElementById('gameGrid');
  for (let i = 0; i < matches.length; i++) {
    const cell = g.querySelector('.game-cell[data-r="' + matches[i].r + '"][data-c="' + matches[i].c + '"]');
    if (cell) cell.classList.add('matched');
  }
  setTimeout(function () {
    for (let i = 0; i < matches.length; i++) {
      GM.grid[matches[i].r][matches[i].c] = -1;
    }
    dropAndFill();
    renderGameGrid();
    processMatches();
  }, 400);
}

// === Swap Cells ===

function swapCells(r1, c1, r2, c2) {
  const t = GM.grid[r1][c1];
  GM.grid[r1][c1] = GM.grid[r2][c2];
  GM.grid[r2][c2] = t;
}

// === Animate Swap ===

function animateSwap(r1, c1, r2, c2, cb) {
  const g = document.getElementById('gameGrid');
  if (!g) { cb && cb(); return; }
  const c1e = g.querySelector('.game-cell[data-r="' + r1 + '"][data-c="' + c1 + '"]');
  const c2e = g.querySelector('.game-cell[data-r="' + r2 + '"][data-c="' + c2 + '"]');
  if (c1e && c2e) {
    const dc = c2 - c1, dr = r2 - r1;
    const tx = dc * GM.CSIZE, ty = dr * GM.CSIZE;
    c1e.style.transition = 'transform 0.2s ease-out';
    c2e.style.transition = 'transform 0.2s ease-out';
    c1e.style.zIndex = '12'; c2e.style.zIndex = '11';
    c1e.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    c2e.style.transform = 'translate(' + (-tx) + 'px,' + (-ty) + 'px)';
  }
  swapCells(r1, c1, r2, c2);
  setTimeout(function () { renderGameGrid(); cb && cb(); }, 200);
}

// === Try Swap ===

export function trySwap(r1, c1, r2, c2) {
  if (GM.processing) return;
  clearHint();
  GM.processing = true;
  GM.selected = null;
  GM.dragCell = null;
  GM.dragDone = true;
  GM.combo = 0;
  animateSwap(r1, c1, r2, c2, function () {
    if (!findMatches().length) {
      animateSwap(r1, c1, r2, c2, function () { GM.processing = false; });
    } else {
      processMatches();
    }
  });
}

// === Handle Game Click ===

export function handleGameClick(r, c) {
  if (GM.processing || GM.dragDone) { GM.dragDone = false; return; }
  clearHint();
  if (!GM.selected) { GM.selected = { r: r, c: c }; renderGameGrid(); return; }
  const sr = GM.selected.r, sc = GM.selected.c;
  if (sr === r && sc === c) { GM.selected = null; renderGameGrid(); return; }
  const dr = Math.abs(r - sr), dc = Math.abs(c - sc);
  if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) {
    GM.selected = { r: r, c: c };
    renderGameGrid();
    return;
  }
  trySwap(sr, sc, r, c);
}

// === Setup Game Drag ===

export function setupGameDrag() {
  if (gmDragReady) return;
  gmDragReady = true;
  const g = document.getElementById('gameGrid');
  if (!g) return;

  g.addEventListener('mousedown', function (e) {
    if (GM.processing) return;
    clearHint();
    const cell = e.target.closest('.game-cell');
    if (!cell) return;
    const r = parseInt(cell.getAttribute('data-r')), c = parseInt(cell.getAttribute('data-c'));
    if (isNaN(r) || isNaN(c)) return;
    GM.dragCell = { r: r, c: c };
    GM.dragX = e.clientX;
    GM.dragY = e.clientY;
    GM.dragDone = false;
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!GM.dragCell || GM.processing || GM.dragDone) return;
    const dx = e.clientX - GM.dragX, dy = e.clientY - GM.dragY;
    const th = 18;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    const sr = GM.dragCell.r, sc = GM.dragCell.c;
    let tr = sr, tc = sc;
    if (Math.abs(dx) > Math.abs(dy)) { tc = dx > 0 ? sc + 1 : sc - 1; }
    else { tr = dy > 0 ? sr + 1 : sr - 1; }
    if (tr < 0 || tr >= GM.ROWS || tc < 0 || tc >= GM.COLS) return;
    if (GM.grid[tr][tc] < 0) return;
    trySwap(sr, sc, tr, tc);
  });

  window.addEventListener('mouseup', function (e) {
    if (!GM.dragCell) return;
    if (!GM.dragDone) { GM.selected = GM.dragCell; renderGameGrid(); }
    GM.dragCell = null;
    GM.dragDone = false;
  });
}

// === Render Game Grid ===

export function renderGameGrid() {
  const el = document.getElementById('gameGrid');
  if (!el) return;
  let h = '';
  for (let r = 0; r < GM.ROWS; r++) {
    for (let c = 0; c < GM.COLS; c++) {
      const a = GM.grid[r][c];
      if (a < 0) continue;
      let cls = 'game-cell';
      if (GM.selected && GM.selected.r === r && GM.selected.c === c) cls += ' selected';
      if (GM.drops && GM.drops.has(r + ',' + c)) cls += ' drop';
      if (GM.hintCells && GM.hintCells.some(function (h) { return h.r === r && h.c === c; })) cls += ' hint';
      h += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' +
           '<img src="assets/images/' + GM.ANIMALS[a] + '.png" alt="' + GM.ANIMALS[a] + '">' +
           '</div>';
    }
  }
  el.innerHTML = h;
  GM.drops = null;
}

// === Update Score ===

function updateGameScore() {
  const el = document.getElementById('gameScore');
  if (el) el.textContent = GM.score;
}

// === Toggle Game Overlay ===

export function toggleGame() {
  const ov = document.getElementById('gameOverlay');
  if (ov.classList.contains('show')) {
    ov.classList.remove('show');
    GM.manualMode = false;
    GM.manualMonsterId = null;
  } else {
    initGameGrid();
    renderGameGrid();
    setupGameDrag();
    ov.classList.add('show');
  }
}

export function startManualCombat(monsterId) {
  GM.manualMode = true;
  GM.manualMonsterId = monsterId;
  GM.manualTimeLeft = 30;
  initGameGrid();
  renderGameGrid();
  setupGameDrag();
  document.getElementById('gameOverlay').classList.add('show');
  // Timer display
  const info = document.querySelector('.game-info');
  if (info) info.innerHTML = '<span>⏱️ ' + GM.manualTimeLeft + 's</span><span>🏆 得分</span><span class="game-score" id="gameScore">0</span>';
  const timer = setInterval(() => {
    GM.manualTimeLeft--;
    if (info) info.innerHTML = '<span>⏱️ ' + GM.manualTimeLeft + 's</span><span>🏆 得分</span><span class="game-score" id="gameScore">' + GM.score + '</span>';
    if (GM.manualTimeLeft <= 0) {
      clearInterval(timer);
      toggleGame();
    }
  }, 1000);
}
