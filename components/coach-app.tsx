"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { PRACTICE_PROMPTS } from "@/lib/prompts";
import type { AnalysisResponse } from "@/lib/types";

const STORAGE_KEY = "ameego-latest-analysis";

export function CoachApp() {
  const [selectedPromptId, setSelectedPromptId] = useState(PRACTICE_PROMPTS[0].id);
  const [status, setStatus] = useState<"idle" | "recording" | "uploading" | "success" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      setAnalysis(JSON.parse(stored) as AnalysisResponse);
      setStatus("success");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer(timerRef);
      stopStream(streamRef);
    };
  }, []);

  useEffect(() => {
    if (status === "recording" && seconds >= 60) {
      stopRecording();
    }
  }, [seconds, status]);

  const selectedPrompt = PRACTICE_PROMPTS.find((prompt) => prompt.id === selectedPromptId) ?? PRACTICE_PROMPTS[0];

  async function startRecording() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone recording.");
      setStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, pickRecorderOptions());

      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        stopStream(streamRef);
        await submitRecording(audioBlob);
      });

      recorder.start();
      setSeconds(0);
      setStatus("recording");
      stopTimer(timerRef);
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => value + 1);
      }, 1000);
    } catch (recordingError) {
      console.error(recordingError);
      setError("Microphone access was blocked or unavailable.");
      setStatus("error");
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      return;
    }

    setStatus("uploading");
    stopTimer(timerRef);
    recorderRef.current.stop();
  }

  async function submitRecording(audioBlob: Blob) {
    if (audioBlob.size === 0) {
      setError("Recording was empty. Try again with a clearer sample.");
      setStatus("error");
      return;
    }

    const extension = mimeExtension(audioBlob.type);
    const formData = new FormData();
    formData.append("audio", audioBlob, `ameego-session.${extension}`);
    formData.append("promptId", selectedPrompt.id);
    formData.append("promptLabel", selectedPrompt.label);
    formData.append("recordingSeconds", String(seconds));

    try {
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      setAnalysis(payload as AnalysisResponse);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatus("success");
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Analysis failed.");
      setStatus("error");
    }
  }

  function resetSession() {
    setError("");
    setSeconds(0);
    setStatus("idle");
    setAnalysis(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Formal Speaking Coach</p>
          <h1>Train your pitch until it sounds inevitable.</h1>
          <p className="intro">
            Ameego listens to a short practice run, scores speaking readiness, and turns vague delivery issues into
            concrete next moves.
          </p>
          <div className="stat-ribbon">
            <span>Browser recording</span>
            <span>Gemini transcription</span>
            <span>Deterministic scoring</span>
            <span>Retry loop built for demos</span>
          </div>
        </div>
        <div className="hero-card">
          <div className="card-topline">
            <span>Session mode</span>
            <strong>{statusLabel(status)}</strong>
          </div>
          <div className="timer">{formatClock(seconds)}</div>
          <p className="timer-note">Aim for {selectedPrompt.duration}. Stop early if the point lands cleanly.</p>
          <div className="button-row">
            <button className="primary" onClick={startRecording} disabled={status === "recording" || status === "uploading"}>
              Start recording
            </button>
            <button className="secondary" onClick={stopRecording} disabled={status !== "recording"}>
              Stop and analyze
            </button>
          </div>
          <p className="status-note">
            {status === "uploading"
              ? "Transcribing and scoring your speech."
              : "Keep the core message concise: opening, two proof points, close."}
          </p>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel prompts-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Practice prompt</p>
            <h2>Choose one scenario and stay on message.</h2>
          </div>
          <div className="prompt-list">
            {PRACTICE_PROMPTS.map((prompt) => {
              const active = prompt.id === selectedPromptId;
              return (
                <button
                  key={prompt.id}
                  className={`prompt-card${active ? " active" : ""}`}
                  onClick={() => setSelectedPromptId(prompt.id)}
                  disabled={status === "recording" || status === "uploading"}
                >
                  <span>{prompt.label}</span>
                  <strong>{prompt.duration}</strong>
                  <p>{prompt.brief}</p>
                </button>
              );
            })}
          </div>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <div className="panel results-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Latest analysis</p>
            <h2>One score, four signals, clear next moves.</h2>
          </div>

          {analysis ? (
            <div className="results-stack">
              <div className="score-band">
                <div>
                  <p className="score-label">Speaking readiness</p>
                  <div className="score-value">{analysis.score.toFixed(1)}</div>
                </div>
                <div className="score-details">
                  <span>{analysis.metrics.wordCount} words</span>
                  <span>{analysis.durationSeconds}s</span>
                  <span>{analysis.metrics.pauseCount} pauses</span>
                </div>
              </div>

              <div className="metric-grid">
                <MetricCard label="Pacing" value={`${analysis.metrics.wpm} WPM`} tone={analysis.metrics.pacingBand}>
                  {analysis.metrics.pacingBand === "optimal"
                    ? "Comfortable speaking tempo."
                    : analysis.metrics.pacingBand === "fast"
                      ? "Slow down to help ideas land."
                      : "Add more energy and momentum."}
                </MetricCard>
                <MetricCard label="Filler control" value={`${analysis.metrics.fillerCount} fillers`} tone={analysis.metrics.fillerCount <= 4 ? "optimal" : "slow"}>
                  {analysis.metrics.fillerRate}% of words were fillers.
                </MetricCard>
                <MetricCard
                  label="Structure"
                  value={analysis.metrics.structureStatus}
                  tone={analysis.metrics.structureStatus === "structured" ? "optimal" : "fast"}
                >
                  {analysis.metrics.structureSignals.length > 0
                    ? analysis.metrics.structureSignals.slice(0, 2).join(" / ")
                    : "No clear opening, transition, or closing signals detected."}
                </MetricCard>
                <MetricCard label="Clarity" value={`${analysis.metrics.clarityScore}/10`} tone={analysis.metrics.clarityScore >= 7 ? "optimal" : "slow"}>
                  Focus on sharper wording and less repetition.
                </MetricCard>
              </div>

              <div className="feedback-panel">
                <h3>Coach notes</h3>
                <ul>
                  {analysis.feedback.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="transcript-panel">
                <div className="transcript-header">
                  <h3>Transcript</h3>
                  <button className="ghost" onClick={resetSession}>
                    New attempt
                  </button>
                </div>
                <p>{analysis.transcript}</p>
              </div>
            </div>
          ) : (
            <div className="results-empty">
              <p className="empty-mark">No speech analyzed yet</p>
              <p>Record a short pitch and the scorecard will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone,
  children
}: {
  label: string;
  value: string;
  tone: "slow" | "optimal" | "fast";
  children: ReactNode;
}) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{children}</p>
    </article>
  );
}

function formatClock(totalSeconds: number) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function stopTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }
}

function statusLabel(status: "idle" | "recording" | "uploading" | "success" | "error") {
  switch (status) {
    case "recording":
      return "Recording live";
    case "uploading":
      return "Analyzing";
    case "success":
      return "Score ready";
    case "error":
      return "Needs retry";
    default:
      return "Standing by";
  }
}

function mimeExtension(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "mp4";
  }
  if (mimeType.includes("mpeg")) {
    return "mp3";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  return "webm";
}

function pickRecorderOptions() {
  const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
}

function stopStream(streamRef: MutableRefObject<MediaStream | null>) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}
