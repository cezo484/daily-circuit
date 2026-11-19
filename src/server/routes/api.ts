import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import {
  CELL_COUNT,
  applyRotations,
  dateKey,
  generatePuzzle,
  isSolved,
  minClicks,
} from '../../shared/puzzle';
import type {
  CompleteRequest,
  CompleteResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

// One score hash per day: username -> moves. A player who already finished
// today keeps their first score, so one completed play per day is enforced.
const scoresKey = (date: string): string => `daily-circuit:scores:${date}`;

const readScores = async (date: string): Promise<Map<string, number>> => {
  const raw = await redis.hGetAll(scoresKey(date));
  const scores = new Map<string, number>();
  for (const [username, moves] of Object.entries(raw)) {
    const parsed = parseInt(moves, 10);
    if (!Number.isNaN(parsed)) scores.set(username, parsed);
  }
  return scores;
};

const topScores = (scores: Map<string, number>, limit: number): LeaderboardEntry[] =>
  [...scores.entries()]
    .map(([username, moves]) => ({ username, moves }))
    .sort((a, b) => a.moves - b.moves || a.username.localeCompare(b.username))
    .slice(0, limit);

const rankOf = (scores: Map<string, number>, moves: number): number => {
  let rank = 1;
  for (const other of scores.values()) {
    if (other < moves) rank++;
  }
  return rank;
};

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required but missing from context' },
      400
    );
  }

  try {
    const date = dateKey(new Date());
    const { puzzle } = generatePuzzle(date);
    const [username, scores] = await Promise.all([
      reddit.getCurrentUsername(),
      readScores(date),
    ]);
    const name = username ?? 'anonymous';
    const completedMoves = scores.get(name) ?? null;

    return c.json<InitResponse>({
      type: 'init',
      postId,
      username: name,
      date,
      puzzle,
      completed: completedMoves !== null,
      completedMoves,
      leaderboard: topScores(scores, 5),
      totalToday: scores.size,
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const message =
      error instanceof Error
        ? `Initialization failed: ${error.message}`
        : 'Unknown error during initialization';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

api.post('/complete', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  let body: CompleteRequest;
  try {
    body = await c.req.json<CompleteRequest>();
  } catch {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Request body must be JSON' },
      400
    );
  }

  const { moves, rotations } = body;
  if (
    !Number.isInteger(moves) ||
    moves < 1 ||
    moves > 500 ||
    !Array.isArray(rotations) ||
    rotations.length !== CELL_COUNT ||
    rotations.some((r) => !Number.isInteger(r) || r < 0 || r > 3)
  ) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Invalid completion payload' },
      400
    );
  }

  try {
    const date = dateKey(new Date());
    const { puzzle } = generatePuzzle(date);

    // Fixed tiles must be untouched, the final board must light every lamp,
    // and the move count must be at least the clicks the board needs.
    const fixedTouched = puzzle.tiles.some(
      (tile, i) => tile.fixed && rotations[i] !== tile.rotation
    );
    const finalBoard = applyRotations(puzzle, rotations);
    if (fixedTouched || !isSolved(finalBoard)) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'That board does not light every lamp' },
        400
      );
    }
    if (moves < minClicks(puzzle, rotations)) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Move count does not match the board' },
        400
      );
    }

    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const scores = await readScores(date);
    const existing = scores.get(username);
    if (existing !== undefined) {
      return c.json<CompleteResponse>({
        type: 'complete',
        ok: true,
        moves: existing,
        rank: rankOf(scores, existing),
        totalToday: scores.size,
        alreadyCompleted: true,
      });
    }

    await redis.hSet(scoresKey(date), { [username]: String(moves) });
    scores.set(username, moves);
    return c.json<CompleteResponse>({
      type: 'complete',
      ok: true,
      moves,
      rank: rankOf(scores, moves),
      totalToday: scores.size,
      alreadyCompleted: false,
    });
  } catch (error) {
    console.error(`API Complete Error for post ${postId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Unknown error saving score';
    return c.json<ErrorResponse>({ status: 'error', message }, 400);
  }
});

api.get('/leaderboard', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }
  const date = dateKey(new Date());
  const scores = await readScores(date);
  return c.json<LeaderboardResponse>({
    type: 'leaderboard',
    date,
    entries: topScores(scores, 10),
    totalToday: scores.size,
  });
});
