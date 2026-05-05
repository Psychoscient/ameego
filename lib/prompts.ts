import type { PracticePrompt } from "@/lib/types";

export const PRACTICE_PROMPTS: PracticePrompt[] = [
  {
    id: "pitch",
    label: "45 Second Demo",
    brief: "Explain to Ameego, why does it matter?.",
    duration: "45 sec"
  },
  {
    id: "demo",
    label: "30 Second Demo",
    brief: "Walk through Ameego what you got, and let it rip!",
    duration: "30 sec"
  },
  {
    id: "story",
    label: "60 Second Demo",
    brief: "Tell Ameego a story, He is a very good listener!",
    duration: "60 sec"
  }
];
