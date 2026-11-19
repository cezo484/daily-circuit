import './index.css';

import { StrictMode, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { dateKey } from '../shared/puzzle';
import { expandToGame } from './devvit';

export const Splash = () => {
  const today = dateKey(new Date());

  const play = async (e: MouseEvent) => {
    const expanded = await expandToGame(e.nativeEvent);
    if (!expanded) {
      // No Devvit SDK here, so this is the local demo: open the game page.
      window.location.href = 'game.html';
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 py-8 text-slate-100">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-amber-400">
          Daily Circuit
        </h1>
        <p className="text-sm text-slate-400">{today}</p>
        <p className="mt-2 max-w-[320px] text-base text-slate-300">
          A new circuit puzzle every day. Turn the tiles, connect the power
          source to every lamp, and finish in as few moves as you can.
        </p>
      </div>
      <button
        type="button"
        className="flex h-11 cursor-pointer items-center justify-center rounded-full bg-amber-500 px-6 text-base font-bold text-slate-950 transition-colors hover:bg-amber-400"
        onClick={play}
      >
        Play today's circuit
      </button>
      <p className="text-xs text-slate-500">
        One play per day. Same board for everyone.
      </p>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
