import {
  analyzeTranscript,
  buildFallbackClarityFeedback,
  buildFallbackFollowUpQuestions,
  determinePlacementLevel
} from "@/lib/analysis";
import {
  generateClarityFeedback,
  generateFollowUpQuestions,
  generateNonverbalFeedback,
  transcribeAudio
} from "@/lib/gemini";
import type { SessionType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const maybeFile = formData.get("media") ?? formData.get("audio");
    const recordingSeconds = Number(formData.get("recordingSeconds") || 0);
    const cameraEnabled = formData.get("cameraEnabled") === "true";
    const promptId = String(formData.get("promptId") || "");
    const promptLabel = String(formData.get("promptLabel") || "");
    const sessionType = normalizeSessionType(formData.get("sessionType"));

    if (!(maybeFile instanceof File)) {
      return Response.json({ error: "Recording upload is required." }, { status: 400 });
    }

    if (maybeFile.size === 0) {
      return Response.json({ error: "Recorded media was empty." }, { status: 400 });
    }

    const transcription = await transcribeAudio(maybeFile);
    if (!transcription.transcript) {
      return Response.json({ error: "No speech was detected in the recording." }, { status: 422 });
    }

    const durationSeconds = transcription.durationSeconds > 0 ? transcription.durationSeconds : recordingSeconds;

    const roughMetrics = analyzeTranscript({
      transcript: transcription.transcript,
      durationSeconds,
      segments: transcription.segments,
      promptId,
      promptLabel,
      sessionType,
      clarity: {
        clarityScore: 0,
        feedback: []
      }
    });

    let clarity = buildFallbackClarityFeedback({
      wpm: roughMetrics.metrics.wpm,
      fillerRate: roughMetrics.metrics.fillerRate,
      structureStatus: roughMetrics.metrics.structureStatus,
      repetitionScore: roughMetrics.metrics.repetitionScore,
      promptCompletionScore: roughMetrics.metrics.promptCompletionScore
    });

    try {
      clarity = await generateClarityFeedback({
        transcript: transcription.transcript,
        durationSeconds,
        wpm: roughMetrics.metrics.wpm,
        fillerCount: roughMetrics.metrics.fillerCount,
        structureStatus: roughMetrics.metrics.structureStatus,
        repetitionScore: roughMetrics.metrics.repetitionScore,
        promptCompletionScore: roughMetrics.metrics.promptCompletionScore
      });
    } catch (error) {
      console.error("Falling back to deterministic clarity feedback.", error);
    }

    const analysis = analyzeTranscript({
      transcript: transcription.transcript,
      durationSeconds,
      segments: transcription.segments,
      promptId,
      promptLabel,
      sessionType,
      clarity
    });

    let followUpQuestions = buildFallbackFollowUpQuestions({
      promptLabel,
      recommendedDrill: analysis.recommendedDrill,
      metrics: analysis.metrics
    });

    try {
      const generatedQuestions = await generateFollowUpQuestions({
        transcript: transcription.transcript,
        promptLabel,
        recommendedDrillTitle: analysis.recommendedDrill.title,
        weakestArea: analysis.recommendedDrill.focusMetric
      });
      if (generatedQuestions.length >= 2) {
        followUpQuestions = generatedQuestions;
      }
    } catch (error) {
      console.error("Falling back to deterministic follow-up prompts.", error);
    }

    let nonverbal = null;

    if (cameraEnabled && maybeFile.type.startsWith("video/")) {
      try {
        nonverbal = await generateNonverbalFeedback(maybeFile);
      } catch (error) {
        console.error("Nonverbal analysis failed; returning speech analysis only.", error);
      }
    }

    return Response.json({
      ...analysis,
      followUpQuestions,
      placementLevel: sessionType === "assessment" ? determinePlacementLevel(analysis.score) : undefined,
      nonverbal
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function normalizeSessionType(value: FormDataEntryValue | null): SessionType {
  return value === "assessment" ? "assessment" : "practice";
}
