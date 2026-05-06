import type { PracticePrompt } from "@/lib/types";

export const PRACTICE_PROMPTS: PracticePrompt[] = [
  {
    id: "intro",
    label: "Executive Introduction",
    brief: "Introduce who you are, what you do, and why your work matters in a calm, formal tone.",
    duration: "45 sec"
  },
  {
    id: "walkthrough",
    label: "Project Walkthrough",
    brief: "Explain a project, the problem it addressed, and the result in one clean minute.",
    duration: "60 sec"
  },
  {
    id: "impromptu",
    label: "Impromptu Response",
    brief: "Answer on the spot: defend one idea you would confidently say in a meeting and why.",
    duration: "30 sec"
  }
];
