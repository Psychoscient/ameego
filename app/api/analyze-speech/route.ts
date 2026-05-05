import { analyzeTranscript, buildFallbackClarityFeedback } from "@/lib/analysis";
import { generateClarityFeedback, transcribeAudio } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const maybeFile = formData.get("audio");
    const recordingSeconds = Number(formData.get("recordingSeconds") || 0);

    if (!(maybeFile instanceof File)) {
      return Response.json({ error: "Audio upload is required." }, { status: 400 });
    }

    if (maybeFile.size === 0) {
      return Response.json({ error: "Recorded audio was empty." }, { status: 400 });
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
      clarity: {
        clarityScore: 0,
        feedback: []
      }
    });

    let clarity = buildFallbackClarityFeedback({
      wpm: roughMetrics.metrics.wpm,
      fillerRate: roughMetrics.metrics.fillerRate,
      structureStatus: roughMetrics.metrics.structureStatus
    });

    try {
      clarity = await generateClarityFeedback({
        transcript: transcription.transcript,
        durationSeconds,
        wpm: roughMetrics.metrics.wpm,
        fillerCount: roughMetrics.metrics.fillerCount,
        structureStatus: roughMetrics.metrics.structureStatus
      });
    } catch (error) {
      console.error("Falling back to deterministic clarity feedback.", error);
    }

    const analysis = analyzeTranscript({
      transcript: transcription.transcript,
      durationSeconds,
      segments: transcription.segments,
      clarity
    });

    return Response.json(analysis);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
