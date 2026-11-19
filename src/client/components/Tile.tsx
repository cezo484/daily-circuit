import type { TileState } from '../../shared/puzzle';

type TileProps = {
  tile: TileState;
  lit: boolean;
  disabled: boolean;
  onRotate: () => void;
};

// Base openings (rotation 0) as line endpoints from the tile center.
const BASE_OPENINGS: Record<TileState['type'], number[]> = {
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 2],
  cross: [0, 1, 2, 3],
  end: [0],
};

// Endpoints for north, east, south, west on a 100x100 canvas.
const ENDPOINTS: [number, number][] = [
  [50, 2],
  [98, 50],
  [50, 98],
  [2, 50],
];

export const Tile = ({ tile, lit, disabled, onRotate }: TileProps) => {
  const pipeColor = lit ? '#f59e0b' : '#7d8aa0';
  const lines = BASE_OPENINGS[tile.type].map((dir) => {
    const endpoint = ENDPOINTS[dir] ?? [50, 50];
    const [x2, y2] = endpoint;
    return (
      <line
        key={dir}
        x1="50"
        y1="50"
        x2={x2}
        y2={y2}
        stroke={pipeColor}
        strokeWidth="16"
        strokeLinecap="round"
      />
    );
  });

  return (
    <button
      type="button"
      aria-label={
        tile.role === 'source'
          ? 'Power source'
          : tile.role === 'lamp'
            ? `Lamp, ${lit ? 'lit' : 'unlit'}`
            : `Pipe tile, tap to rotate`
      }
      onClick={onRotate}
      disabled={disabled || tile.fixed}
      className={`relative aspect-square w-full rounded-lg border transition-colors ${
        tile.fixed
          ? 'cursor-default border-slate-700 bg-slate-800'
          : 'cursor-pointer border-slate-600 bg-slate-700/60 hover:border-amber-400/70 hover:bg-slate-700'
      }`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <g transform={`rotate(${tile.rotation * 90} 50 50)`}>{lines}</g>
        {tile.role === 'source' && (
          <polygon
            points="56,18 36,54 48,54 42,82 66,44 53,44"
            fill="#facc15"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {tile.role === 'lamp' && (
          <>
            {lit && (
              <circle cx="50" cy="50" r="26" fill="#facc15" opacity="0.25" />
            )}
            <circle
              cx="50"
              cy="50"
              r="16"
              fill={lit ? '#fde047' : '#1e293b'}
              stroke={lit ? '#f59e0b' : '#7d8aa0'}
              strokeWidth="3"
            />
          </>
        )}
      </svg>
      {tile.fixed && tile.role === 'pipe' && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
      )}
    </button>
  );
};
