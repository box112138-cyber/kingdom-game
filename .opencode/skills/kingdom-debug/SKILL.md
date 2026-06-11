---
name: kingdom-debug
description: Use when working on the kingdom-game project and the user reports a bug or asks for a feature. Before writing ANY code, analyze: (1) root cause, (2) fix strategy, (3) side effects, (4) new bug risks, (5) verification. Code must follow project architecture: maintainable (correct module, proper save/load), extensible (data-driven config, no hardcoding), performant (incremental updateCell, no renderMap on keypress), and clean (no duplication, no magic numbers, no dead code).
---

# Kingdom Game Debug Methodology

When the user describes a problem or requests a feature, follow this process **before writing any code**:

## 1. Root Cause Analysis
- Which module(s) are involved? Trace the data flow.
- What is the exact line or logic causing the issue?
- Is this a regression (broke after a change) or a pre-existing bug?

## 2. Fix Strategy
- What files need to change?
- Will the fix be local (one function) or cross-cutting (multiple modules)?
- Does the fix align with the existing architecture (shared state → `state.js`, rendering → `renderer.js`)?
- Can the fix be incremental (updateCell) or does it need full renderMap?

## 3. Side Effects & Impact
- What other systems depend on the changed code?
- Will this affect save/load compatibility?
- Will this change the game balance or player experience?
- Module dependency check: does the fix create a new import cycle?

## 4. New Bug Risks
- What edge cases could the fix introduce?
- What happens with empty state, max values, rapid clicks?
- Does the fix handle both keyboard and mouse interaction paths?

## 5. Verification
- What specific behavior should the user test?
- Which edge cases to verify?
- Any console errors to watch for?

## 6. Code Quality Standards

Every change must meet these standards. Do NOT write throwaway code just to satisfy the immediate request.

### Maintainability
- Follow the existing module boundaries. New game data goes in `config.js`, shared state in `state.js`, rendering in `renderer.js`, input in `player.js`, orchestration in `main.js`.
- If a new feature spans multiple concerns, create a new module (e.g., `combat.js`, `achievements.js`) rather than stuffing everything into `main.js`.
- Reuse existing helpers: `buildCellData` for cell rendering, `updateCell`/`updateCells` for incremental updates, `addLog` for notifications, `rf` for number formatting.
- Every new piece of mutable state MUST be added to `createState()`, `saveGame()`, and `loadGame()` in `main.js`. Missing save/load is a critical bug.
- All `canPlace()` callers must pass the building ID (4th parameter) to correctly handle bridges on water.

### Extensibility
- Use data-driven design: put definitions in `config.js` (building stats, monster types, achievement rules) rather than hardcoding in logic modules.
- New monster types, building types, or achievement definitions should only require adding entries to `config.js` or `achievements.js` — no logic changes needed.
- Functions that iterate buildings/monsters should use `Object.entries()` or `for...of` over arrays, not hardcoded lists.
- When adding a new building effect, add the computation in the relevant module (`economy.js` for production, `buildings.js` for timing, `combat.js` for battle), and read the building level from `state.gs.buildings[id]`.

### Code Quality
- No duplicated logic. If the same pattern appears twice, extract a shared helper function in the appropriate module.
- No magic numbers. Use named constants in `config.js` (e.g., `CD_WATER`, `MONSTERS.wolf.hp`).
- No commented-out code. Remove dead code instead of commenting it out.
- Meaningful variable names. Avoid single-letter names except for loop indices (r, c, i, j, k).
- Keep functions short and single-purpose. If a function exceeds ~40 lines, consider splitting it.
- Handle edge cases: null checks on state lookups, bounds checks on grid access, and defaults for missing save data.

### Module Dependencies
- **Avoid import cycles.** Always trace the dependency graph before adding a new import:
  ```
  config → none
  utils → none
  state → config
  achievements → state
  map → config, state, utils
  economy → config, state
  buildings → config, state
  terrain → config, state, map, achievements
  combat → config, state, economy, achievements
  interiors → config, state
  match3 → none (standalone)
  shop → config, state, map, buildings, renderer
  renderer → config, state, map, buildings, economy
  player → config, state, map, terrain, shop, renderer, interiors, combat, achievements, match3
  main → everything (orchestrator only)
  ```
- If you need to import from a module that imports from you, you have a cycle. Fix it by:
  - Moving the shared logic to a lower-level module (e.g., state or config)
  - Having the orchestrator (main.js or player.js) coordinate instead of direct calls
  - Using event-style callbacks or returning results for the caller to handle

### Performance
- Never call `renderMap()` inside a loop or on every keypress. Use `updateCell(r, c)` for 1-cell changes, `updateCells(coords)` for small batches.
- DOM reads that force layout (`clientWidth`, `offsetHeight`, `getBoundingClientRect`) must be cached. Use `cachedVW`/`cachedVH` pattern from `player.js`.
- Large data structures (monsters, treasures, ruins) should be sparse arrays or Sets for O(1) lookups, not `.find()` on every cell (current `.find()` is acceptable due to small N, but watch for scaling).
- `buildCellData` is the single source of truth for cell appearance. Never duplicate cell styling logic elsewhere.

## Module Map (for quick reference)

| Module | Responsibility |
|--------|---------------|
| `config.js` | Constants, building defs, monster types, interiors |
| `state.js` | Shared mutable state, save/load |
| `utils.js` | RNG, formatting |
| `map.js` | Terrain, cell operations, treasure/monster/ruin generation |
| `economy.js` | Production, caps, hero, training, adjacency |
| `buildings.js` | Costs, requirements, upgrade queue |
| `terrain.js` | Resource gathering, cooldowns |
| `shop.js` | Shop overlay, inventory, placement |
| `interiors.js` | Castle/ruin exploration |
| `match3.js` | Standalone match-3 game + manual combat |
| `combat.js` | Auto combat, Boss equipment, manual combat |
| `achievements.js` | Achievement tracking and rewards |
| `renderer.js` | Map rendering (full + incremental), float card, selection overlay |
| `player.js` | Movement, camera, input, monster/treasure/ruin interaction |
| `main.js` | Game loop, initialization, event wiring, orchestration |
