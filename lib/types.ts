export type StructureStatus = "structured" | "partial" | "unclear";
export type NonverbalStatus = "needs-attention" | "steady" | "strong";
export type PlacementLevel = "Beginner" | "Developing" | "Intermediate" | "Advanced";
export type SessionType = "assessment" | "practice";
export type DrillId =
  | "pause-control"
  | "pacing-ladder"
  | "point-example-close"
  | "one-minute-explanation"
  | "impromptu-pressure-round"
  | "persuasive-answer";

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
  promptCompletionScore: number;
  repetitionScore: number;
  uniqueWordRatio: number;
  topRepeatedTerms: Array<{
    term: string;
    count: number;
  }>;
  rushedSections: number;
  unevenPacing: boolean;
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

export type RecommendedDrill = {
  id: DrillId;
  title: string;
  summary: string;
  focusMetric: "fillers" | "pacing" | "structure" | "clarity" | "repetition" | "delivery";
};

export type FollowUpQuestion = {
  id: string;
  prompt: string;
  intent: string;
};

export type AnalysisResponse = {
  transcript: string;
  durationSeconds: number;
  metrics: SpeechMetrics;
  score: number;
  feedback: string[];
  recommendedDrill: RecommendedDrill;
  followUpQuestions: FollowUpQuestion[];
  sessionType: SessionType;
  promptId?: string;
  promptLabel?: string;
  placementLevel?: PlacementLevel;
  nonverbal?: NonverbalAnalysis | null;
};

export type PracticePrompt = {
  id: string;
  label: string;
  brief: string;
  duration: string;
};

export type SessionRecord = {
  id: string;
  completedAt: string;
  promptId?: string;
  promptLabel?: string;
  sessionType: SessionType;
  drillId?: DrillId;
  drillTitle?: string;
  analysis: AnalysisResponse;
};

export type ModuleProgress = {
  currentModuleId: string;
  completedModuleIds: string[];
};

export type UserProfile = {
  placementLevel?: PlacementLevel;
  assessmentCompletedAt?: string;
};
