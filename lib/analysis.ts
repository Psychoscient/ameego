import type { AnalysisResponse, SpeechMetrics, StructureStatus } from "@/lib/types";

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

  const pacingScore = scorePacing(wpm);
  const fillerScore = scoreFillers(fillerRate);
  const completionScore = scoreCompletion(durationSeconds, wordCount);
  const structureScore = scoreStructure(structure.status);
  const clarityScore = clampScore(input.clarity.clarityScore);

  const score = Number(
    (
      clarityScore * 0.25 +
      structureScore * 0.2 +
      pacingScore * 0.2 +
      fillerScore * 0.2 +
      completionScore * 0.15
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
    completionScore
  };

  return {
    transcript,
    durationSeconds: Number(durationSeconds.toFixed(1)),
    metrics,
    score,
    feedback: input.clarity.feedback
  };
}

export function buildFallbackClarityFeedback(metrics: {
  wpm: number;
  fillerRate: number;
  structureStatus: StructureStatus;
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

  if (feedback.length === 0) {
    feedback.push("Your message is easy to follow. Tighten one sentence at the opening to make the hook sharper.");
    feedback.push("Keep your strongest point until the end so the finish feels intentional.");
  }

  return {
    clarityScore: 7,
    feedback: feedback.slice(0, 3)
  };
}

function extractWords(transcript: string) {
  return transcript.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
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

function clampScore(score: number) {
  if (Number.isNaN(score)) {
    return 0;
  }
  return Number(Math.max(0, Math.min(10, score)).toFixed(1));
}
