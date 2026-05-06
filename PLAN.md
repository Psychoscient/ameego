# AMEEGO — Implementation Plan

## 1. Product Definition

Ameego is an AI-powered formal speaking coach that helps users improve public communication through speech analysis, measurable feedback, and guided practice.

Core goal:
Turn speaking into a measurable, trainable skill.

---

## 2. Core Product Loop

The entire system revolves around this loop:

1. User records speech
2. System transcribes speech
3. System analyzes:

   * filler words
   * pacing
   * structure
   * clarity
4. System generates:

   * Speaking Readiness Score
   * actionable feedback
5. User retries and improves

If this loop is strong, the product works.

---

## 3. MVP Scope (STRICT)

### 3.1 Core Features (Must Work)

* Speech Recording (browser)
* Speech-to-Text (API)
* Filler Word Detection (deterministic)
* Pacing Analysis (WPM + pauses)
* Basic Structure Detection
* LLM-based Clarity Feedback
* Speaking Readiness Score
* Feedback Display UI

---

### 3.2 Secondary Features (Only if Stable)

* 1–2 Practice Drills
* Basic Progress Tracking (latest score only)

---

### 3.3 Deferred (DO NOT BUILD NOW)

* AI video simulations
* body language detection
* emotion/tone detection
* real-time conversation mode
* full dashboard analytics

---

## 4. Technical Architecture

### Frontend

* React (UI + recording)
* Handles:

  * user interaction
  * audio capture
  * displaying feedback

---

### Backend (Next.js API routes)

Acts as a thin logic layer:

Endpoints:

* `/api/analyze-speech`

Responsibilities:

1. Receive audio
2. Send to STT API
3. Process transcript
4. Compute metrics
5. Call LLM for feedback
6. Return results

---

### AI Services

Speech-to-Text:

* Whisper API

Language Analysis:

* OpenAI (or equivalent)

---

## 5. Analysis System (IMPORTANT)

### 5.1 Filler Word Detection

Method:

* predefined dictionary:
  ["um", "uh", "like", "you know", "basically", "so"]

Output:

* count per word
* total filler count

---

### 5.2 Pacing Analysis

Metrics:

* Words Per Minute (WPM)
* Pause detection (timestamp gaps)

Ranges:

* <110 WPM → too slow
* 110–160 WPM → optimal
* > 160 WPM → too fast

---

### 5.3 Structure Detection

Heuristic:

* detect keywords:

  * opening: "today", "I will"
  * transitions: "first", "next"
  * closing: "in conclusion"

Output:

* structured / partially structured / unclear

---

### 5.4 Clarity (LLM-based)

Prompt:

* evaluate clarity of ideas
* detect repetition
* suggest improvements

---

## 6. Speaking Readiness Score

Weighted scoring system:

Score =
(Clarity × 0.25) +
(Structure × 0.20) +
(Pacing × 0.20) +
(Filler Control × 0.20) +
(Completion × 0.15)

Scale:
0–10

---

## 7. API Flow

1. Frontend sends audio → `/api/analyze-speech`
2. Backend:

   * calls Whisper → transcript + timestamps
   * computes:

     * filler count
     * WPM
     * pauses
   * calls LLM → clarity + structure feedback
3. Backend returns:

```json
{
  "transcript": "...",
  "metrics": {
    "wpm": 145,
    "fillerCount": 12,
    "structureScore": 7
  },
  "score": 7.2,
  "feedback": "Clear message but too many fillers..."
}
```

---

## 8. Team Responsibilities

### Developer A (AI / Backend Logic)

* API route (`/api/analyze-speech`)
* scoring system
* prompt design
* analysis logic

---

### Developer B (Frontend / UX)

* recording UI
* results screen
* feedback visualization
* user flow

---

## 9. Development Phases

### Phase 1 (Day 1)

* UI skeleton
* audio recording
* basic API route

---

### Phase 2 (Day 2)

* integrate STT
* implement filler + pacing logic

---

### Phase 3 (Day 3)

* integrate LLM feedback
* implement scoring system

---

### Phase 4 (Day 4)

* polish UI
* test full loop
* prepare demo

---

## 10. Demo Flow (CRITICAL)

1. User selects prompt
2. Records speech (30–60 sec)
3. System analyzes
4. Shows:

   * score
   * filler count
   * pacing
   * feedback
5. User retries → improved score

---

## 11. Success Criteria

The product is successful if:

* analysis feels accurate
* feedback feels actionable
* improvement is visible after retry
* demo runs without failure

---

## 12. Key Risk

The biggest risk is NOT tech.

It is:

* vague feedback
* weak scoring logic
* poor UX loop

Mitigation:
Focus on making ONE scenario work extremely well.

---

## 13. Final Principle

Do not build more features.

Make the core loop:
**fast, accurate, and useful.** 