import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  connectedSet,
  dateKey,
  generatePuzzle,
  isSolved,
  rotateTile,
  shareText,
} from '../../shared/puzzle';
import type { Puzzle } from '../../shared/puzzle';
import type {
  CompleteResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
} from '../../shared/api';
import { showToast } from '../devvit';

export type GameStatus = 'loading' | 'ready' | 'error';

type GameState = {
  status: GameStatus;
  puzzle: Puzzle | null;
  board: Puzzle | null;
  moves: number;
  won: boolean;
  completedToday: boolean;
  completedMoves: number | null;
  rank: number | null;
  saveFailed: boolean;
  leaderboard: LeaderboardEntry[];
  totalToday: number;
  username: string | null;
  localMode: boolean;
  copied: boolean;
  shareFallback: string | null;
};

const initialState: GameState = {
  status: 'loading',
  puzzle: null,
  board: null,
  moves: 0,
  won: false,
  completedToday: false,
  completedMoves: null,
  rank: null,
  saveFailed: false,
  leaderboard: [],
  totalToday: 0,
  username: null,
  localMode: false,
  copied: false,
  shareFallback: null,
};

const doneKey = (date: string): string => `daily-circuit:done:${date}`;

export const useGame = () => {
  const [state, setState] = useState<GameState>(initialState);
  const copiedTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/init');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: InitResponse = await res.json();
        if (data.type !== 'init') throw new Error('Unexpected response');
        setState((prev) => ({
          ...prev,
          status: 'ready',
          puzzle: data.puzzle,
          board: data.puzzle,
          username: data.username,
          completedToday: data.completed,
          completedMoves: data.completedMoves,
          leaderboard: data.leaderboard,
          totalToday: data.totalToday,
        }));
      } catch {
        // No Devvit server reachable: run the same puzzle locally. The daily
        // seed is shared logic, so the local board matches the Reddit one.
        const date = dateKey(new Date());
        const { puzzle } = generatePuzzle(date);
        const stored = window.localStorage.getItem(doneKey(date));
        const completedMoves = stored ? parseInt(stored, 10) : null;
        setState((prev) => ({
          ...prev,
          status: 'ready',
          puzzle,
          board: puzzle,
          localMode: true,
          completedToday: completedMoves !== null,
          completedMoves: Number.isNaN(completedMoves) ? null : completedMoves,
        }));
      }
    };
    void init();
    return () => {
      window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const finish = useCallback(
    async (finalMoves: number, finalBoard: Puzzle, local: boolean) => {
      if (local) {
        window.localStorage.setItem(doneKey(finalBoard.date), String(finalMoves));
        setState((prev) => ({
          ...prev,
          completedToday: true,
          completedMoves: finalMoves,
        }));
        return;
      }
      try {
        const res = await fetch('/api/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moves: finalMoves,
            rotations: finalBoard.tiles.map((t) => t.rotation),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: CompleteResponse = await res.json();
        setState((prev) => ({
          ...prev,
          completedToday: true,
          completedMoves: data.moves,
          rank: data.rank,
          totalToday: data.totalToday,
          saveFailed: false,
        }));
        const lb = await fetch('/api/leaderboard');
        if (lb.ok) {
          const lbData: LeaderboardResponse = await lb.json();
          setState((prev) => ({
            ...prev,
            leaderboard: lbData.entries,
            totalToday: lbData.totalToday,
          }));
        }
      } catch (err) {
        console.error('Failed to save score', err);
        setState((prev) => ({ ...prev, saveFailed: true }));
      }
    },
    []
  );

  const rotate = useCallback(
    (index: number) => {
      setState((prev) => {
        if (
          prev.status !== 'ready' ||
          !prev.board ||
          prev.won ||
          prev.completedToday
        ) {
          return prev;
        }
        const tile = prev.board.tiles[index];
        if (!tile || tile.fixed) return prev;
        const board = rotateTile(prev.board, index);
        const moves = prev.moves + 1;
        const won = isSolved(board);
        if (won) {
          void finish(moves, board, prev.localMode);
        }
        return { ...prev, board, moves, won };
      });
    },
    [finish]
  );

  const reset = useCallback(() => {
    setState((prev) => {
      if (!prev.puzzle || prev.won || prev.completedToday) return prev;
      return { ...prev, board: prev.puzzle, moves: 0 };
    });
  }, []);

  const retrySave = useCallback(() => {
    setState((prev) => {
      if (!prev.board || !prev.won) return prev;
      void finish(prev.moves, prev.board, prev.localMode);
      return { ...prev, saveFailed: false };
    });
  }, [finish]);

  const share = useCallback(() => {
    setState((prev) => {
      if (!prev.puzzle) return prev;
      const moves = prev.completedMoves ?? prev.moves;
      const text = shareText(prev.puzzle.date, moves, prev.puzzle.par);
      const done = () => {
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => {
          setState((s) => ({ ...s, copied: false }));
        }, 2000);
      };
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            void showToast('Result copied');
            setState((s) => ({ ...s, copied: true, shareFallback: null }));
            done();
          })
          .catch(() => {
            setState((s) => ({ ...s, shareFallback: text }));
          });
      } else {
        return { ...prev, shareFallback: text };
      }
      return prev;
    });
  }, []);

  const connected = useMemo(() => {
    if (!state.board) return new Set<number>();
    return connectedSet(state.board);
  }, [state.board]);

  return { ...state, connected, rotate, reset, retrySave, share };
};
