import type { Puzzle } from './puzzle';

export type LeaderboardEntry = {
  username: string;
  moves: number;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  date: string;
  puzzle: Puzzle;
  completed: boolean;
  completedMoves: number | null;
  leaderboard: LeaderboardEntry[];
  totalToday: number;
};

export type CompleteRequest = {
  moves: number;
  rotations: number[];
};

export type CompleteResponse = {
  type: 'complete';
  ok: boolean;
  moves: number;
  rank: number;
  totalToday: number;
  alreadyCompleted: boolean;
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  date: string;
  entries: LeaderboardEntry[];
  totalToday: number;
};
