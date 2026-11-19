import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_COUNT,
  GRID_SIZE,
  LAMP_COUNT,
  applyRotations,
  dateKey,
  generatePuzzle,
  isSolved,
  minClicks,
  rotateTile,
  seedFromDate,
  shareText,
} from './puzzle.ts';

const serialize = (date: string): string => {
  const { puzzle } = generatePuzzle(date);
  return puzzle.tiles
    .map((t) => `${t.type[0]}${t.role[0]}${t.rotation}${t.fixed ? 'f' : ''}`)
    .join('|');
};

const addDays = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKey(d);
};

test('dateKey formats a UTC date', () => {
  assert.equal(dateKey(new Date('2026-11-19T08:30:00Z')), '2026-11-19');
  assert.equal(dateKey(new Date('2026-01-01T23:59:59Z')), '2026-01-01');
});

test('seedFromDate is stable for a known date', () => {
  // Pinned so a seed change is noticed: it would reshuffle every daily puzzle.
  assert.equal(seedFromDate('2026-11-19'), 1964763441);
  assert.notEqual(seedFromDate('2026-11-19'), seedFromDate('2026-11-20'));
});

test('generation is deterministic per date', () => {
  const first = generatePuzzle('2026-11-19');
  const second = generatePuzzle('2026-11-19');
  assert.deepEqual(first, second);
});

test('different dates give different puzzles', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    seen.add(serialize(addDays('2026-11-19', i)));
  }
  assert.equal(seen.size, 30);
});

test('every puzzle in a full year is solvable and starts unsolved', () => {
  for (let i = 0; i < 365; i++) {
    const date = addDays('2026-01-01', i);
    const { puzzle, solution } = generatePuzzle(date);
    assert.equal(puzzle.tiles.length, CELL_COUNT);
    assert.equal(puzzle.size, GRID_SIZE);
    assert.equal(puzzle.lampIndices.length, LAMP_COUNT);
    assert.ok(puzzle.par > 0, `${date}: par must be positive`);
    assert.equal(
      isSolved(puzzle),
      false,
      `${date}: starting board must not be solved`
    );
    const solved = applyRotations(
      puzzle,
      puzzle.tiles.map((tile, j) => (tile.rotation + (solution[j] ?? 0)) % 4)
    );
    assert.equal(isSolved(solved), true, `${date}: solution must win`);
    assert.equal(
      minClicks(puzzle, solved.tiles.map((t) => t.rotation)),
      puzzle.par,
      `${date}: par must equal the clicks to reach the solution`
    );
  }
});

test('playing the solution one click at a time wins in exactly par moves', () => {
  const { puzzle, solution } = generatePuzzle('2026-12-09');
  let board = puzzle;
  let moves = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const turns = solution[i] ?? 0;
    for (let k = 0; k < turns; k++) {
      board = rotateTile(board, i);
      moves++;
    }
  }
  assert.equal(moves, puzzle.par);
  assert.equal(isSolved(board), true);
});

test('rotateTile turns a tile and leaves fixed tiles alone', () => {
  const { puzzle } = generatePuzzle('2026-11-19');
  const movable = puzzle.tiles.findIndex((t) => !t.fixed);
  const tile = puzzle.tiles[movable];
  if (!tile) throw new Error('board must have a movable tile');
  const before = tile.rotation;
  const after = rotateTile(puzzle, movable);
  const afterTile = after.tiles[movable];
  if (!afterTile) throw new Error('tile missing after rotation');
  assert.equal(afterTile.rotation, (before + 1) % 4);
  // The input puzzle is not changed.
  assert.equal(puzzle.tiles[movable]?.rotation, before);

  const fixed = rotateTile(puzzle, puzzle.sourceIndex);
  assert.equal(fixed, puzzle);
});

test('minClicks counts a straight tile half turn as zero', () => {
  const { puzzle } = generatePuzzle('2026-11-19');
  const straight = puzzle.tiles.findIndex((t) => t.type === 'straight');
  if (straight === -1) return; // some boards have no straight tile
  const rotations = puzzle.tiles.map((t) => t.rotation);
  const base = rotations[straight] ?? 0;
  rotations[straight] = (base + 2) % 4;
  assert.equal(minClicks(puzzle, rotations), 0);
  rotations[straight] = (base + 3) % 4;
  assert.equal(minClicks(puzzle, rotations), 1);
});

test('shareText names the date, the moves, and the par', () => {
  const text = shareText('2026-11-19', 14, 12);
  assert.ok(text.includes('2026-11-19'));
  assert.ok(text.includes('14 moves'));
  assert.ok(text.includes('par 12'));
});
