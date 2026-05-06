# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 15 + React 19 app. Main app entrypoints live in [`app/`](./app): [`page.tsx`](./app/page.tsx) mounts the UI, [`layout.tsx`](./app/layout.tsx) sets fonts and global shell, and [`api/analyze-speech/route.ts`](./app/api/analyze-speech/route.ts) handles speech analysis requests. The main frontend lives in [`components/coach-app.tsx`](./components/coach-app.tsx). Shared logic and types are in [`lib/`](./lib), especially `analysis.ts`, `gemini.ts`, `prompts.ts`, and `types.ts`. Static assets belong in [`public/`](./public), and design/product references live in [`reference/`](./reference).

## Build, Test, and Development Commands
- `npm run dev`: start the local Next.js dev server.
- `npm run build`: production build; this is the primary validation command today.
- `npm run start`: serve the built app locally after `npm run build`.

There is no dedicated lint or test script yet. Before opening a PR, at minimum run `npm run build`.

## Coding Style & Naming Conventions
Use TypeScript, functional React components, and existing Next.js app-router patterns. Follow the current style:
- 2-space indentation in TS/TSX and CSS.
- `camelCase` for variables/functions, `PascalCase` for components and types.
- Keep route/API names descriptive and lowercase (`app/api/analyze-speech`).
- Prefer small helper functions in `lib/` for reusable logic instead of growing `coach-app.tsx` further.

Use ASCII by default. Match the existing warm-pixel design system in `app/globals.css` rather than introducing unrelated UI patterns.

## Testing Guidelines
There is no formal test suite yet. Validate changes with:
- `npm run build`
- manual checks in the browser for the affected flow

When adding tests later, keep them close to the feature and name them after behavior, for example `coach-app.practice-flow.test.ts`.

## Commit & Pull Request Guidelines
Current history uses short, plain-language commit subjects (`initial fullstack`, `Updated Front End Version...`). Keep commits concise and imperative, for example:
- `Add assessment landing flow`
- `Fix MediaRecorder MIME selection`

PRs should include:
- a short summary of user-visible changes
- screenshots or recordings for UI work
- notes on validation performed
- any env/config changes needed to run locally

## Security & Configuration Tips
Secrets belong in `.env.local`; do not commit them. Use `.env.example` when adding new variables. Treat recorded media and Gemini-related code paths carefully: preserve the current behavior of sending media for analysis without adding unnecessary persistence.
