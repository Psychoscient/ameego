"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { PRACTICE_PROMPTS } from "@/lib/prompts";
import type {
  AnalysisResponse,
  DrillId,
  ModuleProgress,
  NonverbalAnalysis,
  PracticePrompt,
  SessionRecord,
  UserProfile
} from "@/lib/types";

const STORAGE_KEY = "ameego-latest-analysis";
const MICROPHONE_TIMEOUT_MS = 10000;

type AppRoute = "home" | "assessment" | "dashboard" | "practice";
type AssessmentStage = "brief" | "record";
type PracticeStage = "prompt" | "drill" | "record" | "review";
type SessionStatus = "idle" | "requesting" | "recording" | "uploading" | "success" | "error";
type BuddyMood = "neutral" | "attentive" | "thinking" | "celebrating" | "concerned" | "encouraging";
type ModuleId = "fillers" | "pacing" | "clarity" | "structure" | "persuasion" | "impromptu";
type ModuleStatus = "completed" | "current" | "up-next" | "locked";

type BuddyState = {
  mood: BuddyMood;
  eyebrow: string;
  headline: string;
  message: string;
};

type ModuleDefinition = {
  id: ModuleId;
  title: string;
  description: string;
};

type PathModule = ModuleDefinition & {
  status: ModuleStatus;
  reason?: string;
};

type ModuleRecommendation = {
  id: ModuleId;
  reason: string;
};

type StoredAppState = {
  profile: UserProfile;
  sessions: SessionRecord[];
  moduleProgress: ModuleProgress;
  latestPromptId?: string;
};

type DrillConfig = {
  id: DrillId;
  title: string;
  instruction: string;
  successRule: string;
  framingPrompt: string;
  targetMetricLabel: string;
  promptId: PracticePrompt["id"];
};

type DrillOutcome = {
  status: "passed" | "improved" | "try-again";
  headline: string;
  detail: string;
};

const ASSESSMENT_PROMPT: PracticePrompt = {
  id: "assessment-intro",
  label: "Initial Assessment",
  brief: "Introduce yourself, what you do, and one thing you care about in a clear, formal way.",
  duration: "45 sec"
};

const LEARNING_MODULES: ModuleDefinition[] = [
  {
    id: "fillers",
    title: "Filler Word Control",
    description: "Reduce crutch words and replace them with cleaner pauses."
  },
  {
    id: "pacing",
    title: "Pacing & Pauses",
    description: "Find a steady speaking rhythm that sounds composed and intentional."
  },
  {
    id: "clarity",
    title: "Clear Sentence Delivery",
    description: "Make your point easier to follow with shorter, cleaner phrasing."
  },
  {
    id: "structure",
    title: "Speech Structure",
    description: "Build stronger openings, transitions, and conclusions."
  },
  {
    id: "persuasion",
    title: "Persuasive Speaking",
    description: "Strengthen arguments, examples, and audience impact."
  },
  {
    id: "impromptu",
    title: "Impromptu Speaking",
    description: "Practice answering clearly under pressure without over-preparing."
  }
];

const QUICK_TIPS = ["Speak at your natural pace", "Replace fillers with short pauses", "Aim for one clean close"];
const STRUCTURE_TIPS = ["Lead with the point", "Add one or two proof beats", "Close before the energy drops"];

const DRILL_CONFIGS: Record<DrillId, DrillConfig> = {
  "pause-control": {
    id: "pause-control",
    title: "Pause Control Drill",
    instruction: "Answer once, but leave one full silent beat before each new point instead of filling the gap.",
    successRule: "Pass when filler rate drops to 2.5% or lower.",
    framingPrompt: "Deliver a clean formal introduction with deliberate pauses between ideas.",
    targetMetricLabel: "Filler rate",
    promptId: "intro"
  },
  "pacing-ladder": {
    id: "pacing-ladder",
    title: "Pacing Ladder",
    instruction: "Give the answer at a steady mid-tempo. Do not rush the middle and do not drag the close.",
    successRule: "Pass when pacing is optimal and the rhythm is not flagged as uneven.",
    framingPrompt: "Walk through one project clearly, keeping the cadence steady from start to finish.",
    targetMetricLabel: "Pacing stability",
    promptId: "walkthrough"
  },
  "point-example-close": {
    id: "point-example-close",
    title: "Point-Example-Close",
    instruction: "Keep the whole answer to exactly three beats: your point, one example, then one close.",
    successRule: "Pass when the structure reads as structured.",
    framingPrompt: "Make one claim, support it with one example, then close before the energy drops.",
    targetMetricLabel: "Structure",
    promptId: "walkthrough"
  },
  "one-minute-explanation": {
    id: "one-minute-explanation",
    title: "One-Minute Explanation Drill",
    instruction: "Explain the same idea again with shorter sentences and less repeated phrasing.",
    successRule: "Pass when clarity reaches 7.5 and repetition reaches 7.0.",
    framingPrompt: "Explain why your work matters in one direct, easy-to-follow minute.",
    targetMetricLabel: "Clarity and repetition",
    promptId: "intro"
  },
  "impromptu-pressure-round": {
    id: "impromptu-pressure-round",
    title: "Impromptu Pressure Round",
    instruction: "Take the answer live and commit quickly. No over-explaining and no slow setup.",
    successRule: "Pass when readiness reaches 85 or higher.",
    framingPrompt: "Defend one idea you would confidently say in a meeting, on the spot.",
    targetMetricLabel: "Overall readiness",
    promptId: "impromptu"
  },
  "persuasive-answer": {
    id: "persuasive-answer",
    title: "Persuasive Answer Drill",
    instruction: "Restate your point with one stronger example and a more decisive final line.",
    successRule: "Pass when prompt match reaches 7.5 and readiness reaches 7.5.",
    framingPrompt: "Make your case as if the listener is skeptical and needs one good reason to agree.",
    targetMetricLabel: "Prompt match and readiness",
    promptId: "impromptu"
  }
};

export function CoachApp() {
  const [route, setRoute] = useState<AppRoute>("home");
  const [assessmentStage, setAssessmentStage] = useState<AssessmentStage>("brief");
  const [practiceStage, setPracticeStage] = useState<PracticeStage>("prompt");
  const [selectedPromptId, setSelectedPromptId] = useState(PRACTICE_PROMPTS[0].id);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile>({});
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress>({
    currentModuleId: "fillers",
    completedModuleIds: []
  });
  const [activeDrill, setActiveDrill] = useState<DrillConfig | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

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
      const parsed = JSON.parse(stored) as StoredAppState | AnalysisResponse;
      const nextState = migrateStoredState(parsed);
      if (!nextState) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setProfile(nextState.profile);
      setSessions(nextState.sessions);
      setModuleProgress(nextState.moduleProgress);

      const latestSession = nextState.sessions[0];
      if (latestSession) {
        setAnalysis(latestSession.analysis);
        if (latestSession.drillId) {
          setActiveDrill(DRILL_CONFIGS[latestSession.drillId]);
        }
      }

      if (nextState.latestPromptId && PRACTICE_PROMPTS.some((prompt) => prompt.id === nextState.latestPromptId)) {
        setSelectedPromptId(nextState.latestPromptId);
      }

      if (nextState.sessions.length > 0) {
        setStatus("success");
        setPracticeStage("review");
        setRoute("dashboard");
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer(timerRef);
      stopStream(streamRef);
      setPreviewStream(null);
    };
  }, []);

  useEffect(() => {
    if (status === "recording" && seconds >= 60) {
      stopRecording();
    }
  }, [seconds, status]);

  const selectedPrompt = PRACTICE_PROMPTS.find((prompt) => prompt.id === selectedPromptId) ?? PRACTICE_PROMPTS[0];
  const currentPrompt = route === "assessment" ? ASSESSMENT_PROMPT : selectedPrompt;
  const hasAnalysis = Boolean(analysis);
  const isBusy = status === "requesting" || status === "recording" || status === "uploading";
  const recommendation = deriveRecommendation(analysis);
  const modules = buildLearningPath(analysis, recommendation, moduleProgress);
  const streakDays = deriveStreakDays(sessions);
  const latestDelta = deriveLatestDelta(sessions);
  const recentScores = sessions.slice(0, 5).map((session) => readinessScore(session.analysis.score));
  const latestSession = sessions[0] ?? null;
  const previousSession = sessions[1] ?? null;
  const buddy = deriveBuddyState({
    route,
    assessmentStage,
    practiceStage,
    status,
    error,
    analysis,
    selectedPrompt: currentPrompt,
    recommendation,
    placementLevel: profile.placementLevel
  });

  function resetCaptureState() {
    stopTimer(timerRef);
    stopStream(streamRef);
    setPreviewStream(null);
    recorderRef.current = null;
    chunksRef.current = [];
    setError("");
    setSeconds(0);
    setStatus("idle");
  }

  function clearDrillMode() {
    setActiveDrill(null);
  }

  function persistState(nextState: StoredAppState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function goHome() {
    if (isBusy) {
      return;
    }
    resetCaptureState();
    clearDrillMode();
    setRoute("home");
  }

  function beginAssessment() {
    if (isBusy) {
      return;
    }
    resetCaptureState();
    clearDrillMode();
    setAssessmentStage("brief");
    setRoute("assessment");
  }

  function openDashboard() {
    if (isBusy) {
      return;
    }
    if (!hasAnalysis) {
      beginAssessment();
      return;
    }
    resetCaptureState();
    clearDrillMode();
    setStatus("success");
    setRoute("dashboard");
  }

  function openPractice(stage: PracticeStage = "prompt") {
    if (isBusy) {
      return;
    }
    if (!hasAnalysis) {
      beginAssessment();
      return;
    }
    resetCaptureState();
    if (stage === "prompt") {
      clearDrillMode();
    }
    setPracticeStage(stage);
    setRoute("practice");
  }

  function choosePrompt(promptId: string) {
    clearDrillMode();
    setSelectedPromptId(promptId);
    setError("");
    setPracticeStage("record");
  }

  function startRecommendedDrill() {
    if (!analysis) {
      return;
    }
    const config = DRILL_CONFIGS[analysis.recommendedDrill.id];
    setActiveDrill(config);
    setSelectedPromptId(config.promptId);
    resetCaptureState();
    setPracticeStage("drill");
    setRoute("practice");
  }

  async function startRecording() {
    setError("");
    if (route === "practice") {
      setPracticeStage("record");
    }
    if (route === "assessment") {
      setAssessmentStage("record");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone recording.");
      setStatus("error");
      return;
    }

    try {
      setStatus("requesting");
      const stream = await requestRecordingStream(cameraEnabled);
      const recorder = new MediaRecorder(stream, pickRecorderOptions(cameraEnabled));

      streamRef.current = stream;
      setPreviewStream(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const mediaBlob = new Blob(chunksRef.current, { type: mimeType });
        stopStream(streamRef);
        setPreviewStream(null);
        await submitRecording(mediaBlob);
      });

      recorder.start();
      setSeconds(0);
      setStatus("recording");
      stopTimer(timerRef);
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => value + 1);
      }, 1000);
    } catch (recordingError) {
      if (!(recordingError instanceof DOMException && recordingError.name === "NotAllowedError")) {
        console.error(recordingError);
      }
      setError(microphoneErrorMessage(recordingError));
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

  async function submitRecording(mediaBlob: Blob) {
    if (mediaBlob.size === 0) {
      setError("Recording was empty. Try again with a clearer sample.");
      setStatus("error");
      return;
    }

    const extension = mimeExtension(mediaBlob.type);
    const formData = new FormData();
    formData.append("media", mediaBlob, `ameego-session.${extension}`);
    formData.append("promptId", currentPrompt.id);
    formData.append("promptLabel", currentPrompt.label);
    formData.append("sessionType", route === "assessment" ? "assessment" : "practice");
    formData.append("recordingSeconds", String(seconds));
    formData.append("cameraEnabled", String(cameraEnabled));

    try {
      const response = await fetch("/api/analyze-speech", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Analysis failed.");
      }

      const nextAnalysis = payload as AnalysisResponse;
      setAnalysis(nextAnalysis);
      const nextSession: SessionRecord = {
        id: createSessionId(),
        completedAt: new Date().toISOString(),
        promptId: currentPrompt.id,
        promptLabel: currentPrompt.label,
        sessionType: nextAnalysis.sessionType,
        drillId: activeDrill?.id,
        drillTitle: activeDrill?.title,
        analysis: nextAnalysis
      };
      const nextSessions = [nextSession, ...sessions].slice(0, 20);
      const nextProfile: UserProfile =
        nextAnalysis.sessionType === "assessment" && nextAnalysis.placementLevel
          ? {
              ...profile,
              placementLevel: nextAnalysis.placementLevel,
              assessmentCompletedAt: nextSession.completedAt
            }
          : profile;
      const nextModuleProgress = updateModuleProgress(nextSessions, moduleProgress);

      setSessions(nextSessions);
      setProfile(nextProfile);
      setModuleProgress(nextModuleProgress);
      persistState({
        profile: nextProfile,
        sessions: nextSessions,
        moduleProgress: nextModuleProgress,
        latestPromptId: PRACTICE_PROMPTS.some((prompt) => prompt.id === currentPrompt.id) ? currentPrompt.id : undefined
      });

      setStatus("success");
      if (route === "assessment") {
        clearDrillMode();
        setRoute("dashboard");
        return;
      }

      setPracticeStage("review");
      setRoute("practice");
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Analysis failed.");
      setStatus("error");
    }
  }

  if (route === "assessment") {
    return (
      <AssessmentScreen
        stage={assessmentStage}
        buddy={buddy}
        cameraEnabled={cameraEnabled}
        error={error}
        isBusy={isBusy}
        previewStream={previewStream}
        prompt={ASSESSMENT_PROMPT}
        seconds={seconds}
        status={status}
        onBack={assessmentStage === "brief" ? goHome : () => setAssessmentStage("brief")}
        onCameraToggle={() => setCameraEnabled((value) => !value)}
        onContinue={() => {
          resetCaptureState();
          setAssessmentStage("record");
        }}
        onStart={startRecording}
        onStop={stopRecording}
      />
    );
  }

  return (
    <AppShell
      activeRoute={route}
      analysis={analysis}
      recommendation={recommendation}
      status={status}
      streakDays={streakDays}
      isBusy={isBusy}
      onHome={goHome}
      onOpenDashboard={openDashboard}
      onOpenPractice={() => openPractice("prompt")}
    >
      {route === "home" ? (
        <LandingScreen analysis={analysis} onOpenDashboard={openDashboard} onOpenPractice={() => openPractice("prompt")} onStartAssessment={beginAssessment} />
      ) : null}
      {route === "dashboard" ? (
        <DashboardScreen
          analysis={analysis}
          buddy={buddy}
          latestDelta={latestDelta}
          modules={modules}
          placementLevel={profile.placementLevel}
          recentScores={recentScores}
          recommendation={recommendation}
          sessions={sessions}
          streakDays={streakDays}
          onStartDrill={startRecommendedDrill}
          onPractice={() => openPractice("prompt")}
        />
      ) : null}
      {route === "practice" ? (
        <PracticeScreen
          activeDrill={activeDrill}
          analysis={analysis}
          buddy={buddy}
          cameraEnabled={cameraEnabled}
          error={error}
          isBusy={isBusy}
          latestSession={latestSession}
          practiceStage={practiceStage}
          previewStream={previewStream}
          prompt={selectedPrompt}
          selectedPromptId={selectedPromptId}
          seconds={seconds}
          status={status}
          onBackToPrompt={() => setPracticeStage(activeDrill ? "drill" : "prompt")}
          onCameraToggle={() => setCameraEnabled((value) => !value)}
          onChangePrompt={choosePrompt}
          onChangePromptFromReview={() => {
            resetCaptureState();
            clearDrillMode();
            setPracticeStage("prompt");
            setRoute("practice");
          }}
          onNewAttempt={() => {
            resetCaptureState();
            setPracticeStage("record");
            setRoute("practice");
          }}
          onStartDrill={startRecommendedDrill}
          onStartDrillRecording={() => {
            setError("");
            setPracticeStage("record");
          }}
          onSetStage={setPracticeStage}
          onStart={startRecording}
          onStop={stopRecording}
          previousSession={previousSession}
        />
      ) : null}
    </AppShell>
  );
}

function LandingScreen({
  analysis,
  onOpenDashboard,
  onOpenPractice,
  onStartAssessment
}: {
  analysis: AnalysisResponse | null;
  onOpenDashboard: () => void;
  onOpenPractice: () => void;
  onStartAssessment: () => void;
}) {
  return (
    <div className="space-y-lg">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-md items-stretch">
        <div className="lg:col-span-8 bg-surface-container border border-outline-variant/15 rounded-xl p-md md:p-xl flex flex-col justify-center gap-md relative overflow-hidden shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #817566 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
          <div className="relative z-10 text-center md:text-left flex-1">
            <AmeegoLogo className="mb-sm justify-center md:justify-start" withWordmark />
            <h2 className="font-display-xl text-on-surface mb-md tracking-tighter">
              Master your delivery.<br className="hidden md:block"/>Command the room.
            </h2>
            <p className="text-on-surface-variant font-body-lg max-w-xl mb-lg">
              Step into the booth. Ameego analyzes your pacing, filler habits, clarity, and structure after each take so the next rep has one obvious improvement target.
            </p>
            <button onClick={analysis ? onOpenPractice : onStartAssessment} className="w-full md:w-auto px-8 py-4 bg-primary text-on-primary font-bold rounded-lg shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] hover:scale-[1.02] active:scale-[0.98] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
              {analysis ? "Resume Practice Loop" : "Start Your First Assessment"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface-container border border-outline-variant/15 rounded-xl p-md flex flex-col items-center justify-center relative shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
          <div className="absolute top-4 right-4 flex gap-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-surface-container-highest rounded-full"></div>
            <div className="w-2 h-2 bg-surface-container-highest rounded-full"></div>
          </div>
          <div className="w-48 h-48 rounded bg-primary-container/20 flex items-center justify-center mb-md overflow-hidden relative border-2 border-primary/20">
            <LargeDuckAvatar mood={analysis ? "celebrating" : "neutral"} compact={false} />
          </div>
          <div className="text-center">
            <h3 className="font-headline-md text-on-surface">Ameego is ready.</h3>
            <p className="font-body-md text-on-surface-variant mt-1">Mic levels look good. Let's practice.</p>
          </div>
        </div>
      </section>

      {analysis && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <button onClick={onOpenDashboard} className="text-left group bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] hover:-translate-y-1 hover:shadow-[0px_6px_0px_0px_rgba(28,28,11,0.1)] active:translate-y-1 active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.1)] transition-all">
            <div className="flex items-center justify-between mb-md">
              <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl">analytics</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
            </div>
            <h4 className="font-headline-md text-on-surface mb-1">Performance Dashboard</h4>
            <p className="font-body-md text-on-surface-variant">Review your latest session metrics, score history, and the next drill to run.</p>
          </button>
          
          <button onClick={onOpenPractice} className="text-left group bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] hover:-translate-y-1 hover:shadow-[0px_6px_0px_0px_rgba(28,28,11,0.1)] active:translate-y-1 active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.1)] transition-all">
            <div className="flex items-center justify-between mb-md">
              <div className="w-12 h-12 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container">
                <span className="material-symbols-outlined text-3xl">record_voice_over</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">arrow_forward</span>
            </div>
            <h4 className="font-headline-md text-on-surface mb-1">Resume Practice Loop</h4>
            <p className="font-body-md text-on-surface-variant">Jump back into your active module and keep improving.</p>
          </button>
        </section>
      )}
    </div>
  );
}

function AssessmentScreen({
  stage,
  buddy,
  cameraEnabled,
  error,
  isBusy,
  previewStream,
  prompt,
  seconds,
  status,
  onBack,
  onCameraToggle,
  onContinue,
  onStart,
  onStop
}: {
  stage: AssessmentStage;
  buddy: BuddyState;
  cameraEnabled: boolean;
  error: string;
  isBusy: boolean;
  previewStream: MediaStream | null;
  prompt: PracticePrompt;
  seconds: number;
  status: SessionStatus;
  onBack: () => void;
  onCameraToggle: () => void;
  onContinue: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <main className="min-h-screen bg-background text-on-background">
      <SimpleTopbar onBack={onBack} title="Initial Assessment" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-md px-gutter py-md lg:px-md lg:py-lg">
        {stage === "brief" ? (
          <div className="grid gap-md lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
            <section className="flex flex-col gap-md">
              <BuddyStrip buddy={buddy} mood={buddy.mood} />

              <div className="rounded-xl border border-outline-variant/15 bg-surface-container p-md">
                <div className="mb-base flex items-center justify-between">
                  <span className="font-label-pixel text-[10px] uppercase tracking-[0.18em] text-primary">Assessment Progress</span>
                  <span className="font-label-pixel text-[10px] text-primary">Step 1/2</span>
                </div>
                <div className="flex h-3 w-full gap-xs">
                  <div className="flex-1 rounded-sm bg-secondary" />
                  <div className="flex-1 rounded-sm bg-surface-container-highest" />
                </div>
              </div>

              <div className="rounded-xl border-2 border-dashed border-outline-variant/40 bg-surface p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.04)]">
                <div className="mb-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">lightbulb</span>
                  <h3 className="font-headline-md text-on-surface">Quick tips</h3>
                </div>
                <ul className="space-y-sm font-body-md text-on-surface-variant">
                  {QUICK_TIPS.map((tip) => (
                    <li key={tip} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                      <span>{tip}.</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="rounded-[28px] border border-outline-variant/20 bg-surface p-md shadow-[0px_8px_0px_0px_rgba(28,28,11,0.05)] lg:p-lg">
              <div className="max-w-3xl">
                <p className="mb-sm font-label-pixel text-[10px] uppercase tracking-[0.18em] text-primary">Step 1 of 2</p>
                <h1 className="mb-sm font-headline-lg text-primary">Introduce yourself formally.</h1>
                <p className="max-w-2xl font-body-lg text-on-surface-variant">
                  Say your name, what you do, and one thing that matters to you. This placement intro unlocks the cleaner dashboard and the full practice flow.
                </p>
              </div>

              <div className="mt-lg grid gap-sm md:grid-cols-3">
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md">
                  <span className="font-label-pixel text-[10px] uppercase tracking-[0.14em] text-primary">Length</span>
                  <p className="mt-xs font-headline-md text-on-surface">45 seconds</p>
                  <p className="text-sm text-on-surface-variant">Keep it short and complete.</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md">
                  <span className="font-label-pixel text-[10px] uppercase tracking-[0.14em] text-primary">Structure</span>
                  <p className="mt-xs font-headline-md text-on-surface">Name, role, value</p>
                  <p className="text-sm text-on-surface-variant">One clean thread is enough.</p>
                </div>
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md">
                  <span className="font-label-pixel text-[10px] uppercase tracking-[0.14em] text-primary">Goal</span>
                  <p className="mt-xs font-headline-md text-on-surface">Sound composed</p>
                  <p className="text-sm text-on-surface-variant">Pause instead of filling space.</p>
                </div>
              </div>

              <div className="mt-lg rounded-2xl border border-primary/15 bg-primary-container/15 p-md">
                <p className="mb-xs font-label-pixel text-[10px] uppercase tracking-[0.14em] text-primary">Prompt</p>
                <p className="font-body-md leading-relaxed text-on-surface">
                  "Hi, I&apos;m [name]. I work on [what you do], and something that matters to me is [value or focus]."
                </p>
              </div>

              <div className="mt-lg flex flex-col gap-sm sm:flex-row sm:items-center">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-on-primary shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] transition-all hover:scale-[1.01] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)]"
                  onClick={onContinue}
                >
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                  Continue to record
                </button>
                <p className="text-sm text-on-surface-variant">You can redo this after the first score if you want a cleaner baseline.</p>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <BuddyStrip buddy={buddy} mood={buddy.mood} />
            <LiveStudio
              cameraEnabled={cameraEnabled}
              coachMessage={buddy.message}
              error={error}
              isBusy={isBusy}
              previewStream={previewStream}
              prompt={prompt}
              seconds={seconds}
              status={status}
              onBack={onBack}
              onCameraToggle={onCameraToggle}
              onStart={onStart}
              onStop={onStop}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function AmeegoLogo({
  className = "",
  withWordmark = false
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/15 bg-primary-container/15 p-1.5 shadow-[0px_4px_0px_0px_rgba(28,28,11,0.08)]">
        <img alt="Ameego logo" className="h-full w-full object-contain drop-shadow-sm" src="/logo/ameego-duck-head-logo.png" />
      </div>
      {withWordmark ? (
        <div className="min-w-0">
          <p className="font-display-xl text-headline-md text-primary tracking-tighter">AMEEGO</p>
          <p className="text-xs text-on-surface-variant">AI Speaking Coach</p>
        </div>
      ) : null}
    </div>
  );
}

function AppShell({
  activeRoute,
  analysis,
  recommendation,
  status,
  streakDays,
  isBusy,
  children,
  onHome,
  onOpenDashboard,
  onOpenPractice
}: {
  activeRoute: AppRoute;
  analysis: AnalysisResponse | null;
  recommendation: ModuleRecommendation | null;
  status: SessionStatus;
  streakDays: number;
  isBusy: boolean;
  children: ReactNode;
  onHome: () => void;
  onOpenDashboard: () => void;
  onOpenPractice: () => void;
}) {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md w-full">
      {/* TopAppBar */}
      <header className="bg-surface sticky w-full top-0 z-40 border-b border-outline-variant/30 shadow-[0px_2px_0px_0px_rgba(28,28,11,0.06),0px_12px_24px_-20px_rgba(28,28,11,0.28)] flex justify-between items-center h-16 px-gutter">
        <div className="flex items-center gap-sm cursor-pointer" onClick={onHome}>
          <AmeegoLogo className="scale-[0.82] origin-left" withWordmark />
        </div>
        <div className="flex items-center gap-md">
          {analysis && (
            <div className="hidden md:flex items-center bg-surface-container-high px-4 py-2 rounded-lg gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
              <span className="font-headline-md text-body-md font-bold tracking-tight text-primary">{streakDays} day streak</span>
            </div>
          )}
          <button className="material-symbols-outlined p-2 hover:bg-surface-container-high transition-colors duration-200 rounded-full text-on-surface-variant">notifications</button>
          <div className="w-8 h-8 rounded-full bg-primary-fixed overflow-hidden border-2 border-primary">
            <div className="w-full h-full bg-primary text-on-primary flex items-center justify-center font-bold">U</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 w-full max-w-full items-start">
        {/* SideNavBar (Desktop) */}
        <aside className="bg-surface-container-low h-[calc(100vh-64px)] w-72 hidden lg:flex flex-col border-r border-outline-variant/30 shadow-[2px_0px_0px_0px_rgba(28,28,11,0.04),16px_0px_24px_-24px_rgba(28,28,11,0.22)] p-md pb-lg sticky top-16">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface px-md py-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.04)]">
            <div className="cursor-pointer" onClick={onHome}>
              <AmeegoLogo withWordmark />
            </div>
            <p className="mt-sm text-sm text-on-surface-variant">Ready to speak? Start with one clean rep, then let the dashboard decide the next move.</p>
          </div>

          <div className="mt-md rounded-2xl border border-outline-variant/15 bg-surface-container px-sm py-sm">
            <div className="px-sm pb-xs pt-xs">
              <span className="font-label-pixel text-[10px] uppercase tracking-[0.16em] text-primary">Navigation</span>
            </div>
            <nav className="space-y-1">
              <NavButton active={activeRoute === "home"} disabled={isBusy} icon="home" label="Studio Home" onClick={onHome} />
              <NavButton active={activeRoute === "dashboard"} disabled={isBusy} icon="dashboard" label="Dashboard" onClick={onOpenDashboard} />
              <NavButton active={activeRoute === "practice" || activeRoute === "assessment"} disabled={isBusy} icon="record_voice_over" label="Practice" onClick={onOpenPractice} />
            </nav>
          </div>

          <div className="mt-md rounded-2xl border border-primary/10 bg-primary-container/10 p-md shadow-[0px_4px_0px_0px_rgba(118,90,5,0.08)]">
            <span className="font-label-pixel text-[10px] uppercase tracking-[0.16em] text-primary">Quick Start</span>
            <p className="mt-xs text-sm text-on-surface-variant">Jump straight into a fresh speaking attempt and keep the coaching loop moving.</p>
            <button disabled={isBusy} onClick={onOpenPractice} className="mt-sm w-full bg-primary text-on-primary py-3 rounded-lg font-bold shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              New Session
            </button>
          </div>

        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
          <div className="flex-grow p-gutter md:p-md lg:p-xl space-y-lg max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant/30 shadow-[0px_-2px_0px_0px_rgba(28,28,11,0.05),0px_-12px_24px_-20px_rgba(28,28,11,0.22)] flex justify-around items-center lg:hidden z-50">
        <MobileNavButton active={activeRoute === "home"} icon="home" label="HOME" onClick={onHome} />
        <MobileNavButton active={activeRoute === "dashboard"} icon="dashboard" label="DASHBOARD" onClick={onOpenDashboard} />
        <MobileNavButton active={activeRoute === "practice" || activeRoute === "assessment"} icon="record_voice_over" label="PRACTICE" onClick={onOpenPractice} />
      </nav>
    </div>
  );
}

function DashboardScreen({
  analysis,
  buddy,
  latestDelta,
  modules,
  placementLevel,
  recentScores,
  recommendation,
  sessions,
  streakDays,
  onStartDrill,
  onPractice
}: {
  analysis: AnalysisResponse | null;
  buddy: BuddyState;
  latestDelta: number | null;
  modules: PathModule[];
  placementLevel?: UserProfile["placementLevel"];
  recentScores: number[];
  recommendation: ModuleRecommendation | null;
  sessions: SessionRecord[];
  streakDays: number;
  onStartDrill: () => void;
  onPractice: () => void;
}) {
  if (!analysis) {
    return (
      <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] text-center">
        <h2 className="font-headline-lg text-on-surface mb-xs">Complete one short check first.</h2>
        <p className="font-body-md text-on-surface-variant mb-md max-w-lg mx-auto">The dashboard stays intentionally empty until Ameego has one real speaking sample to work from.</p>
        <button className="primary hero-cta bg-primary text-on-primary px-8 py-3 rounded-lg font-bold shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all" onClick={onPractice}>
          Go to practice
        </button>
      </div>
    );
  }

  const essentialMetrics = [
    { label: "Pacing", value: `${analysis.metrics.wpm} WPM`, note: pacingLabel(analysis.metrics.pacingBand), icon: "timer" },
    { label: "Fillers", value: `${analysis.metrics.fillerCount}`, note: `${analysis.metrics.fillerRate}% of words`, icon: "analytics" },
    { label: "Clarity", value: `${analysis.metrics.clarityScore}/10`, note: analysis.metrics.structureStatus, icon: "verified" },
    { label: "Repetition", value: `${analysis.metrics.repetitionScore}/10`, note: `${Math.round(analysis.metrics.uniqueWordRatio * 100)}% unique words`, icon: "repeat" },
    { label: "Prompt Match", value: `${analysis.metrics.promptCompletionScore}/10`, note: "How fully the answer covered the task", icon: "task_alt" },
    {
      label: "History",
      value: `${sessions.length} session${sessions.length === 1 ? "" : "s"}`,
      note: latestDelta === null ? "Need one more rep for delta" : `${latestDelta > 0 ? "+" : ""}${latestDelta} vs previous`,
      icon: "timeline"
    }
  ];

  return (
    <div className="space-y-lg">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8 bg-surface-container border border-outline-variant/15 rounded-xl p-md flex flex-col md:flex-row gap-md items-center shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] relative overflow-hidden">
          <div className="z-10 text-center md:text-left flex-1">
            <span className="font-label-pixel text-primary mb-xs block">MASTER STATUS</span>
            <h2 className="font-headline-lg text-on-surface mb-md">Speaking Readiness</h2>
            <div className="flex items-baseline gap-xs mb-sm justify-center md:justify-start">
              <span className="font-display-xl text-primary">{readinessScore(analysis.score)}</span>
              <span className="font-headline-md text-on-surface-variant">/100</span>
            </div>
            <p className="text-on-surface-variant max-w-md mb-md">
              {placementLevel ? `${placementLevel} placement locked from the latest assessment.` : "Your latest scored take. Use this as the baseline for the next rep."}
            </p>
            <button className="px-6 py-2 bg-primary text-on-primary font-bold rounded shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all" onClick={onPractice}>
              Practice again
            </button>
          </div>
          <div className="relative w-48 h-48 flex items-center justify-center z-10">
            <svg className="w-full h-full -rotate-90">
              <circle className="text-surface-container-highest" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="12"></circle>
              <circle className="text-primary" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeDasharray="552.92" strokeDashoffset={`${552.92 - (552.92 * readinessScore(analysis.score)) / 100}`} strokeWidth="12" strokeLinecap="round"></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-display-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[160px]">record_voice_over</span>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-md flex flex-col">
          <div className="bg-secondary-container rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.1)] flex items-center justify-between">
            <div>
              <span className="font-label-pixel text-on-secondary-container">DAILY STREAK</span>
              <div className="font-headline-md text-on-secondary-container">{streakDays} {streakDays === 1 ? "Day" : "Days"}</div>
            </div>
            <span className="material-symbols-outlined text-display-xl text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          </div>
          <div className="bg-tertiary-container rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.1)] flex-1 flex flex-col justify-center">
            <span className="font-label-pixel text-on-tertiary-container uppercase">Next Module</span>
            <div className="font-headline-md text-on-tertiary-container leading-tight mt-1 mb-2">{recommendation ? moduleTitle(recommendation.id) : "First target"}</div>
            <p className="text-sm text-on-tertiary-container/80">{recommendation ? recommendation.reason : "Ameego will recommend a module after the first scored session."}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
        {essentialMetrics.map((metric) => (
          <div key={metric.label} className="bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
            <div className="flex items-center justify-between mb-md">
              <span className="font-headline-md">{metric.label}</span>
              <span className="material-symbols-outlined text-primary">{metric.icon}</span>
            </div>
            <div className="font-display-xl text-primary leading-none mb-1">{metric.value}</div>
            <div className="font-label-pixel text-on-surface-variant text-xs mt-auto">{metric.note}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-md">
        <div className="bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
          <div className="flex items-center justify-between mb-md">
            <h3 className="font-headline-md text-on-surface">Improvement History</h3>
            <span className="font-label-pixel text-primary uppercase">Last {recentScores.length}</span>
          </div>
          <div className="grid grid-cols-5 gap-sm items-end min-h-[140px]">
            {recentScores.map((score, index) => (
              <div key={`${score}-${index}`} className="flex flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-primary-container border border-primary/10" style={{ height: `${Math.max(score, 12)}%` }} />
                <span className="font-label-pixel text-[10px] text-on-surface-variant">{score}</span>
              </div>
            ))}
          </div>
          <p className="mt-md text-sm text-on-surface-variant">
            {latestDelta === null ? "Log one more session to unlock before-vs-after deltas." : `Latest change: ${latestDelta > 0 ? "+" : ""}${latestDelta} points against the previous take.`}
          </p>
        </div>

        <div className="bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
          <h3 className="font-headline-md text-on-surface mb-md">Progress Snapshot</h3>
          <div className="space-y-sm">
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-sm">
              <span className="text-sm text-on-surface-variant">Completed modules</span>
              <strong className="text-primary">{modules.filter((module) => module.status === "completed").length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-sm">
              <span className="text-sm text-on-surface-variant">Current drill</span>
              <strong className="text-primary">{analysis.recommendedDrill.title}</strong>
            </div>
            <button className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-on-primary shadow-[0px_4px_0px_0px_rgba(28,28,11,0.24)] transition-all active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.24)]" onClick={onStartDrill}>
              Start Drill
            </button>
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-sm">
              <span className="text-sm text-on-surface-variant">Placement</span>
              <strong className="text-primary">{placementLevel ?? "Pending"}</strong>
            </div>
            <div className="rounded-lg bg-surface-container-low p-sm">
              <span className="text-sm text-on-surface-variant block mb-1">Most repeated terms</span>
              <div className="flex flex-wrap gap-2">
                {analysis.metrics.topRepeatedTerms.length > 0 ? (
                  analysis.metrics.topRepeatedTerms.map((term) => (
                    <span key={term.term} className="rounded-full bg-primary-container/20 px-3 py-1 text-xs font-label-pixel text-primary">
                      {term.term} x{term.count}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-on-surface-variant">No obvious repeated terms in the latest take.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low border-2 border-outline-variant/20 rounded-xl p-md md:p-lg overflow-hidden relative shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
        <h3 className="font-headline-lg mb-lg">Modular Learning Path</h3>
        <div className="flex overflow-x-auto gap-md pb-4 pt-8 px-4 items-center relative">
          {modules.map((module, i) => (
            <div key={module.id} className={`relative flex-shrink-0 flex flex-col items-center ${module.status === 'locked' ? 'opacity-60' : ''}`}>
              {i > 0 && <div className="absolute top-10 -left-[100px] w-[100px] border-t-4 border-dashed border-outline-variant/30 -z-10"></div>}
              
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center relative z-10 ${
                module.status === 'completed' ? 'bg-secondary shadow-[0px_4px_0px_0px_rgba(1,34,1,0.3)] ring-4 ring-secondary-container' :
                module.status === 'current' ? 'bg-primary ring-8 ring-primary-container ring-offset-4 ring-offset-background shadow-[0px_8px_0px_0px_rgba(118,90,5,0.3)] animate-pulse' :
                module.status === 'up-next' ? 'bg-secondary shadow-[0px_4px_0px_0px_rgba(1,34,1,0.3)] ring-4 ring-secondary-container' :
                'bg-surface-container-highest border-2 border-outline-variant/50'
              }`}>
                {module.status === 'completed' ? (
                  <span className="material-symbols-outlined text-on-secondary text-headline-lg">check</span>
                ) : module.status === 'current' ? (
                  <span className="material-symbols-outlined text-on-primary text-display-xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                ) : module.status === 'up-next' ? (
                  <span className="material-symbols-outlined text-on-secondary text-headline-lg">upcoming</span>
                ) : (
                  <span className="material-symbols-outlined text-outline text-headline-lg">lock</span>
                )}
              </div>
              
              <div className="mt-4 bg-surface p-sm rounded-lg border-2 border-outline-variant/15 w-40 text-center shadow-sm">
                <span className={`font-label-pixel block text-[10px] uppercase ${module.status === 'current' ? 'text-primary' : module.status === 'up-next' || module.status === 'completed' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {moduleStatusLabel(module.status)}
                </span>
                <span className="font-bold text-sm leading-tight mt-1 block">{module.title}</span>
                {module.reason ? <span className="mt-1 block text-xs text-on-surface-variant">{module.reason}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PracticeScreen({
  activeDrill,
  analysis,
  buddy,
  cameraEnabled,
  error,
  isBusy,
  latestSession,
  practiceStage,
  previewStream,
  previousSession,
  prompt,
  selectedPromptId,
  seconds,
  status,
  onBackToPrompt,
  onCameraToggle,
  onChangePrompt,
  onChangePromptFromReview,
  onNewAttempt,
  onStartDrill,
  onStartDrillRecording,
  onSetStage,
  onStart,
  onStop
}: {
  activeDrill: DrillConfig | null;
  analysis: AnalysisResponse | null;
  buddy: BuddyState;
  cameraEnabled: boolean;
  error: string;
  isBusy: boolean;
  latestSession: SessionRecord | null;
  practiceStage: PracticeStage;
  previewStream: MediaStream | null;
  previousSession: SessionRecord | null;
  prompt: PracticePrompt;
  selectedPromptId: string;
  seconds: number;
  status: SessionStatus;
  onBackToPrompt: () => void;
  onCameraToggle: () => void;
  onChangePrompt: (promptId: string) => void;
  onChangePromptFromReview: () => void;
  onNewAttempt: () => void;
  onStartDrill: () => void;
  onStartDrillRecording: () => void;
  onSetStage: (stage: PracticeStage) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-md">
      {/* Left Column */}
      <section className="flex-1 lg:w-1/3 flex flex-col gap-md">
        <BuddyStrip buddy={buddy} mood={buddy.mood} />
        <StageTabs currentStage={practiceStage} drillEnabled={Boolean(activeDrill)} onJump={isBusy ? undefined : onSetStage} />
      </section>

      {/* Right Column */}
      <section className="flex-1 lg:w-2/3 flex flex-col gap-md">
        {practiceStage === "prompt" ? <PromptPicker selectedPromptId={selectedPromptId} status={status} onSelect={onChangePrompt} /> : null}
        {practiceStage === "drill" && activeDrill ? (
          <DrillBrief
            drill={activeDrill}
            prompt={prompt}
            onBack={onBackToPrompt}
            onStart={onStartDrillRecording}
          />
        ) : null}
        {practiceStage === "record" ? (
          <LiveStudio
            cameraEnabled={cameraEnabled}
            coachMessage={buddy.message}
            error={error}
            isBusy={isBusy}
            previewStream={previewStream}
            prompt={prompt}
            seconds={seconds}
            status={status}
            onBack={onBackToPrompt}
            onCameraToggle={onCameraToggle}
            onStart={onStart}
            onStop={onStop}
          />
        ) : null}
        {practiceStage === "review" && analysis ? (
          <ReviewScreen
            analysis={analysis}
            latestSessionDrill={latestSession?.drillId ? DRILL_CONFIGS[latestSession.drillId] : null}
            previousSession={previousSession}
            promptLabel={prompt.label}
            onChangePrompt={onChangePromptFromReview}
            onNewAttempt={onNewAttempt}
            onStartDrill={onStartDrill}
          />
        ) : null}
      </section>
    </div>
  );
}

function NavButton({
  active,
  disabled,
  label,
  icon,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  if (active) {
    return (
      <button disabled={disabled} onClick={onClick} className="w-full flex items-center gap-3 rounded-xl border border-primary/15 bg-primary-container/90 px-4 py-3 text-on-primary-container shadow-[0px_2px_0px_0px_rgba(28,28,11,0.16)] transition-all hover:translate-x-1 disabled:opacity-50">
        <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="font-body-md font-bold">{label}</span>
        <span className="ml-auto font-label-pixel text-[10px] uppercase tracking-[0.14em]">Live</span>
      </button>
    );
  }
  return (
    <button disabled={disabled} onClick={onClick} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-primary hover:translate-x-1 disabled:opacity-50">
      <span className="material-symbols-outlined shrink-0">{icon}</span>
      <span className="font-body-md">{label}</span>
    </button>
  );
}

function MobileNavButton({ active, icon, label, onClick }: { active: boolean, icon: string, label: string, onClick: () => void }) {
  if (active) {
    return (
      <button onClick={onClick} className="flex flex-col items-center gap-1 text-primary">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="font-label-pixel text-[10px] font-bold">{label}</span>
      </button>
    );
  }
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 text-on-surface-variant">
      <span className="material-symbols-outlined">{icon}</span>
      <span className="font-label-pixel text-[10px]">{label}</span>
    </button>
  );
}

function StageTabs({
  currentStage,
  drillEnabled,
  onJump
}: {
  currentStage: PracticeStage;
  drillEnabled: boolean;
  onJump?: (stage: PracticeStage) => void;
}) {
  const stages: Array<{ id: PracticeStage; label: string }> = [
    { id: "prompt", label: "Prompt" },
    { id: "record", label: "Record" },
    { id: "review", label: "Review" }
  ];
  if (drillEnabled) {
    stages.splice(1, 0, { id: "drill", label: "Drill" });
  }

  return (
    <div className="bg-surface-container p-md rounded-xl border border-outline-variant/15">
      <div className="flex justify-between items-center mb-base">
        <span className="font-label-pixel text-primary uppercase">Stage Progress</span>
        <span className="font-label-pixel text-primary">{practiceStageLabel(currentStage)}</span>
      </div>
      <div className="flex gap-xs w-full h-4">
        {stages.map((stage) => {
          const state = stageState(currentStage, stage.id);
          return (
            <button
              key={stage.id}
              onClick={() => onJump?.(stage.id)}
              disabled={!onJump}
              className={`flex-1 rounded-sm transition-colors ${state === 'active' ? 'bg-primary' : state === 'done' ? 'bg-secondary' : 'bg-surface-container-highest'}`}
              title={stage.label}
            />
          );
        })}
      </div>
    </div>
  );
}

function BuddyStrip({
  buddy,
  mood
}: {
  buddy: BuddyState;
  mood: BuddyMood;
}) {
  return (
    <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/15 shadow-[0px_4px_0px_0px_rgba(28,28,11,0.1)] relative overflow-hidden">
      <div className="flex items-start gap-md relative z-10">
        <div className="w-24 h-24 shrink-0 rounded-full bg-tertiary-container flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
          <LargeDuckAvatar mood={mood} />
        </div>
        <div className="flex flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 font-label-pixel text-[10px] uppercase tracking-[0.18em] text-primary">
              Ameego Buddy
            </span>
            <span className="font-label-pixel text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
              Your speaking guide
            </span>
          </div>
          <span className="font-label-pixel text-primary text-xs uppercase">{buddy.eyebrow}</span>
          <h2 className="font-headline-md text-primary leading-tight">{buddy.headline}</h2>
          <p className="text-on-surface-variant font-body-md mt-1">{buddy.message}</p>
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-10">
        <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>record_voice_over</span>
      </div>
    </div>
  );
}

function PromptPicker({
  selectedPromptId,
  status,
  onSelect
}: {
  selectedPromptId: string;
  status: SessionStatus;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="bg-surface border border-outline-variant/15 rounded-xl p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
      <span className="font-label-pixel text-primary mb-xs block">CHOOSE PROMPT</span>
      <h2 className="font-headline-lg text-on-surface mb-md">Pick the next speaking rep.</h2>
      <p className="text-on-surface-variant font-body-md mb-lg">Selecting a prompt moves straight into recording so the next action stays obvious.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        {PRACTICE_PROMPTS.map((prompt) => {
          const active = prompt.id === selectedPromptId;
          return (
            <button
              key={prompt.id}
              className={`text-left p-md rounded-xl border-2 transition-all press-down ${active ? 'border-primary bg-primary-container/10 shadow-[0px_4px_0px_0px_rgba(118,90,5,0.2)]' : 'border-outline-variant/30 hover:border-primary/50'}`}
              disabled={status === "recording" || status === "uploading"}
              onClick={() => onSelect(prompt.id)}
            >
              <div className="flex justify-between items-center mb-sm">
                <span className="font-bold text-on-surface">{prompt.label}</span>
                <span className="text-xs font-label-pixel bg-surface-container-high px-2 py-1 rounded">{prompt.duration}</span>
              </div>
              <strong className={`block text-sm mb-xs ${active ? 'text-primary' : 'text-on-surface-variant'}`}>{active ? "Selected next" : "Tap to practice"}</strong>
              <p className="text-sm text-on-surface-variant leading-tight">{prompt.brief}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveStudio({
  cameraEnabled,
  coachMessage,
  error,
  isBusy,
  previewStream,
  prompt,
  seconds,
  status,
  onBack,
  onCameraToggle,
  onStart,
  onStop
}: {
  cameraEnabled: boolean;
  coachMessage: string;
  error: string;
  isBusy: boolean;
  previewStream: MediaStream | null;
  prompt: PracticePrompt;
  seconds: number;
  status: SessionStatus;
  onBack: () => void;
  onCameraToggle: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = previewStream;
    if (previewStream) void element.play().catch(() => {});
    return () => {
      if (element) element.srcObject = null;
    };
  }, [previewStream]);

  return (
    <div className="bg-surface-bright flex flex-col items-center justify-center p-md lg:p-xl rounded-2xl border border-outline-variant shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] min-h-[500px] relative w-full">
      {status === 'recording' && (
        <div className="absolute top-md left-md flex items-center gap-2 bg-error-container/20 px-3 py-1.5 rounded-full border border-error/10">
          <span className="w-3 h-3 bg-error rounded-full animate-pulse"></span>
          <span className="font-label-pixel text-[10px] text-error">RECORDING LIVE</span>
        </div>
      )}
      
      <div className="absolute top-md right-md flex items-center gap-2">
        <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-label-pixel transition-colors ${cameraEnabled ? 'bg-primary-container text-on-primary-container border-primary/20' : 'bg-surface-container-high text-on-surface-variant border-outline-variant'}`} disabled={isBusy} onClick={onCameraToggle} type="button">
          <span className="material-symbols-outlined text-[16px]">{cameraEnabled ? 'videocam' : 'videocam_off'}</span>
          {cameraEnabled ? "CAM ON" : "CAM OFF"}
        </button>
      </div>

      <div className="text-center max-w-md mb-lg">
        <h2 className="font-headline-lg text-primary mb-2">{prompt.label}</h2>
        <p className="font-body-md text-on-surface-variant">{coachMessage}</p>
      </div>

      {cameraEnabled && (
        <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-surface-container-highest border-4 border-outline-variant/30 mb-lg flex items-center justify-center relative">
          {previewStream ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" /> : <span className="text-on-surface-variant text-sm">Camera starting...</span>}
        </div>
      )}

      {!cameraEnabled && status === 'recording' && (
        <div className="w-full max-w-md flex items-center justify-center gap-1.5 h-24 mb-xl">
          {[30,40,60,100,80,60,40,20,40,70,100,50].map((h, i) => (
            <div key={i} className="w-2 bg-secondary rounded-full animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}></div>
          ))}
        </div>
      )}

      <div className="mb-lg">
        <span className="font-display-xl text-[64px] text-primary font-bold tracking-tight">{formatClock(seconds)}</span>
      </div>

      <div className="flex flex-wrap justify-center items-center gap-md w-full">
        <button className="w-14 h-14 rounded-full bg-surface-container-high border-2 border-outline-variant flex items-center justify-center press-down transition-all hover:bg-surface-container-highest" disabled={isBusy} onClick={onBack}>
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
        
        {status !== 'recording' ? (
          <button className="px-8 py-4 bg-primary text-on-primary font-bold rounded-xl shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] press-down flex items-center gap-2" disabled={isBusy} onClick={onStart}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
            {status === "requesting" ? "Allow microphone" : "Start Recording"}
          </button>
        ) : (
          <button className="px-8 py-4 bg-primary-container text-on-primary-container font-bold rounded-xl shadow-[0px_4px_0px_0px_rgba(105,80,0,0.5)] press-down flex items-center gap-2" onClick={onStop}>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
            Stop Session
          </button>
        )}
      </div>

      {error && <p className="mt-md text-error bg-error-container/20 px-4 py-2 rounded text-sm">{error}</p>}
    </div>
  );
}

function ReviewScreen({
  analysis,
  latestSessionDrill,
  previousSession,
  promptLabel,
  onChangePrompt,
  onNewAttempt,
  onStartDrill
}: {
  analysis: AnalysisResponse;
  latestSessionDrill: DrillConfig | null;
  previousSession: SessionRecord | null;
  promptLabel: string;
  onChangePrompt: () => void;
  onNewAttempt: () => void;
  onStartDrill: () => void;
}) {
  const drillOutcome = latestSessionDrill ? evaluateDrillOutcome(latestSessionDrill, analysis, previousSession?.analysis ?? null) : null;

  return (
    <div className="space-y-md">
      <div className="bg-surface border border-outline-variant/15 rounded-xl p-md lg:p-lg shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-md gap-4">
          <div>
            <span className="font-label-pixel text-primary uppercase block mb-1">REVIEW</span>
            <h2 className="font-headline-lg text-on-surface">{promptLabel}</h2>
          </div>
          <div className="flex gap-sm">
            <button className="px-4 py-2 border-2 border-outline-variant text-on-surface-variant font-bold rounded hover:bg-surface-container-high transition-colors" onClick={onChangePrompt}>
              Change prompt
            </button>
            <button className="px-4 py-2 bg-primary text-on-primary font-bold rounded shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all" onClick={onNewAttempt}>
              {latestSessionDrill ? "Run drill again" : "New attempt"}
            </button>
          </div>
        </div>

        <div className="flex items-end gap-2 mb-md bg-surface-container p-md rounded-lg">
          <strong className="font-display-xl text-primary leading-none">{readinessScore(analysis.score)}</strong>
          <span className="font-headline-md text-on-surface-variant">/100 readiness</span>
        </div>

        <ul className="space-y-sm">
          {analysis.feedback.slice(0, 3).map((item) => (
            <li key={item} className="flex gap-3 bg-surface-container-lowest p-3 rounded border border-outline-variant/20">
              <span className="material-symbols-outlined text-secondary mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <span className="font-body-md">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-md rounded-xl bg-primary-container/15 border border-primary/15 p-md">
          <span className="font-label-pixel text-primary uppercase block mb-2">Recommended drill</span>
          <div className="font-headline-md text-on-surface mb-1">{analysis.recommendedDrill.title}</div>
          <p className="text-sm text-on-surface-variant">{analysis.recommendedDrill.summary}</p>
          <button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-[0px_4px_0px_0px_rgba(28,28,11,0.24)] transition-all active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.24)]" onClick={onStartDrill}>
            Start Drill
          </button>
        </div>
      </div>

      {drillOutcome ? (
        <div className={`rounded-xl border p-md shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] ${
          drillOutcome.status === "passed"
            ? "border-secondary/20 bg-secondary-container/30"
            : drillOutcome.status === "improved"
              ? "border-primary/20 bg-primary-container/20"
              : "border-outline-variant/20 bg-surface"
        }`}>
          <span className="font-label-pixel text-primary uppercase block mb-2">Drill Result</span>
          <div className="font-headline-md text-on-surface mb-1">{drillOutcome.headline}</div>
          <p className="text-sm text-on-surface-variant">{drillOutcome.detail}</p>
        </div>
      ) : null}

      <ExpandableSection title="Speech metrics">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-sm">
          <MetricTile label="Pacing" value={`${analysis.metrics.wpm} WPM`} note={pacingLabel(analysis.metrics.pacingBand)} />
          <MetricTile label="Fillers" value={`${analysis.metrics.fillerCount}`} note={`${analysis.metrics.fillerRate}% of words`} />
          <MetricTile label="Clarity" value={`${analysis.metrics.clarityScore}/10`} note="Main idea clarity" />
          <MetricTile label="Structure" value={`${analysis.metrics.structureScore}/10`} note={analysis.metrics.structureStatus} />
          <MetricTile label="Prompt match" value={`${analysis.metrics.promptCompletionScore}/10`} note="Task completion strength" />
          <MetricTile label="Repetition" value={`${analysis.metrics.repetitionScore}/10`} note={`${Math.round(analysis.metrics.uniqueWordRatio * 100)}% unique words`} />
        </div>
        <div className="mt-md rounded-lg bg-surface-container-low p-sm">
          <p className="font-label-pixel text-[10px] uppercase text-on-surface-variant mb-2">Repeated terms</p>
          <div className="flex flex-wrap gap-2">
            {analysis.metrics.topRepeatedTerms.length > 0 ? (
              analysis.metrics.topRepeatedTerms.map((term) => (
                <span key={term.term} className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-label-pixel text-on-surface">
                  {term.term} x{term.count}
                </span>
              ))
            ) : (
              <span className="text-sm text-on-surface-variant">No major repeated terms detected.</span>
            )}
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection title="Follow-up questions">
        <ul className="space-y-2">
          {analysis.followUpQuestions.map((item) => (
            <li key={item.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-sm">
              <p className="font-body-md text-on-surface">{item.prompt}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{item.intent}</p>
            </li>
          ))}
        </ul>
      </ExpandableSection>

      {analysis.nonverbal && (
        <ExpandableSection title="Nonverbal feedback">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md mt-sm mb-md">
            <SignalTile label="Eye contact" signal={analysis.nonverbal.eyeContact} />
            <SignalTile label="Posture" signal={analysis.nonverbal.posturePresence} />
            <SignalTile label="Gestures" signal={analysis.nonverbal.gestureActivity} />
          </div>
          <ul className="space-y-2">
            {analysis.nonverbal.feedback.map((item) => (
              <li key={item} className="flex gap-2 items-start text-sm bg-surface-container p-2 rounded">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ExpandableSection>
      )}

      <ExpandableSection title="Transcript">
        <div className="bg-surface-container-low p-md rounded-lg mt-sm border border-outline-variant/20">
          <p className="font-body-md text-on-surface-variant whitespace-pre-wrap">{analysis.transcript}</p>
        </div>
      </ExpandableSection>
    </div>
  );
}

function ExpandableSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <details className="group bg-surface border border-outline-variant/15 rounded-xl p-md shadow-sm">
      <summary className="font-headline-md text-on-surface cursor-pointer select-none flex items-center justify-between outline-none">
        {title}
        <span className="material-symbols-outlined text-outline-variant group-open:rotate-180 transition-transform">expand_more</span>
      </summary>
      <div className="mt-md animate-fade-in">{children}</div>
    </details>
  );
}

function MetricTile({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/20 rounded-lg p-sm">
      <p className="font-label-pixel text-on-surface-variant text-[10px] uppercase mb-1">{label}</p>
      <strong className="font-headline-md text-primary block leading-tight">{value}</strong>
      <span className="text-xs text-on-surface-variant">{note}</span>
    </div>
  );
}

function SignalTile({
  label,
  signal
}: {
  label: string;
  signal: NonverbalAnalysis["eyeContact"];
}) {
  const isGood = signal.status === 'strong' || signal.status === 'steady';
  return (
    <div className={`border-2 rounded-lg p-sm ${isGood ? 'bg-secondary-container/20 border-secondary/20' : 'bg-surface-container border-outline-variant/20'}`}>
      <p className="font-label-pixel text-[10px] uppercase mb-1" style={{ color: isGood ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)' }}>{label}</p>
      <strong className={`font-headline-md block leading-tight ${isGood ? 'text-secondary' : 'text-on-surface'}`}>{signal.score}/10</strong>
      <span className="text-xs text-on-surface-variant">{signal.note}</span>
    </div>
  );
}

function SimpleTopbar({
  onBack,
  title
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface/95 backdrop-blur shadow-[0px_2px_0px_0px_rgba(28,28,11,0.06),0px_12px_24px_-20px_rgba(28,28,11,0.28)]">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-gutter lg:px-md">
        <div className="flex items-center gap-sm">
          <div className="scale-[0.8] origin-left">
            <AmeegoLogo />
          </div>
          <p className="text-sm text-on-surface-variant">{title}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container"
          onClick={onBack}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
      </div>
    </header>
  );
}

function DrillBrief({
  drill,
  prompt,
  onBack,
  onStart
}: {
  drill: DrillConfig;
  prompt: PracticePrompt;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="bg-surface border border-outline-variant/15 rounded-xl p-md lg:p-lg shadow-[0px_4px_0px_0px_rgba(28,28,11,0.05)] space-y-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <span className="font-label-pixel text-primary uppercase block mb-1">Drill Mode</span>
          <h2 className="font-headline-lg text-on-surface">{drill.title}</h2>
          <p className="mt-2 text-on-surface-variant">{drill.instruction}</p>
        </div>
        <span className="material-symbols-outlined text-primary text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
      </div>

      <div className="grid gap-sm md:grid-cols-3">
        <div className="rounded-lg bg-surface-container-low p-sm border border-outline-variant/15">
          <p className="font-label-pixel text-[10px] uppercase text-primary mb-1">Target</p>
          <p className="text-sm text-on-surface">{drill.targetMetricLabel}</p>
        </div>
        <div className="rounded-lg bg-surface-container-low p-sm border border-outline-variant/15 md:col-span-2">
          <p className="font-label-pixel text-[10px] uppercase text-primary mb-1">Success Rule</p>
          <p className="text-sm text-on-surface">{drill.successRule}</p>
        </div>
      </div>

      <div className="rounded-xl bg-primary-container/15 border border-primary/15 p-md">
        <p className="font-label-pixel text-[10px] uppercase text-primary mb-2">Practice Framing</p>
        <p className="font-body-md text-on-surface mb-2">{drill.framingPrompt}</p>
        <p className="text-sm text-on-surface-variant">Recommended prompt: {prompt.label}</p>
      </div>

      <div className="flex flex-wrap gap-sm">
        <button className="px-4 py-2 border-2 border-outline-variant text-on-surface-variant font-bold rounded hover:bg-surface-container-high transition-colors" onClick={onBack}>
          Back
        </button>
        <button className="px-5 py-3 bg-primary text-on-primary font-bold rounded-lg shadow-[0px_4px_0px_0px_rgba(28,28,11,0.3)] active:translate-y-[2px] active:shadow-[0px_2px_0px_0px_rgba(28,28,11,0.3)] transition-all" onClick={onStart}>
          Start Drill Recording
        </button>
      </div>
    </div>
  );
}

function SmallDuckAvatar({ mood }: { mood: BuddyMood }) {
  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-surface-container-high border border-outline-variant/30 shrink-0" aria-hidden="true">
      <LargeDuckAvatar mood={mood} compact />
    </div>
  );
}

function LargeDuckAvatar({ mood, compact = false }: { mood: BuddyMood; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${compact ? "w-8 h-8" : "w-full h-full"}`} aria-hidden="true">
      <img alt="" className="w-full h-full object-contain drop-shadow-sm" src={buddyMoodAsset(mood)} />
    </div>
  );
}

function deriveRecommendation(analysis: AnalysisResponse | null): ModuleRecommendation | null {
  if (!analysis) {
    return null;
  }

  const metrics = analysis.metrics;

  if (metrics.fillerRate > 4 || metrics.fillerCount > 4) {
    return {
      id: "fillers",
      reason: `Fillers are the loudest friction point right now at ${metrics.fillerRate}% of total words.`
    };
  }

  if (metrics.pacingBand !== "optimal" || metrics.longestPauseSeconds >= 1.5) {
    return {
      id: "pacing",
      reason: `The current rhythm is ${pacingLabel(metrics.pacingBand).toLowerCase()} at ${metrics.wpm} WPM.`
    };
  }

  if (metrics.structureStatus !== "structured") {
    return {
      id: "structure",
      reason: "The response still needs a stronger opening-to-close arc."
    };
  }

  if (metrics.promptCompletionScore < 7 || metrics.repetitionScore < 7) {
    return {
      id: "clarity",
      reason: "The answer needs a tighter main point with less repeated phrasing."
    };
  }

  if (metrics.clarityScore < 7) {
    return {
      id: "clarity",
      reason: `Clarity is lagging behind the other signals at ${metrics.clarityScore}/10.`
    };
  }

  if (analysis.score >= 8.5) {
    return {
      id: "impromptu",
      reason: "The fundamentals are holding up. Shift the pressure onto faster thinking."
    };
  }

  return {
    id: "persuasion",
    reason: "The base delivery is stable enough to work on stronger arguments and audience impact."
  };
}

function buildLearningPath(
  analysis: AnalysisResponse | null,
  recommendation: ModuleRecommendation | null,
  moduleProgress: ModuleProgress
): PathModule[] {
  if (!analysis || !recommendation) {
    return LEARNING_MODULES.map((module) => ({
      ...module,
      status: "locked",
      reason: "Complete one scored session to personalize this module."
    }));
  }

  const currentId = moduleProgress.currentModuleId as ModuleId;
  const currentIndex = LEARNING_MODULES.findIndex((module) => module.id === currentId);

  return LEARNING_MODULES.map((module, index) => {
    if (moduleProgress.completedModuleIds.includes(module.id)) {
      return {
        ...module,
        status: "completed",
        reason: "This module has already cleared its threshold twice in a row."
      };
    }

    if (module.id === currentId) {
      return {
        ...module,
        status: "current",
        reason: recommendation.reason
      };
    }

    if (index === currentIndex + 1) {
      return {
        ...module,
        status: "up-next",
        reason: "This becomes the next stretch target after the current weak spot settles."
      };
    }

    return {
      ...module,
      status: "locked",
      reason: "Keep this in reserve until the current module has done its job."
    };
  });
}

function deriveBuddyState(input: {
  route: AppRoute;
  assessmentStage: AssessmentStage;
  practiceStage: PracticeStage;
  status: SessionStatus;
  error: string;
  analysis: AnalysisResponse | null;
  selectedPrompt: PracticePrompt;
  recommendation: ModuleRecommendation | null;
  placementLevel?: UserProfile["placementLevel"];
}): BuddyState {
  const { route, assessmentStage, practiceStage, status, error, analysis, selectedPrompt, recommendation, placementLevel } = input;

  if (route === "home") {
    if (analysis) {
      return {
        mood: "celebrating",
        eyebrow: "Welcome back",
        headline: "Your latest score is ready.",
        message: "Open Dashboard for the snapshot or Practice for the next rep."
      };
    }

    return {
      mood: "encouraging",
      eyebrow: "First step",
      headline: "Start with one guided check.",
      message: "Ameego stays minimal until it has one real speaking sample."
    };
  }

  if (route === "assessment") {
    if (assessmentStage === "brief") {
      return {
        mood: "attentive",
        eyebrow: "Assessment brief",
        headline: "This works like placement.",
        message: "One short intro is enough to unlock a cleaner dashboard and practice flow."
      };
    }

    if (status === "requesting") {
      return {
        mood: "attentive",
        eyebrow: "Permission check",
        headline: "Waiting for microphone access.",
        message: "Allow the browser prompt so Ameego can hear this first sample cleanly."
      };
    }

    if (status === "recording") {
      return {
        mood: "attentive",
        eyebrow: "Live assessment",
        headline: "Keep it formal and direct.",
        message: "Name, role, focus, then one thing that matters to you."
      };
    }

    if (status === "uploading") {
      return {
        mood: "thinking",
        eyebrow: "Analyzing",
        headline: "Building your first snapshot.",
        message: "Ameego is checking pacing, fillers, clarity, and structure now."
      };
    }

    if (status === "error" || error) {
      return {
        mood: "concerned",
        eyebrow: "Needs retry",
        headline: "That take did not land cleanly yet.",
        message: "Fix the permission issue or record again."
      };
    }

    return {
      mood: "attentive",
      eyebrow: "Assessment live",
      headline: "Introduce yourself formally.",
      message: "Keep it short, clear, and structured."
    };
  }

  if (route === "dashboard") {
    if (!analysis) {
      return {
        mood: "neutral",
        eyebrow: "Awaiting score",
        headline: "Dashboard opens after one real sample.",
        message: "Take the short assessment first."
      };
    }

    return {
      mood: analysis.score >= 8 ? "celebrating" : "encouraging",
      eyebrow: "Latest score",
      headline: `${readinessScore(analysis.score)}/100${placementLevel ? ` · ${placementLevel}` : ""}`,
      message: recommendation ? `${moduleTitle(recommendation.id)} is the cleanest next focus.` : "Use the latest score to decide what to tighten next."
    };
  }

  if (status === "requesting") {
    return {
      mood: "attentive",
      eyebrow: "Permission check",
      headline: "Waiting for microphone access.",
      message: "Allow the browser prompt so Ameego can hear this run cleanly."
    };
  }

  if (status === "recording") {
    return {
      mood: "attentive",
      eyebrow: "Live take",
      headline: "Keep the answer moving.",
      message: "Lead with the point and close before the energy drops."
    };
  }

  if (status === "uploading") {
    return {
      mood: "thinking",
      eyebrow: "Analysis in progress",
      headline: "Checking pace, fillers, and clarity.",
      message: "The next screen will only surface the most useful takeaways first."
    };
  }

  if (status === "error" || error) {
    return {
      mood: "concerned",
      eyebrow: "Needs retry",
      headline: "That rep did not land cleanly.",
      message: "Fix the issue or record again. The next clean take will replace the current snapshot."
    };
  }

  if (practiceStage === "review" && analysis) {
    return {
      mood: analysis.score >= 8 ? "celebrating" : "encouraging",
      eyebrow: "Review ready",
      headline: `${readinessScore(analysis.score)}/100 and one obvious next move.`,
      message: recommendation ? recommendation.reason : "Use the takeaways below, then record again."
    };
  }

  if (practiceStage === "drill") {
    return {
      mood: "attentive",
      eyebrow: "Drill brief",
      headline: "One narrow target for this rep.",
      message: "Follow the drill instruction literally so the next score reflects one specific change."
    };
  }

  if (practiceStage === "record") {
    return {
      mood: "attentive",
      eyebrow: "Record stage",
      headline: selectedPrompt.label,
      message: selectedPrompt.brief
    };
  }

  return {
    mood: "neutral",
    eyebrow: "Choose prompt",
    headline: "Pick one scenario and commit to it.",
    message: "The next step becomes recording immediately."
  };
}

function practiceStageLabel(stage: PracticeStage) {
  switch (stage) {
    case "drill":
      return "Drill";
    case "record":
      return "Recording";
    case "review":
      return "Review";
    default:
      return "Prompt";
  }
}

function stageState(currentStage: PracticeStage, stage: PracticeStage) {
  const order: PracticeStage[] = ["prompt", "drill", "record", "review"];
  const currentIndex = order.indexOf(currentStage);
  const stageIndex = order.indexOf(stage);

  if (stageIndex === currentIndex) {
    return "active";
  }

  return stageIndex < currentIndex ? "done" : "upcoming";
}

function readinessScore(score: number) {
  return Math.round(score * 10);
}

function pacingLabel(band: AnalysisResponse["metrics"]["pacingBand"]) {
  switch (band) {
    case "fast":
      return "Fast";
    case "slow":
      return "Slow";
    default:
      return "Optimal";
  }
}

function moduleTitle(id: ModuleId) {
  return LEARNING_MODULES.find((module) => module.id === id)?.title ?? id;
}

function moduleStatusLabel(status: ModuleStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "current":
      return "Current";
    case "up-next":
      return "Up next";
    default:
      return "Later";
  }
}

function drillPasses(drillId: DrillId, analysis: AnalysisResponse) {
  switch (drillId) {
    case "pause-control":
      return analysis.metrics.fillerRate <= 2.5;
    case "pacing-ladder":
      return analysis.metrics.pacingBand === "optimal" && !analysis.metrics.unevenPacing;
    case "point-example-close":
      return analysis.metrics.structureStatus === "structured";
    case "one-minute-explanation":
      return analysis.metrics.clarityScore >= 7.5 && analysis.metrics.repetitionScore >= 7;
    case "impromptu-pressure-round":
      return readinessScore(analysis.score) >= 85;
    case "persuasive-answer":
      return analysis.metrics.promptCompletionScore >= 7.5 && analysis.score >= 7.5;
    default:
      return false;
  }
}

function drillImproved(drillId: DrillId, current: AnalysisResponse, previous: AnalysisResponse) {
  switch (drillId) {
    case "pause-control":
      return current.metrics.fillerRate < previous.metrics.fillerRate;
    case "pacing-ladder":
      return current.metrics.pacingScore > previous.metrics.pacingScore || (!current.metrics.unevenPacing && previous.metrics.unevenPacing);
    case "point-example-close":
      return structureRank(current.metrics.structureStatus) > structureRank(previous.metrics.structureStatus);
    case "one-minute-explanation":
      return current.metrics.clarityScore > previous.metrics.clarityScore || current.metrics.repetitionScore > previous.metrics.repetitionScore;
    case "impromptu-pressure-round":
      return readinessScore(current.score) > readinessScore(previous.score);
    case "persuasive-answer":
      return current.metrics.promptCompletionScore > previous.metrics.promptCompletionScore || current.score > previous.score;
    default:
      return false;
  }
}

function structureRank(status: AnalysisResponse["metrics"]["structureStatus"]) {
  switch (status) {
    case "structured":
      return 3;
    case "partial":
      return 2;
    default:
      return 1;
  }
}

function averageNonverbalScore(nonverbal: NonverbalAnalysis) {
  const total = nonverbal.eyeContact.score + nonverbal.posturePresence.score + nonverbal.gestureActivity.score;
  return Number((total / 3).toFixed(1));
}

function buddyMoodAsset(mood: BuddyMood) {
  switch (mood) {
    case "attentive":
      return "/ameego-icons/ameego-thinking.png";
    case "thinking":
      return "/ameego-icons/ameego-thinking.png";
    case "celebrating":
      return "/ameego-icons/ameego-laughing.png";
    case "concerned":
      return "/ameego-icons/ameego-worried.png";
    case "encouraging":
      return "/ameego-icons/ameego-heart-eyes.png";
    default:
      return "/ameego-icons/ameego-neutral.png";
  }
}

function statusLabel(status: SessionStatus) {
  switch (status) {
    case "requesting":
      return "Mic permission";
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

async function requestMicrophoneStream() {
  const microphoneRequest = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error("Microphone permission timed out. Allow microphone access in the browser, then try again."));
    }, MICROPHONE_TIMEOUT_MS);
  });

  return Promise.race([microphoneRequest, timeout]);
}

async function requestRecordingStream(cameraEnabled: boolean) {
  if (!cameraEnabled) {
    return requestMicrophoneStream();
  }

  const mediaRequest = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 }
    }
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => {
      reject(new Error("Camera or microphone permission timed out. Allow access in the browser, then try again."));
    }, MICROPHONE_TIMEOUT_MS);
  });

  return Promise.race([mediaRequest, timeout]);
}

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission is blocked. Click the site settings icon beside the address bar, set Microphone to Allow, reload the page, then try again.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Connect or enable a microphone, then try again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Microphone access was blocked or unavailable.";
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

function pickRecorderOptions(cameraEnabled: boolean) {
  const preferredTypes = cameraEnabled
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : undefined;
}

function stopStream(streamRef: MutableRefObject<MediaStream | null>) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AnalysisResponse>;
  return typeof candidate.score === "number" && typeof candidate.transcript === "string" && typeof candidate.durationSeconds === "number";
}

function evaluateDrillOutcome(drill: DrillConfig, current: AnalysisResponse, previous: AnalysisResponse | null): DrillOutcome {
  const passed = drillPasses(drill.id, current);
  if (passed) {
    return {
      status: "passed",
      headline: `${drill.title} cleared.`,
      detail: `This take met the drill threshold for ${drill.targetMetricLabel.toLowerCase()}.`
    };
  }

  const improved = previous ? drillImproved(drill.id, current, previous) : false;
  if (improved) {
    return {
      status: "improved",
      headline: "Moving in the right direction.",
      detail: `This drill attempt improved the focus metric, but it has not cleared the full success rule yet.`
    };
  }

  return {
    status: "try-again",
    headline: "Try the drill one more time.",
    detail: previous
      ? `The target metric did not improve enough on this attempt. Keep the drill instruction tighter on the next run.`
      : `Use the drill instruction as literally as possible on the next run so the target metric has room to move.`
  };
}

function isStoredAppState(value: unknown): value is StoredAppState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredAppState>;
  return Array.isArray(candidate.sessions) && candidate.moduleProgress !== undefined;
}

function migrateStoredState(value: StoredAppState | AnalysisResponse) {
  if (isStoredAppState(value)) {
    return {
      profile: value.profile ?? {},
      sessions: (value.sessions ?? []).slice(0, 20),
      moduleProgress: value.moduleProgress ?? {
        currentModuleId: "fillers",
        completedModuleIds: []
      },
      latestPromptId: value.latestPromptId
    } satisfies StoredAppState;
  }

  if (!isAnalysisResponse(value)) {
    return null;
  }

  const session: SessionRecord = {
    id: createSessionId(),
    completedAt: new Date().toISOString(),
    promptId: value.promptId,
    promptLabel: value.promptLabel,
    sessionType: value.sessionType ?? "practice",
    analysis: value
  };

  return {
    profile: value.placementLevel ? { placementLevel: value.placementLevel } : {},
    sessions: [session],
    moduleProgress: {
      currentModuleId: deriveRecommendation(value)?.id ?? "fillers",
      completedModuleIds: []
    },
    latestPromptId: value.promptId
  } satisfies StoredAppState;
}

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveStreakDays(sessions: SessionRecord[]) {
  if (sessions.length === 0) {
    return 0;
  }

  const uniqueDays = Array.from(new Set(sessions.map((session) => session.completedAt.slice(0, 10)))).sort().reverse();
  let streak = 0;
  const cursor = new Date();

  for (let index = 0; index < uniqueDays.length; index += 1) {
    const expectedDay = new Date(cursor);
    expectedDay.setUTCDate(cursor.getUTCDate() - index);
    const expectedKey = expectedDay.toISOString().slice(0, 10);

    if (uniqueDays[index] === expectedKey) {
      streak += 1;
      continue;
    }

    if (index === 0) {
      const yesterday = new Date(cursor);
      yesterday.setUTCDate(cursor.getUTCDate() - 1);
      if (uniqueDays[0] === yesterday.toISOString().slice(0, 10)) {
        streak = 1;
      }
    }
    break;
  }

  return streak;
}

function deriveLatestDelta(sessions: SessionRecord[]) {
  if (sessions.length < 2) {
    return null;
  }
  return readinessScore(sessions[0].analysis.score) - readinessScore(sessions[1].analysis.score);
}

function updateModuleProgress(sessions: SessionRecord[], previous: ModuleProgress): ModuleProgress {
  const recommended = deriveRecommendation(sessions[0]?.analysis ?? null);
  if (!recommended) {
    return previous;
  }

  const completedIds = new Set(previous.completedModuleIds);

  for (const module of LEARNING_MODULES) {
    if (completedIds.has(module.id)) {
      continue;
    }
    if (meetsModuleThreshold(module.id, sessions[0]?.analysis) && meetsModuleThreshold(module.id, sessions[1]?.analysis)) {
      completedIds.add(module.id);
    }
  }

  const nextCurrent =
    LEARNING_MODULES.find((module) => module.id === recommended.id && !completedIds.has(module.id))?.id ??
    LEARNING_MODULES.find((module) => !completedIds.has(module.id))?.id ??
    previous.currentModuleId;

  return {
    currentModuleId: nextCurrent,
    completedModuleIds: Array.from(completedIds)
  };
}

function meetsModuleThreshold(moduleId: string, analysis: AnalysisResponse | undefined) {
  if (!analysis) {
    return false;
  }

  switch (moduleId) {
    case "fillers":
      return analysis.metrics.fillerRate <= 2.5;
    case "pacing":
      return analysis.metrics.pacingBand === "optimal" && !analysis.metrics.unevenPacing;
    case "clarity":
      return analysis.metrics.clarityScore >= 7.5 && analysis.metrics.repetitionScore >= 7;
    case "structure":
      return analysis.metrics.structureStatus === "structured";
    case "persuasion":
      return analysis.metrics.promptCompletionScore >= 7.5 && analysis.score >= 7.5;
    case "impromptu":
      return analysis.score >= 8.5;
    default:
      return false;
  }
}
