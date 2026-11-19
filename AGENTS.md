You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Vite
- **Backend**: Node.js serverless environment (Devvit), Hono
- **Communication**: Plain fetch calls to `/api/*`, typed through `src/shared/api.ts`

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `index.ts`: Main server entry point (Hono app).
  - `routes/api.ts`: Game endpoints (`/init`, `/complete`, `/leaderboard`).
  - `routes/menu.ts`, `routes/triggers.ts`: Menu actions and install trigger.
  - `core/post.ts`: Creates the interactive post.
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create a HTML file and add to the mapping inside of `devvit.json`
  - Entrypoints:
    - `game.html`: The main React entry point (Expanded View).
    - `splash.html`: The initial React entry point (Inline View). This will be shown in the reddit.com feed. Please keep it fast and keep heavy dependencies inside of `game.html`
  - `devvit.ts`: Lazy wrapper around `@devvit/web/client`. The game also runs
    as a plain web page for the local demo, so SDK calls must stay optional.
- `/src/shared`: **Shared Code**. Code to share between the client and server
  - `puzzle.ts`: Date-seeded puzzle generation and rules. Pure logic, no
    platform dependencies. The server never sends the solution to the client.
  - `puzzle.test.ts`: Tests, run with `node --test`.

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`
- Exception: `splash.tsx` falls back to `window.location.href = 'game.html'`
  only when the Devvit SDK is absent (the local demo).

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run test:types`: Check typescript types (app plus tests)
- `npm run lint`: Check the linter
- `npm run test:unit`: Run the puzzle tests
- `npm run demo`: Build and serve the local demo on port 4173

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
