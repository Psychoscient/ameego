import type { PracticePrompt } from "@/lib/types";

export const PRACTICE_PROMPTS: PracticePrompt[] = [
  {
    id: "pitch",
    label: "Startup Pitch",
    brief: "Explain what Ameego is, why it matters, and why judges should remember it.",
    duration: "45 sec"
  },
  {
    id: "demo",
    label: "Demo Narration",
    brief: "Walk through one product flow and make the value obvious without drifting into filler.",
    duration: "30 sec"
  },
  {
    id: "story",
    label: "Personal Story",
    brief: "Share a short challenge-and-growth story that shows credibility and clarity.",
    duration: "60 sec"
  }
];
