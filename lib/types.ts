export type StructureStatus = "structured" | "partial" | "unclear";

export type SpeechMetrics = {
  wordCount: number;
  wpm: number;
  pacingBand: "slow" | "optimal" | "fast";
  fillerCount: number;
  fillers: Record<string, number>;
  fillerRate: number;
  pauseCount: number;
  longestPauseSeconds: number;
  structureStatus: StructureStatus;
  structureSignals: string[];
  clarityScore: number;
  structureScore: number;
  pacingScore: number;
  fillerScore: number;
  completionScore: number;
};

export type AnalysisResponse = {
  transcript: string;
  durationSeconds: number;
  metrics: SpeechMetrics;
  score: number;
  feedback: string[];
};

export type PracticePrompt = {
  id: string;
  label: string;
  brief: string;
  duration: string;
};
