import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './hooks/useGame';
import { Tile } from './components/Tile';

export const App = () => {
  const game = useGame();
  const {
    status,
    board,
    moves,
    won,
    completedToday,
    completedMoves,
    rank,
    saveFailed,
    leaderboard,
    totalToday,
    username,
    localMode,
    copied,
    shareFallback,
    connected,
  } = game;

  if (status === 'loading' || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-200">
        <p className="text-lg">Warming up today's circuit...</p>
      </div>
    );
  }

  const locked = won || completedToday;
  const lampsLit = board.lampIndices.filter((i) => connected.has(i)).length;
  const resultMoves = completedMoves ?? moves;

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-6 text-slate-100">
      <header className="w-full max-w-[400px] text-center">
        <h1 className="text-2xl font-bold tracking-tight text-amber-400">
          Daily Circuit
        </h1>
        <p className="mt-1 text-sm text-slate-400">{board.date}</p>
      </header>

      <div className="mt-4 flex w-full max-w-[400px] items-stretch justify-between gap-2 text-center">
        <div className="flex-1 rounded-lg bg-slate-900 px-2 py-2">
          <div className="text-xl font-bold">{moves}</div>
          <div className="text-xs text-slate-400">Moves</div>
        </div>
        <div className="flex-1 rounded-lg bg-slate-900 px-2 py-2">
          <div className="text-xl font-bold">{board.par}</div>
          <div className="text-xs text-slate-400">Par</div>
        </div>
        <div className="flex-1 rounded-lg bg-slate-900 px-2 py-2">
          <div className="text-xl font-bold">
            {lampsLit}/{board.lampIndices.length}
          </div>
          <div className="text-xs text-slate-400">Lamps lit</div>
        </div>
        <div className="flex-1 rounded-lg bg-slate-900 px-2 py-2">
          <div className="text-xl font-bold">{totalToday}</div>
          <div className="text-xs text-slate-400">Played today</div>
        </div>
      </div>

      {completedToday && (
        <div className="mt-4 w-full max-w-[400px] rounded-lg bg-amber-400/10 px-3 py-2 text-center text-sm text-amber-200">
          Done for today. You finished in {completedMoves} moves
          {rank ? `, ranked #${rank}` : ''}. A new circuit arrives tomorrow.
        </div>
      )}

      {won && !completedToday && saveFailed && (
        <div className="mt-4 w-full max-w-[400px] rounded-lg bg-red-400/10 px-3 py-2 text-center text-sm text-red-200">
          All lamps lit, but your score did not save.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => game.retrySave()}
          >
            Try again
          </button>
        </div>
      )}

      <div className="mt-4 grid w-full max-w-[400px] grid-cols-5 gap-1.5">
        {board.tiles.map((tile, i) => (
          <Tile
            key={i}
            tile={tile}
            lit={connected.has(i)}
            disabled={locked}
            onRotate={() => game.rotate(i)}
          />
        ))}
      </div>

      <div className="mt-4 flex w-full max-w-[400px] gap-2">
        <button
          type="button"
          onClick={() => game.reset()}
          disabled={moves === 0 || locked}
          className="flex-1 rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-slate-400 disabled:cursor-default disabled:opacity-40"
        >
          Start over
        </button>
        <button
          type="button"
          onClick={() => game.share()}
          disabled={!locked}
          className="flex-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-default disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Share result'}
        </button>
      </div>

      {shareFallback && (
        <div className="mt-3 w-full max-w-[400px] rounded-lg bg-slate-900 px-3 py-2">
          <p className="text-xs text-slate-400">
            Copying did not work here, so here is your result to copy by hand:
          </p>
          <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-100">
            {shareFallback}
          </pre>
        </div>
      )}

      {leaderboard.length > 0 && (
        <section className="mt-5 w-full max-w-[400px]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
            Today's leaderboard
          </h2>
          <ol className="mt-2 divide-y divide-slate-800 rounded-lg bg-slate-900 px-3">
            {leaderboard.map((entry, i) => (
              <li
                key={entry.username}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-slate-300">
                  <span className="mr-2 text-slate-500">#{i + 1}</span>
                  {entry.username === username ? (
                    <strong>{entry.username} (you)</strong>
                  ) : (
                    entry.username
                  )}
                </span>
                <span className="font-mono text-amber-300">
                  {entry.moves} moves
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-5 w-full max-w-[400px] text-sm text-slate-400">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          How to play
        </h2>
        <p className="mt-1">
          Tap a tile to turn it. Connect the power source to every lamp. Each
          tap counts as one move, so fewer moves is a better score. The board
          is the same for everyone today, and a new one arrives tomorrow.
        </p>
        {localMode && (
          <p className="mt-2 text-xs text-slate-500">
            Local demo: scores stay in this browser and do not reach Reddit.
          </p>
        )}
      </section>

      <footer className="mt-6 text-xs text-slate-500">
        Result: {resultMoves} moves, par {board.par}
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
