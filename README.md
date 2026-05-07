# Ameego

Ameego is a browser-based AI speaking coach built as a hackathon MVP. It helps users practice short spoken responses, analyzes delivery with Gemini, and turns each session into concrete coaching feedback, follow-up questions, and recommended drills.

The current app supports a full demo loop:

- initial assessment with placement
- browser recording with microphone and optional camera
- transcript + speaking analysis
- recommended drills and follow-up questions
- progress dashboard with saved local history
- guided drill mode tied to the user’s weakest area

## What It Does

Ameego is designed to feel like a lightweight speaking coach rather than a generic recorder. The frontend uses a guided multi-screen flow and an `Ameego Buddy` coach layer to walk users through assessment, practice, drill attempts, and review.

Implemented coaching features include:

- speaking readiness score
- filler-word detection
- pacing analysis with WPM and uneven pacing checks
- pause and structure analysis
- repetition and unique-word-ratio signals
- prompt-completion scoring
- placement levels: `Beginner`, `Developing`, `Intermediate`, `Advanced`
- AI-generated or fallback follow-up questions
- recommended drills such as pause control, pacing, and point-example-close
- optional nonverbal feedback when a video clip is recorded

## Product Flow

1. A new user starts with an assessment.
2. The app records audio or audio+video in the browser.
3. The recording is sent to `POST /api/analyze-speech`.
4. Gemini is used for transcription, clarity feedback, follow-up generation, and optional nonverbal feedback.
5. Local analysis computes speaking metrics and an overall score.
6. The user lands on a dashboard with placement, score history, recommended drills, and module progress.
7. The user can continue with general practice or run a dedicated drill attempt.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Google Gemini API

## Project Structure

- [`app/page.tsx`](./app/page.tsx): mounts the main app UI
- [`app/layout.tsx`](./app/layout.tsx): root layout and global shell
- [`app/api/analyze-speech/route.ts`](./app/api/analyze-speech/route.ts): speech-analysis API route
- [`components/coach-app.tsx`](./components/coach-app.tsx): main frontend application flow and UI
- [`lib/analysis.ts`](./lib/analysis.ts): deterministic scoring, drill recommendations, and placement helpers
- [`lib/gemini.ts`](./lib/gemini.ts): Gemini transcription, feedback, follow-up, and nonverbal helpers
- [`lib/prompts.ts`](./lib/prompts.ts): practice prompts
- [`lib/types.ts`](./lib/types.ts): shared application types
- [`public/`](./public): mascot, logo, and static assets
- [`reference/`](./reference): design and product reference material

## Local Development

### Requirements

- Node.js 18+ recommended
- npm
- a Gemini API key

### Setup

1. Copy `.env.example` to `.env.local`.
2. Set `GEMINI_API_KEY`.
3. Install dependencies:

```bash
npm install
```

4. Start the dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Environment Variables

Defined in [`.env.example`](./.env.example):

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_AUDIO_MODEL=gemini-2.5-flash
GEMINI_FEEDBACK_MODEL=gemini-2.5-flash
```

## Available Scripts

- `npm run dev`: start the local development server
- `npm run build`: create a production build
- `npm run start`: serve the production build locally

## Validation

There is no formal automated test suite yet. The minimum validation path for changes is:

- `npm run build`
- manual browser checks for the affected flow

For demo readiness, verify:

- homepage loads
- assessment recording works
- API analysis returns a result
- dashboard loads after assessment
- drill mode starts and completes
- follow-up questions and recommended drills render

## Deployment Notes

This project is suitable for a Vercel demo deployment.

Important notes:

- set `GEMINI_API_KEY` in Vercel project environment variables
- microphone and camera access require browser permission
- HTTPS is required for media access outside localhost
- session history is stored in `localStorage`, so it is browser-local
- Gemini availability and quota affect runtime behavior

## Current MVP Constraints

These are intentional limitations of the current codebase:

- no authentication
- no database or cross-device sync
- no real-time live analysis during recording
- no multi-turn conversational coach
- persistence is local to the current browser

## Repository Notes

- Secrets belong in `.env.local` and should not be committed.
- Build output, caches, and local temp files are ignored in [`.gitignore`](./.gitignore).
- The repo follows a single-app structure with most UI logic currently concentrated in [`components/coach-app.tsx`](./components/coach-app.tsx).
