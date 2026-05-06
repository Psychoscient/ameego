export type StructureStatus = "structured" | "partial" | "unclear";
export type NonverbalStatus = "needs-attention" | "steady" | "strong";

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

export type NonverbalSignal = {
  score: number;
  status: NonverbalStatus;
  note: string;
};

export type NonverbalAnalysis = {
  eyeContact: NonverbalSignal;
  posturePresence: NonverbalSignal;
  gestureActivity: NonverbalSignal;
  feedback: string[];
};

export type AnalysisResponse = {
  transcript: string;
  durationSeconds: number;
  metrics: SpeechMetrics;
  score: number;
  feedback: string[];
  nonverbal?: NonverbalAnalysis | null;
};

export type PracticePrompt = {
  id: string;
  label: string;
  brief: string;
  duration: string;
};
