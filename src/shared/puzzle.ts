// Daily Circuit puzzle logic.
//
// One puzzle per day, seeded by the UTC date. Each board is built solved
// and then scrambled, so every puzzle has a known solution. This module is
// pure logic with no platform dependencies, so the client, the server, and
// the tests all import it.

export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const LAMP_COUNT = 3;

export type TileType = 'straight' | 'corner' | 'tee' | 'cross' | 'end';
export type TileRole = 'source' | 'lamp' | 'pipe';

export type TileState = {
  type: TileType;
  role: TileRole;
  rotation: number; // 0..3, quarter turns clockwise from the base shape
  fixed: boolean;
};

export type Puzzle = {
  date: string;
  seed: number;
  size: number;
  tiles: TileState[];
  sourceIndex: number;
  lampIndices: number[];
  par: number; // moves to reach the known solution
};

export type GeneratedPuzzle = {
  puzzle: Puzzle;
  solution: number[]; // quarter turns to apply per tile, 0 for fixed tiles
};

// Directions: 0 = north, 1 = east, 2 = south, 3 = west.
const step = (dir: number): { dx: number; dy: number } => {
  if (dir === 0) return { dx: 0, dy: -1 };
  if (dir === 1) return { dx: 1, dy: 0 };
  if (dir === 2) return { dx: 0, dy: 1 };
  return { dx: -1, dy: 0 };
};

const oppositeOf = (dir: number): number => (dir + 2) % 4;

// Openings of each tile type at rotation 0.
const BASE_OPENINGS: Record<TileType, number[]> = {
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 2],
  cross: [0, 1, 2, 3],
  end: [0],
};

export const indexOf = (x: number, y: number): number => y * GRID_SIZE + x;

const inGrid = (x: number, y: number): boolean =>
  x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;

const coordsOf = (index: number): { x: number; y: number } => ({
  x: index % GRID_SIZE,
  y: Math.floor(index / GRID_SIZE),
});

// Tile at an index that the caller knows is valid. Boards always hold exactly
// CELL_COUNT tiles, so a miss means a bug, not bad input.
const tileAt = (puzzle: Puzzle, index: number): TileState => {
  const tile = puzzle.tiles[index];
  if (!tile) throw new Error(`Missing tile at index ${index}`);
  return tile;
};

// UTC date key, YYYY-MM-DD. Everyone on the same date gets the same puzzle.
export const dateKey = (d: Date): string => d.toISOString().slice(0, 10);

// FNV-1a hash of the date string. Stable across runs and platforms.
export const seedFromDate = (date: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    hash ^= date.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// Mulberry32, a small deterministic PRNG.
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Directions a tile currently opens toward, after its rotation.
export const openingsOf = (tile: TileState): number[] =>
  BASE_OPENINGS[tile.type].map((d) => (d + tile.rotation) % 4);

// Rotation that makes a tile of this type open toward exactly these dirs.
const rotationFor = (type: TileType, dirs: number[]): number => {
  const wanted = new Set(dirs);
  for (let r = 0; r < 4; r++) {
    const got = BASE_OPENINGS[type].map((d) => (d + r) % 4);
    if (got.length === wanted.size && got.every((d) => wanted.has(d))) {
      return r;
    }
  }
  throw new Error(`No rotation of ${type} opens toward ${dirs.join(',')}`);
};

const tileTypeForDegree = (
  dirs: number[]
): { type: TileType; fixed: boolean } => {
  if (dirs.length === 1) return { type: 'end', fixed: false };
  if (dirs.length === 2) {
    const first = dirs[0] ?? 0;
    const second = dirs[1] ?? 0;
    const opposite = (first + 2) % 4 === second;
    return { type: opposite ? 'straight' : 'corner', fixed: false };
  }
  if (dirs.length === 3) return { type: 'tee', fixed: false };
  return { type: 'cross', fixed: true }; // a cross looks the same rotated
};

// Cells reachable from the power source through connected pipes.
export const connectedSet = (puzzle: Puzzle): Set<number> => {
  const seen = new Set<number>([puzzle.sourceIndex]);
  const queue = [puzzle.sourceIndex];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined) break;
    const { x, y } = coordsOf(current);
    for (const dir of openingsOf(tileAt(puzzle, current))) {
      const { dx, dy } = step(dir);
      const nx = x + dx;
      const ny = y + dy;
      if (!inGrid(nx, ny)) continue;
      const next = indexOf(nx, ny);
      if (seen.has(next)) continue;
      if (!openingsOf(tileAt(puzzle, next)).includes(oppositeOf(dir))) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
};

// A board is solved when every lamp is connected to the source.
export const isSolved = (puzzle: Puzzle): boolean => {
  const connected = connectedSet(puzzle);
  return puzzle.lampIndices.every((lamp) => connected.has(lamp));
};

// A new board with the tile at index rotated one quarter turn clockwise.
// Fixed tiles do not move. The input puzzle is not changed.
export const rotateTile = (puzzle: Puzzle, index: number): Puzzle => {
  const tile = tileAt(puzzle, index);
  if (tile.fixed) return puzzle;
  const tiles = puzzle.tiles.slice();
  tiles[index] = { ...tile, rotation: (tile.rotation + 1) % 4 };
  return { ...puzzle, tiles };
};

// A new board with the given rotations applied to every tile.
export const applyRotations = (puzzle: Puzzle, rotations: number[]): Puzzle => ({
  ...puzzle,
  tiles: puzzle.tiles.map((tile, i) => ({
    ...tile,
    rotation: rotations[i] ?? tile.rotation,
  })),
});

// Fewest clicks needed to turn the board into the given rotations. A straight
// tile needs 0 clicks when its openings already match and 1 otherwise, since
// a half turn leaves it unchanged.
export const minClicks = (puzzle: Puzzle, rotations: number[]): number => {
  let total = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const tile = tileAt(puzzle, i);
    if (tile.fixed || tile.type === 'cross') continue;
    const target = rotations[i] ?? tile.rotation;
    const diff = (target - tile.rotation + 4) % 4;
    if (tile.type === 'straight') {
      total += diff % 2 === 0 ? 0 : 1;
    } else {
      total += diff;
    }
  }
  return total;
};

// Build the solved board for a date, then scramble it. The scramble is drawn
// from the seeded RNG, so the same date always gives the same puzzle.
export const generatePuzzle = (date: string): GeneratedPuzzle => {
  const seed = seedFromDate(date);
  const rng = createRng(seed);

  for (let attempt = 0; attempt < 50; attempt++) {
    const built = buildSolvedBoard(rng);
    if (!built) continue;
    // A lamp can end up on another lamp's path and block it. Only boards
    // whose solved state lights every lamp are kept.
    const solved: Puzzle = {
      date,
      seed,
      size: GRID_SIZE,
      tiles: built.tiles,
      sourceIndex: built.sourceIndex,
      lampIndices: built.lampIndices,
      par: 0,
    };
    if (!isSolved(solved)) continue;
    const scrambled = scrambleBoard(date, seed, built, rng);
    if (scrambled) return scrambled;
  }
  throw new Error(`Could not generate a puzzle for ${date}`);
};

type SolvedBoard = {
  tiles: TileState[];
  sourceIndex: number;
  lampIndices: number[];
};

// Random spanning tree over the grid, rooted at the source corner, with the
// lamps attached as leaves. Tile types follow from the tree.
const buildSolvedBoard = (rng: () => number): SolvedBoard | null => {
  const corners = [
    indexOf(0, 0),
    indexOf(GRID_SIZE - 1, 0),
    indexOf(0, GRID_SIZE - 1),
    indexOf(GRID_SIZE - 1, GRID_SIZE - 1),
  ];
  const sourceIndex =
    corners[Math.floor(rng() * corners.length)] ?? indexOf(0, 0);
  const source = coordsOf(sourceIndex);

  // Pick lamp cells away from the source so the path has some length.
  const lampCandidates: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (i === sourceIndex) continue;
    const { x, y } = coordsOf(i);
    if (Math.abs(x - source.x) + Math.abs(y - source.y) < 3) continue;
    lampCandidates.push(i);
  }
  if (lampCandidates.length < LAMP_COUNT) return null;
  const lampIndices: number[] = [];
  while (lampIndices.length < LAMP_COUNT) {
    const pick = lampCandidates.splice(
      Math.floor(rng() * lampCandidates.length),
      1
    )[0];
    if (pick === undefined) return null;
    lampIndices.push(pick);
  }

  // Each lamp opens toward one non-lamp neighbor. Lamps attach to the tree
  // as leaves, so no lamp ever sits on another lamp's path to the source.
  const lampSet = new Set(lampIndices);
  const required = new Map<number, number>(); // lamp -> neighbor it opens toward
  for (const lamp of lampIndices) {
    const { x, y } = coordsOf(lamp);
    const dirs = [0, 1, 2, 3].filter((d) => {
      const { dx, dy } = step(d);
      if (!inGrid(x + dx, y + dy)) return false;
      return !lampSet.has(indexOf(x + dx, y + dy));
    });
    if (dirs.length === 0) return null;
    const dir = dirs[Math.floor(rng() * dirs.length)] ?? 0;
    const { dx, dy } = step(dir);
    required.set(lamp, indexOf(x + dx, y + dy));
  }

  // Prim's algorithm over the non-lamp cells, rooted at the source.
  const inTree = new Array<boolean>(CELL_COUNT).fill(false);
  const treeNeighbors = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (!treeNeighbors.has(a)) treeNeighbors.set(a, new Set());
    if (!treeNeighbors.has(b)) treeNeighbors.set(b, new Set());
    treeNeighbors.get(a)?.add(b);
    treeNeighbors.get(b)?.add(a);
  };
  inTree[sourceIndex] = true;
  let inTreeCount = 1;
  const targetCount = CELL_COUNT - LAMP_COUNT;
  while (inTreeCount < targetCount) {
    const frontier: [number, number][] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (!inTree[i]) continue;
      const { x, y } = coordsOf(i);
      for (let d = 0; d < 4; d++) {
        const { dx, dy } = step(d);
        const nx = x + dx;
        const ny = y + dy;
        if (!inGrid(nx, ny)) continue;
        const next = indexOf(nx, ny);
        if (!inTree[next] && !lampSet.has(next)) frontier.push([i, next]);
      }
    }
    if (frontier.length === 0) return null;
    const edge = frontier[Math.floor(rng() * frontier.length)];
    if (!edge) return null;
    const [from, to] = edge;
    inTree[to] = true;
    inTreeCount++;
    link(from, to);
  }
  // Attach each lamp as a leaf through its required edge.
  for (const [lamp, neighbor] of required) {
    link(lamp, neighbor);
  }

  // Directions from each cell toward its tree neighbors.
  const neighborDirs = (i: number): number[] => {
    const { x, y } = coordsOf(i);
    const dirs: number[] = [];
    for (let d = 0; d < 4; d++) {
      const { dx, dy } = step(d);
      const nx = x + dx;
      const ny = y + dy;
      if (!inGrid(nx, ny)) continue;
      if (treeNeighbors.get(i)?.has(indexOf(nx, ny))) dirs.push(d);
    }
    return dirs;
  };

  const tiles: TileState[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const dirs = neighborDirs(i);
    if (i === sourceIndex) {
      const type = dirs.length === 1 ? 'end' : 'corner';
      tiles.push({
        type,
        role: 'source',
        rotation: rotationFor(type, dirs),
        fixed: true,
      });
      continue;
    }
    if (required.has(i)) {
      const dir = neighborDirs(i).find((d) => {
        const { x, y } = coordsOf(i);
        const { dx, dy } = step(d);
        return indexOf(x + dx, y + dy) === required.get(i);
      });
      const opening = dir ?? dirs[0] ?? 0;
      tiles.push({
        type: 'end',
        role: 'lamp',
        rotation: rotationFor('end', [opening]),
        fixed: true,
      });
      continue;
    }
    const { type, fixed } = tileTypeForDegree(dirs);
    tiles.push({ type, role: 'pipe', rotation: rotationFor(type, dirs), fixed });
  }

  return { tiles, sourceIndex, lampIndices };
};

// Scramble a solved board. Every movable tile is turned away from its solved
// rotation, and the starting board must not already be solved.
const scrambleBoard = (
  date: string,
  seed: number,
  board: SolvedBoard,
  rng: () => number
): GeneratedPuzzle | null => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const tiles = board.tiles.map((tile) => ({ ...tile }));
    const solution: number[] = new Array<number>(CELL_COUNT).fill(0);
    let par = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      const tile = tiles[i];
      if (!tile || tile.fixed) continue;
      // About a third of the tiles start solved, so the board is not a wall
      // of noise and the par stays in the low twenties.
      if (rng() < 0.35) continue;
      // A straight tile turned by 2 looks unchanged, so only turn it by 1 or 3.
      const turn =
        tile.type === 'straight'
          ? rng() < 0.5
            ? 1
            : 3
          : 1 + Math.floor(rng() * 3);
      tile.rotation = (tile.rotation + turn) % 4;
      const toSolve = tile.type === 'straight' ? 1 : (4 - turn) % 4;
      solution[i] = toSolve;
      par += toSolve;
    }
    const puzzle: Puzzle = {
      date,
      seed,
      size: GRID_SIZE,
      tiles,
      sourceIndex: board.sourceIndex,
      lampIndices: board.lampIndices,
      par,
    };
    if (isSolved(puzzle)) continue;
    const solved = applyRotations(puzzle, solutionRotations(puzzle, solution));
    if (!isSolved(solved)) continue;
    return { puzzle, solution };
  }
  return null;
};

// Rotations of the solved board, for checking the solution during generation.
const solutionRotations = (puzzle: Puzzle, solution: number[]): number[] =>
  puzzle.tiles.map((tile, i) => (tile.rotation + (solution[i] ?? 0)) % 4);

// One-line result for sharing in a comment or a post.
export const shareText = (date: string, moves: number, par: number): string =>
  `Daily Circuit ${date}\nSolved in ${moves} moves (par ${par})`;
