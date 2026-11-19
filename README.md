# Daily Circuit

A daily puzzle game for Reddit, built on Devvit Web. Each day brings one new
circuit board. Everyone plays the same board, and everyone gets one completed
play per day.

Built for Reddit's Game of the Day Hackathon 2026.

## How to play

The board is a 5x5 grid of tiles. One tile is the power source. Three tiles
are lamps. The rest are pipe segments.

- Tap a tile to turn it 90 degrees clockwise.
- Connect the power source to every lamp. A pipe lights up amber once current
  reaches it, so you can see which parts of your circuit are live.
- Each tap counts as one move. Fewer moves is a better score.
- The source, the lamps, and the cross tiles are fixed. Everything else turns.
- The board shows a par, the number of moves the intended solution takes.
  Beating par is possible when a shortcut exists.

When all three lamps light up, your score is saved and the board locks until
tomorrow. The Share result button copies a short result line you can paste
into a comment:

```
Daily Circuit 2026-11-19
Solved in 14 moves (par 12)
```

The daily leaderboard lists the lowest move counts for the day.

## How the daily seed works

The puzzle comes from the UTC date. The date string (for example
`2026-11-19`) is hashed with FNV-1a into a 32-bit seed, and that seed drives a
small deterministic generator (Mulberry32). The same date always produces the
same board on every device, with no stored puzzle list and no server-side
randomness.

Generation builds the board solved, then scrambles it:

1. The power source is placed in a random corner.
2. Three lamp cells are picked at least three steps away from the source.
3. A random spanning tree is grown over the other cells from the source, and
   each lamp is attached as a leaf. Tile shapes follow from the tree: a cell
   with two opposite neighbors becomes a straight pipe, two adjacent neighbors
   a corner, three a T junction, four a cross.
4. About two thirds of the movable tiles are turned away from their solved
   rotation. The rest start solved, so the board is readable at a glance.

Because the board starts solved and only rotations are applied, every daily
puzzle has a known solution. The tests verify this for a full year of dates.

One play per day is enforced on the server. A finished score is stored in
Redis under the date and the player's username, and a second completion the
same day returns the first score instead of overwriting it.

## Project layout

```
devvit.json                  App manifest: name, entrypoints, menu, triggers
src/client/                  React UI (splash inline view, game expanded view)
src/client/hooks/useGame.ts  Game state, server calls, local demo fallback
src/client/components/       Tile rendering (SVG pipes, source, lamps)
src/server/                  Hono server: /api/init, /api/complete, /api/leaderboard
src/shared/puzzle.ts         Puzzle logic, shared by client, server, and tests
src/shared/puzzle.test.ts    Tests (node:test)
scripts/serve-demo.mjs       Static server for the local demo
```

The client talks to the server over plain fetch calls to `/api/*`. The server
never sends the solution to the client. When a player finishes, the client
sends the final board and the move count, and the server regenerates the
puzzle, checks that the board lights every lamp, and checks that the move
count is at least the clicks that board needs.

## Local demo

No Reddit account is needed to play the game on your own machine. The demo
serves the built client, and the game detects the missing Devvit server and
falls back to local mode: the same date-seeded puzzle, with completion stored
in the browser's localStorage instead of Redis.

Requirements: Node.js 24 or newer.

```bash
npm install
npm run demo
```

Then open http://localhost:4173/game.html. The splash page is at
http://localhost:4173/splash.html. The demo port can be changed with
`DEMO_PORT`.

## Commands

- `npm run dev`: Playtest on Reddit (needs `devvit login` first, see below).
- `npm run demo`: Build and serve the local demo on port 4173.
- `npm run build`: Build the client and server into `dist/`.
- `npm run test:unit`: Run the puzzle tests.
- `npm run test:types`: Typecheck the app and the tests.
- `npm run lint`: Lint the sources.
- `npm run deploy`: Typecheck, lint, and upload a new version.
- `npm run launch`: Upload and publish for review.
- `npm run login`: Log the Devvit CLI into Reddit.

## Tests

`npm run test:unit` runs the puzzle suite with node:test. It covers:

- Seeded generation is deterministic per date and differs across dates.
- Every puzzle in a full year of dates is solvable, starts unsolved, and has
  a positive par.
- Playing the solution one tap at a time wins in exactly par moves.
- Tile rotation, fixed tiles, win detection, and the share text.

## Running it on Reddit

These steps need a Reddit account and a test subreddit. Nothing here creates
accounts or posts by itself.

1. Install the Devvit CLI if it is not already installed:
   `npm install -g devvit`.
2. Log in: `npm run login`. This opens a browser window to connect the CLI
   to your Reddit account.
3. Create a test subreddit that you moderate, with fewer than 200 members.
   The hackathon rules ask for the demo post to live in a small public
   subreddit.
4. Start playtest: `npm run dev`. The CLI installs the app into your test
   subreddit and rebuilds on every save. Open the playtest link it prints.
5. Make the demo post from the subreddit mod menu: "Create a Daily Circuit
   post". Installing the app also creates one automatically.
6. Upload a version when the game plays well: `npm run deploy`. The app
   listing appears at https://developers.reddit.com/apps/daily-circuit.
7. Publishing is not required for the hackathon. Judges evaluate the demo
   post. `npm run launch` publishes for review only if you want the app
   listed.

If the name `daily-circuit` is already taken on the platform, change `name`
in `devvit.json` and in `package.json` to something free, then upload again.

## Submission notes

- Deadline: December 8, 2026, 6:00 PM Pacific Time (December 9, 05:00 TRT).
- The Devpost submission needs a text description, the app listing link from
  step 6 above, and a link to the demo post in the test subreddit. The
  subreddit must be public, or the dr-admin-approve app must be installed in
  it so judges can join.
- The demo video is optional and should stay under one minute. A screen
  recording of one full play, from the post to the share line, covers it.
- The repository link is optional. The code is MIT licensed.
- The feedback survey on the hackathon page is optional and qualifies the
  entry for the Most Valuable Feedback bonus prize.

## Stack

React 19, TypeScript, Tailwind CSS 4, Vite, Hono, and Devvit Web
(`@devvit/web` 0.15). Scores live in Devvit Redis. No external services, no
keys, and no accounts are needed to run the game.
