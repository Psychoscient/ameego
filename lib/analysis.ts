import type {
  AnalysisResponse,
  PlacementLevel,
  RecommendedDrill,
  SpeechMetrics,
  StructureStatus
} from "@/lib/types";

type TranscriptSegment = {
  start?: number;
  end?: number;
  text?: string;
};

type ClarityFeedback = {
  clarityScore: number;
  feedback: string[];
};

const FILLER_PATTERNS = [
  "um",
  "uh",
  "like",
  "you know",
  "basically",
  "so"
];

const OPENING_CUES = ["today", "i will", "i want to", "this talk", "my goal"];
const TRANSITION_CUES = ["first", "second", "next", "finally", "for example", "because"];
const CLOSING_CUES = ["in conclusion", "to sum up", "thank you", "to wrap up", "overall"];

export function analyzeTranscript(input: {
  transcript: string;
  durationSeconds: number;
  segments?: TranscriptSegment[];
  clarity: ClarityFeedback;
  promptId?: string;
  promptLabel?: string;
  sessionType?: "assessment" | "practice";
}): AnalysisResponse {
  const transcript = input.transcript.trim();
  const words = extractWords(transcript);
  const wordCount = words.length;
  const durationSeconds = Math.max(input.durationSeconds || 0, 1);
  const wpm = Math.round((wordCount / durationSeconds) * 60);
  const fillers = countFillers(transcript);
  const fillerCount = Object.values(fillers).reduce((sum, count) => sum + count, 0);
  const fillerRate = wordCount === 0 ? 0 : Number(((fillerCount / wordCount) * 100).toFixed(1));
  const { pauseCount, longestPauseSeconds } = analyzePauses(input.segments);
  const structure = detectStructure(transcript);
  const repetition = analyzeRepetition(words);
  const pacingDetails = analyzePacingDetails(input.segments);

  const pacingScore = scorePacing(wpm);
  const fillerScore = scoreFillers(fillerRate);
  const completionScore = scoreCompletion(durationSeconds, wordCount);
  const promptCompletionScore = scorePromptCompletion({
    transcript,
    promptId: input.promptId,
    promptLabel: input.promptLabel,
    structureStatus: structure.status,
    durationSeconds
  });
  const repetitionScore = scoreRepetition(repetition.uniqueWordRatio, repetition.topRepeatedTerms);
  const structureScore = scoreStructure(structure.status);
  const clarityScore = clampScore(input.clarity.clarityScore);

  const score = Number(
    (
      clarityScore * 0.2 +
      structureScore * 0.2 +
      pacingScore * 0.15 +
      fillerScore * 0.15 +
      completionScore * 0.15 +
      promptCompletionScore * 0.15 +
      repetitionScore * 0.15
    ).toFixed(1)
  );

  const metrics: SpeechMetrics = {
    wordCount,
    wpm,
    pacingBand: classifyPacing(wpm),
    fillerCount,
    fillers,
    fillerRate,
    pauseCount,
    longestPauseSeconds,
    structureStatus: structure.status,
    structureSignals: structure.signals,
    clarityScore,
    structureScore,
    pacingScore,
    fillerScore,
    completionScore,
    promptCompletionScore,
    repetitionScore,
    uniqueWordRatio: repetition.uniqueWordRatio,
    topRepeatedTerms: repetition.topRepeatedTerms,
    rushedSections: pacingDetails.rushedSections,
    unevenPacing: pacingDetails.unevenPacing
  };

  return {
    transcript,
    durationSeconds: Number(durationSeconds.toFixed(1)),
    metrics,
    score,
    feedback: input.clarity.feedback,
    recommendedDrill: recommendDrill({
      fillerRate,
      fillerCount,
      pacingBand: metrics.pacingBand,
      structureStatus: structure.status,
      clarityScore,
      repetitionScore,
      longestPauseSeconds
    }),
    followUpQuestions: [],
    sessionType: input.sessionType ?? "practice",
    promptId: input.promptId,
    promptLabel: input.promptLabel
  };
}

export function buildFallbackClarityFeedback(metrics: {
  wpm: number;
  fillerRate: number;
  structureStatus: StructureStatus;
  repetitionScore?: number;
  promptCompletionScore?: number;
}): ClarityFeedback {
  const feedback: string[] = [];

  if (metrics.structureStatus !== "structured") {
    feedback.push("Give your talk a cleaner arc: open with the point, move through 2 key ideas, and end with a takeaway.");
  }

  if (metrics.fillerRate > 6) {
    feedback.push("Pause instead of filling space with quick placeholders. A short silence sounds more confident than repeated fillers.");
  }

  if (metrics.wpm > 160) {
    feedback.push("Slow the middle section down slightly so your main idea has room to land.");
  } else if (metrics.wpm < 110) {
    feedback.push("Add a touch more momentum to keep the audience engaged and make the delivery feel more decisive.");
  }

  if ((metrics.repetitionScore ?? 10) < 7) {
    feedback.push("Trim repeated phrasing and swap in one sharper example so the message feels more deliberate.");
  }

  if ((metrics.promptCompletionScore ?? 10) < 7) {
    feedback.push("Answer the full prompt more directly before adding extra detail so the response feels complete.");
  }

  if (feedback.length === 0) {
    feedback.push("Your message is easy to follow. Tighten one sentence at the opening to make the hook sharper.");
    feedback.push("Keep your strongest point until the end so the finish feels intentional.");
  }

  return {
    clarityScore: 7,
    feedback: feedback.slice(0, 3)
  };
}

export function buildFallbackFollowUpQuestions(input: {
  promptLabel?: string;
  recommendedDrill: RecommendedDrill;
  metrics: SpeechMetrics;
}) {
  const label = input.promptLabel || "this speaking prompt";
  const questions = [
    {
      id: "follow-up-1",
      prompt: `Can you restate your main point from ${label} in one tighter sentence?`,
      intent: "Force a cleaner core message."
    }
  ];

  switch (input.recommendedDrill.id) {
    case "pause-control":
      questions.push({
        id: "follow-up-2",
        prompt: "Answer again, but leave a full beat of silence before each new point instead of filling the gap.",
        intent: "Convert filler pressure into deliberate pauses."
      });
      break;
    case "pacing-ladder":
      questions.push({
        id: "follow-up-2",
        prompt: "Can you give the same answer 15 percent slower while keeping the energy steady?",
        intent: "Stabilize rhythm without sounding flat."
      });
      break;
    case "point-example-close":
      questions.push({
        id: "follow-up-2",
        prompt: "Try again with exactly three beats: point, one example, then one closing line.",
        intent: "Practice a visible structure."
      });
      break;
    case "one-minute-explanation":
      questions.push({
        id: "follow-up-2",
        prompt: "Which sentence in your answer carried the main idea, and how would you make it clearer on the next take?",
        intent: "Push clarity and reduce repetition."
      });
      break;
    case "impromptu-pressure-round":
      questions.push({
        id: "follow-up-2",
        prompt: "If someone challenged your main point, what is the strongest one-sentence defense you would give?",
        intent: "Add pressure after a strong baseline take."
      });
      break;
    default:
      questions.push({
        id: "follow-up-2",
        prompt: "What single example would make your argument more convincing to a skeptical listener?",
        intent: "Strengthen persuasion with evidence."
      });
      break;
  }

  return questions;
}

export function determinePlacementLevel(score: number): PlacementLevel {
  const readiness = Math.round(score * 10);
  if (readiness < 55) {
    return "Beginner";
  }
  if (readiness < 70) {
    return "Developing";
  }
  if (readiness < 85) {
    return "Intermediate";
  }
  return "Advanced";
}

function extractWords(transcript: string) {
  return transcript.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function analyzeRepetition(words: string[]) {
  const significantWords = words.filter((word) => word.length > 3);
  const counts = significantWords.reduce<Record<string, number>>((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
  const uniqueWordRatio = words.length === 0 ? 0 : Number((new Set(words).size / words.length).toFixed(2));
  const topRepeatedTerms = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term, count]) => ({ term, count }));

  return {
    uniqueWordRatio,
    topRepeatedTerms
  };
}

function countFillers(transcript: string) {
  const lower = transcript.toLowerCase();
  return FILLER_PATTERNS.reduce<Record<string, number>>((acc, filler) => {
    const pattern = filler.replace(/\s+/g, "\\s+");
    const regex = new RegExp(`\\b${pattern}\\b`, "gi");
    acc[filler] = lower.match(regex)?.length ?? 0;
    return acc;
  }, {});
}

function analyzePauses(segments: TranscriptSegment[] = []) {
  let pauseCount = 0;
  let longestPauseSeconds = 0;

  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const current = segments[index];
    if (typeof previous.end !== "number" || typeof current.start !== "number") {
      continue;
    }

    const gap = Number((current.start - previous.end).toFixed(2));
    if (gap >= 0.75) {
      pauseCount += 1;
      longestPauseSeconds = Math.max(longestPauseSeconds, gap);
    }
  }

  return {
    pauseCount,
    longestPauseSeconds: Number(longestPauseSeconds.toFixed(2))
  };
}

function analyzePacingDetails(segments: TranscriptSegment[] = []) {
  if (segments.length < 2) {
    return {
      rushedSections: 0,
      unevenPacing: false
    };
  }

  const localWpms: number[] = [];

  for (const segment of segments) {
    if (typeof segment.start !== "number" || typeof segment.end !== "number") {
      continue;
    }

    const duration = Math.max(segment.end - segment.start, 0.5);
    const words = extractWords(segment.text ?? "").length;
    if (words === 0) {
      continue;
    }
    localWpms.push((words / duration) * 60);
  }

  if (localWpms.length === 0) {
    return {
      rushedSections: 0,
      unevenPacing: false
    };
  }

  const rushedSections = localWpms.filter((value) => value > 185).length;
  const fastest = Math.max(...localWpms);
  const slowest = Math.min(...localWpms);

  return {
    rushedSections,
    unevenPacing: fastest - slowest >= 55
  };
}

function detectStructure(transcript: string) {
  const lower = transcript.toLowerCase();
  const signals = [
    ...findSignals(lower, OPENING_CUES, "opening"),
    ...findSignals(lower, TRANSITION_CUES, "transition"),
    ...findSignals(lower, CLOSING_CUES, "closing")
  ];

  const buckets = new Set(signals.map((signal) => signal.split(":")[0]));
  let status: StructureStatus = "unclear";

  if (buckets.size >= 3) {
    status = "structured";
  } else if (buckets.size >= 2) {
    status = "partial";
  }

  return { status, signals };
}

function findSignals(text: string, cues: string[], label: string) {
  return cues.flatMap((cue) => (text.includes(cue) ? [`${label}: ${cue}`] : []));
}

function classifyPacing(wpm: number): SpeechMetrics["pacingBand"] {
  if (wpm < 110) {
    return "slow";
  }
  if (wpm > 160) {
    return "fast";
  }
  return "optimal";
}

function scorePacing(wpm: number) {
  if (wpm >= 110 && wpm <= 160) {
    return 10;
  }
  if ((wpm >= 95 && wpm < 110) || (wpm > 160 && wpm <= 175)) {
    return 8;
  }
  if ((wpm >= 80 && wpm < 95) || (wpm > 175 && wpm <= 195)) {
    return 6;
  }
  return 4;
}

function scoreFillers(fillerRate: number) {
  if (fillerRate <= 2) {
    return 10;
  }
  if (fillerRate <= 4) {
    return 8;
  }
  if (fillerRate <= 7) {
    return 6;
  }
  return 4;
}

function scoreCompletion(durationSeconds: number, wordCount: number) {
  if (durationSeconds >= 25 && wordCount >= 45) {
    return 10;
  }
  if (durationSeconds >= 18 && wordCount >= 30) {
    return 8;
  }
  if (durationSeconds >= 12 && wordCount >= 20) {
    return 6;
  }
  return 3;
}

function scorePromptCompletion(input: {
  transcript: string;
  promptId?: string;
  promptLabel?: string;
  structureStatus: StructureStatus;
  durationSeconds: number;
}) {
  const lower = input.transcript.toLowerCase();
  let score = 5;

  if (input.durationSeconds >= 20) {
    score += 1.5;
  }

  if (input.structureStatus !== "unclear") {
    score += 1.5;
  }

  if (input.promptId === "intro" || input.promptId === "assessment-intro") {
    if (/\b(i am|my name is|i work|i do)\b/.test(lower)) {
      score += 1.5;
    }
    if (/\b(because|matters|care about|focus)\b/.test(lower)) {
      score += 1;
    }
  } else if (input.promptId === "walkthrough") {
    if (/\b(problem|challenge|issue)\b/.test(lower)) {
      score += 1;
    }
    if (/\b(result|outcome|impact)\b/.test(lower)) {
      score += 1.5;
    }
  } else if (input.promptId === "impromptu") {
    if (/\b(i believe|i think|my view|because)\b/.test(lower)) {
      score += 1.5;
    }
  } else if (input.promptLabel && lower.includes(input.promptLabel.toLowerCase().split(" ")[0] || "")) {
    score += 1;
  }

  return clampScore(score);
}

function scoreRepetition(uniqueWordRatio: number, topRepeatedTerms: Array<{ term: string; count: number }>) {
  if (topRepeatedTerms.length === 0 && uniqueWordRatio >= 0.7) {
    return 10;
  }

  if (uniqueWordRatio >= 0.6 && (topRepeatedTerms[0]?.count ?? 0) <= 3) {
    return 8;
  }

  if (uniqueWordRatio >= 0.5 && (topRepeatedTerms[0]?.count ?? 0) <= 5) {
    return 6.5;
  }

  return 4.5;
}

function scoreStructure(status: StructureStatus) {
  switch (status) {
    case "structured":
      return 9;
    case "partial":
      return 6.5;
    default:
      return 4;
  }
}

function recommendDrill(input: {
  fillerRate: number;
  fillerCount: number;
  pacingBand: SpeechMetrics["pacingBand"];
  structureStatus: StructureStatus;
  clarityScore: number;
  repetitionScore: number;
  longestPauseSeconds: number;
}): RecommendedDrill {
  if (input.fillerRate > 4 || input.fillerCount > 4) {
    return {
      id: "pause-control",
      title: "Pause Control Drill",
      summary: "Redo the answer with one silent beat before every new idea.",
      focusMetric: "fillers"
    };
  }

  if (input.pacingBand !== "optimal" || input.longestPauseSeconds >= 1.5) {
    return {
      id: "pacing-ladder",
      title: "Pacing Ladder",
      summary: "Repeat the prompt once slower, then once at target rhythm without drifting.",
      focusMetric: "pacing"
    };
  }

  if (input.structureStatus !== "structured") {
    return {
      id: "point-example-close",
      title: "Point-Example-Close",
      summary: "Keep the whole answer to three beats so the structure becomes visible.",
      focusMetric: "structure"
    };
  }

  if (input.clarityScore < 7 || input.repetitionScore < 7) {
    return {
      id: "one-minute-explanation",
      title: "One-Minute Explanation Drill",
      summary: "Explain the same idea again with shorter sentences and less repeated wording.",
      focusMetric: input.repetitionScore < input.clarityScore ? "repetition" : "clarity"
    };
  }

  if (input.clarityScore >= 8 && input.repetitionScore >= 8 && input.structureStatus === "structured") {
    return {
      id: "impromptu-pressure-round",
      title: "Impromptu Pressure Round",
      summary: "Take a stronger follow-up question and answer without prep.",
      focusMetric: "delivery"
    };
  }

  return {
    id: "persuasive-answer",
    title: "Persuasive Answer Drill",
    summary: "Restate your point with one sharper example and a stronger close.",
    focusMetric: "delivery"
  };
}

function clampScore(score: number) {
  if (Number.isNaN(score)) {
    return 0;
  }
  return Number(Math.max(0, Math.min(10, score)).toFixed(1));
}
