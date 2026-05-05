# Ameego

Ameego is a hackathon MVP for speech coaching. Record a short pitch in the browser, send it to a Next.js API route, transcribe with Gemini, compute pacing and filler metrics, and return a speaking-readiness score with concise coaching feedback.

## Run locally

1. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
2. Install dependencies with `npm.cmd install`.
3. Start the app with `npm.cmd run dev`.

## MVP flow

- Choose a practice prompt.
- Record a 30-60 second answer.
- Submit the clip for transcription and analysis.
- Review pacing, filler counts, structure, clarity, and overall score.
- Retry and compare the latest result.
