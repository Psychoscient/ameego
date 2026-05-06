"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { PRACTICE_PROMPTS } from "@/lib/prompts";
import type { AnalysisResponse, NonverbalAnalysis, PracticePrompt } from "@/lib/types";

const STORAGE_KEY = "ameego-latest-analysis";
const MICROPHONE_TIMEOUT_MS = 10000;

type AppRoute = "home" | "assessment" | "dashboard" | "practice";
type AssessmentStage = "brief" | "record";
type PracticeStage = "prompt" | "record" | "review";
type SessionStatus = "idle" | "requesting" | "recording" | "uploading" | "success" | "error";
type BuddyMood = "neutral" | "attentive" | "thinking" | "celebrating" | "concerned" | "encouraging";
type ModuleId = "fillers" | "pacing" | "clarity" | "structure" | "persuasion" | "impromptu";
type ModuleStatus = "current" | "up-next" | "locked";

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

type StoredSession = {
  analysis: AnalysisResponse;
  promptId?: string;
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
      const parsed = JSON.parse(stored) as AnalysisResponse | StoredSession;
      if (isStoredSession(parsed)) {
        setAnalysis(parsed.analysis);
        if (parsed.promptId && PRACTICE_PROMPTS.some((prompt) => prompt.id === parsed.promptId)) {
          setSelectedPromptId(parsed.promptId);
        }
      } else if (isAnalysisResponse(parsed)) {
        setAnalysis(parsed);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setStatus("success");
      setPracticeStage("review");
      setRoute("dashboard");
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
  const modules = buildLearningPath(analysis, recommendation);
  const buddy = deriveBuddyState({
    route,
    assessmentStage,
    practiceStage,
    status,
    error,
    analysis,
    selectedPrompt: currentPrompt,
    recommendation
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

  function goHome() {
    if (isBusy) {
      return;
    }
    resetCaptureState();
    setRoute("home");
  }

  function beginAssessment() {
    if (isBusy) {
      return;
    }
    resetCaptureState();
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
    setPracticeStage(stage);
    setRoute("practice");
  }

  function choosePrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setError("");
    setPracticeStage("record");
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
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          analysis: nextAnalysis,
          promptId: PRACTICE_PROMPTS.some((prompt) => prompt.id === currentPrompt.id) ? currentPrompt.id : undefined
        } satisfies StoredSession)
      );

      setStatus("success");
      if (route === "assessment") {
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

  if (route === "home") {
    return <LandingScreen analysis={analysis} onOpenDashboard={openDashboard} onOpenPractice={() => openPractice("prompt")} onStartAssessment={beginAssessment} />;
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
      isBusy={isBusy}
      onHome={goHome}
      onOpenDashboard={openDashboard}
      onOpenPractice={() => openPractice("prompt")}
    >
      {route === "dashboard" ? (
        <DashboardScreen
          analysis={analysis}
          buddy={buddy}
          modules={modules}
          recommendation={recommendation}
          onPractice={() => openPractice("prompt")}
        />
      ) : null}
      {route === "practice" ? (
        <PracticeScreen
          analysis={analysis}
          buddy={buddy}
          cameraEnabled={cameraEnabled}
          error={error}
          isBusy={isBusy}
          practiceStage={practiceStage}
          previewStream={previewStream}
          prompt={selectedPrompt}
          selectedPromptId={selectedPromptId}
          seconds={seconds}
          status={status}
          onBackToPrompt={() => setPracticeStage("prompt")}
          onCameraToggle={() => setCameraEnabled((value) => !value)}
          onChangePrompt={choosePrompt}
          onChangePromptFromReview={() => {
            resetCaptureState();
            setPracticeStage("prompt");
            setRoute("practice");
          }}
          onNewAttempt={() => {
            resetCaptureState();
            setPracticeStage("record");
            setRoute("practice");
          }}
          onSetStage={setPracticeStage}
          onStart={startRecording}
          onStop={stopRecording}
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
    <main className="home-shell">
      <header className="simple-topbar">
        <div className="brand-lockup">
          <SmallDuckAvatar mood={analysis ? "celebrating" : "neutral"} />
          <div>
            <p className="brand-name">Ameego</p>
            <p className="brand-tag">AI speaking coach</p>
          </div>
        </div>
        {analysis ? (
          <div className="button-row">
            <button className="ghost" onClick={onOpenDashboard}>
              Dashboard
            </button>
            <button className="primary" onClick={onOpenPractice}>
              Practice
            </button>
          </div>
        ) : null}
      </header>

      <section className="home-card">
        <p className="eyebrow">Formal speaking, simplified</p>
        <h1>One clear practice loop. No noisy dashboard first.</h1>
        <p className="home-copy">
          Start with a short speaking check. Ameego turns it into a readiness score, one clear next module, and a calmer practice flow instead of throwing everything on screen at once.
        </p>
        <div className="home-actions">
          <button className="primary" onClick={analysis ? onOpenPractice : onStartAssessment}>
            {analysis ? "Start new practice" : "Start first assessment"}
          </button>
          {analysis ? (
            <button className="ghost" onClick={onOpenDashboard}>
              View latest score
            </button>
          ) : null}
        </div>
      </section>
    </main>
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
    <main className="compact-shell">
      <SimpleTopbar onBack={onBack} title="Initial assessment" />
      <section className="single-column">
        <BuddyStrip buddy={buddy} mood={buddy.mood} />

        {stage === "brief" ? (
          <section className="card-surface content-card">
            <p className="eyebrow">Step 1 of 2</p>
            <h2>Introduce yourself formally.</h2>
            <p className="body-copy">Say your name, what you do, and one thing that matters to you. This is the placement step that unlocks the cleaner dashboard and practice flow.</p>
            <div className="compact-list">
              {QUICK_TIPS.map((tip) => (
                <span key={tip}>{tip}</span>
              ))}
            </div>
            <div className="button-row">
              <button className="primary" onClick={onContinue}>
                Continue to record
              </button>
            </div>
          </section>
        ) : (
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
        )}
      </section>
    </main>
  );
}

function AppShell({
  activeRoute,
  analysis,
  recommendation,
  status,
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
  isBusy: boolean;
  children: ReactNode;
  onHome: () => void;
  onOpenDashboard: () => void;
  onOpenPractice: () => void;
}) {
  return (
    <main className="app-frame">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <SmallDuckAvatar mood={analysis ? "encouraging" : "neutral"} />
          <div>
            <p className="brand-name">Ameego</p>
            <p className="brand-tag">Practice loop</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <NavButton active={activeRoute === "dashboard"} disabled={isBusy} label="Dashboard" note={analysis ? `${readinessScore(analysis.score)}/100 readiness` : "Score pending"} onClick={onOpenDashboard} />
          <NavButton active={activeRoute === "practice"} disabled={isBusy} label="Practice" note={statusLabel(status)} onClick={onOpenPractice} />
        </nav>

        <button className="primary sidebar-cta" disabled={isBusy} onClick={onOpenPractice}>
          New session
        </button>

        <section className="sidebar-note">
          <p className="eyebrow">Next module</p>
          <strong>{recommendation ? moduleTitle(recommendation.id) : "Unlocked after first score"}</strong>
        </section>

        <button className="ghost sidebar-home" onClick={onHome}>
          Home
        </button>
      </aside>

      <div className="workspace">
        <header className="workspace-topbar">
          <div>
            <p className="eyebrow">{activeRoute === "dashboard" ? "Overview" : "Practice session"}</p>
            <h1>{activeRoute === "dashboard" ? "Dashboard" : "Practice"}</h1>
          </div>
          <div className="topbar-chip-row">
            <span>{analysis ? `${readinessScore(analysis.score)}/100` : "Not scored yet"}</span>
            <span>{recommendation ? moduleTitle(recommendation.id) : "Assessment first"}</span>
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Primary navigation">
          <NavButton active={activeRoute === "dashboard"} disabled={isBusy} label="Dashboard" note="Overview" onClick={onOpenDashboard} />
          <NavButton active={activeRoute === "practice"} disabled={isBusy} label="Practice" note="Session" onClick={onOpenPractice} />
        </nav>

        <section className="workspace-content">{children}</section>
      </div>
    </main>
  );
}

function DashboardScreen({
  analysis,
  buddy,
  modules,
  recommendation,
  onPractice
}: {
  analysis: AnalysisResponse | null;
  buddy: BuddyState;
  modules: PathModule[];
  recommendation: ModuleRecommendation | null;
  onPractice: () => void;
}) {
  if (!analysis) {
    return (
      <section className="single-column">
        <section className="card-surface content-card">
          <h2>Complete one short check first.</h2>
          <p className="body-copy">The dashboard stays intentionally empty until Ameego has one real speaking sample to work from.</p>
          <button className="primary" onClick={onPractice}>
            Go to practice
          </button>
        </section>
      </section>
    );
  }

  const essentialMetrics = [
    { label: "Pacing", value: `${analysis.metrics.wpm} WPM`, note: pacingLabel(analysis.metrics.pacingBand) },
    { label: "Fillers", value: `${analysis.metrics.fillerCount}`, note: `${analysis.metrics.fillerRate}% of words` },
    { label: "Clarity", value: `${analysis.metrics.clarityScore}/10`, note: analysis.metrics.structureStatus }
  ];

  return (
    <section className="single-column">
      <section className="dashboard-hero">
        <article className="card-surface hero-score-card">
          <p className="eyebrow">Speaking readiness</p>
          <div className="hero-score-number">{readinessScore(analysis.score)}</div>
          <p className="hero-score-subtitle">Your latest scored take. Use this as the baseline for the next rep.</p>
          <button className="primary" onClick={onPractice}>
            Practice again
          </button>
        </article>

        <div className="dashboard-side">
          <BuddyStrip buddy={buddy} mood={buddy.mood} />
          <article className="card-surface compact-card">
            <p className="eyebrow">Next module</p>
            <h3>{recommendation ? moduleTitle(recommendation.id) : "First coaching target"}</h3>
            <p>{recommendation ? recommendation.reason : "Ameego will recommend a module after the first scored session."}</p>
          </article>
        </div>
      </section>

      <section className="metric-row">
        {essentialMetrics.map((metric) => (
          <article key={metric.label} className="metric-tile">
            <p className="eyebrow">{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.note}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-lower">
        <article className="card-surface compact-card">
          <p className="eyebrow">Top takeaways</p>
          <ul className="plain-list">
            {analysis.feedback.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card-surface compact-card">
          <p className="eyebrow">Roadmap</p>
          <div className="roadmap-inline">
            {modules.slice(0, 3).map((module) => (
              <div key={module.id} className={`roadmap-pill roadmap-pill-${module.status}`}>
                <strong>{module.title}</strong>
                <span>{moduleStatusLabel(module.status)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
}

function PracticeScreen({
  analysis,
  buddy,
  cameraEnabled,
  error,
  isBusy,
  practiceStage,
  previewStream,
  prompt,
  selectedPromptId,
  seconds,
  status,
  onBackToPrompt,
  onCameraToggle,
  onChangePrompt,
  onChangePromptFromReview,
  onNewAttempt,
  onSetStage,
  onStart,
  onStop
}: {
  analysis: AnalysisResponse | null;
  buddy: BuddyState;
  cameraEnabled: boolean;
  error: string;
  isBusy: boolean;
  practiceStage: PracticeStage;
  previewStream: MediaStream | null;
  prompt: PracticePrompt;
  selectedPromptId: string;
  seconds: number;
  status: SessionStatus;
  onBackToPrompt: () => void;
  onCameraToggle: () => void;
  onChangePrompt: (promptId: string) => void;
  onChangePromptFromReview: () => void;
  onNewAttempt: () => void;
  onSetStage: (stage: PracticeStage) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <section className="practice-grid">
      <aside className="practice-rail">
        <StageTabs currentStage={practiceStage} onJump={isBusy ? undefined : onSetStage} />
        <BuddyStrip buddy={buddy} mood={buddy.mood} />
      </aside>

      <section className="practice-main">
        {practiceStage === "prompt" ? <PromptPicker selectedPromptId={selectedPromptId} status={status} onSelect={onChangePrompt} /> : null}
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
        {practiceStage === "review" && analysis ? <ReviewScreen analysis={analysis} promptLabel={prompt.label} onChangePrompt={onChangePromptFromReview} onNewAttempt={onNewAttempt} /> : null}
      </section>
    </section>
  );
}

function NavButton({
  active,
  disabled,
  label,
  note,
  onClick
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button className={`nav-button${active ? " active" : ""}`} disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      <small>{note}</small>
    </button>
  );
}

function StageTabs({
  currentStage,
  onJump
}: {
  currentStage: PracticeStage;
  onJump?: (stage: PracticeStage) => void;
}) {
  const stages: Array<{ id: PracticeStage; label: string }> = [
    { id: "prompt", label: "Prompt" },
    { id: "record", label: "Record" },
    { id: "review", label: "Review" }
  ];

  return (
    <nav className="stage-tabs" aria-label="Practice flow">
      {stages.map((stage) => (
        <button key={stage.id} className={`stage-tab stage-tab-${stageState(currentStage, stage.id)}`} disabled={!onJump} onClick={() => onJump?.(stage.id)}>
          {stage.label}
        </button>
      ))}
    </nav>
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
    <article className="buddy-strip">
      <div className="buddy-strip-avatar">
        <SmallDuckAvatar mood={mood} />
      </div>
      <div>
        <p className="eyebrow">{buddy.eyebrow}</p>
        <strong>{buddy.headline}</strong>
        <p>{buddy.message}</p>
      </div>
    </article>
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
    <section className="card-surface content-card">
      <p className="eyebrow">Choose prompt</p>
      <h2>Pick the next speaking rep.</h2>
      <p className="body-copy">Selecting a prompt moves straight into recording so the next action stays obvious.</p>
      <div className="prompt-stack">
        {PRACTICE_PROMPTS.map((prompt) => {
          const active = prompt.id === selectedPromptId;
          return (
            <button
              key={prompt.id}
              className={`prompt-card${active ? " active" : ""}`}
              disabled={status === "recording" || status === "uploading"}
              onClick={() => onSelect(prompt.id)}
            >
              <div className="prompt-card-topline">
                <span>{prompt.label}</span>
                <em>{prompt.duration}</em>
              </div>
              <strong>{active ? "Selected next" : "Tap to practice"}</strong>
              <p>{prompt.brief}</p>
            </button>
          );
        })}
      </div>
    </section>
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
    if (!element) {
      return;
    }

    element.srcObject = previewStream;
    if (previewStream) {
      void element.play().catch(() => {});
    }

    return () => {
      if (element) {
        element.srcObject = null;
      }
    };
  }, [previewStream]);

  return (
    <section className="card-surface content-card">
      <div className="content-head">
        <div>
          <p className="eyebrow">Record</p>
          <h2>{prompt.label}</h2>
        </div>
        <div className="button-row meta-row">
          <span className="meta-chip">{prompt.duration}</span>
          <span className="meta-chip">{statusLabel(status)}</span>
          <button className={`camera-toggle${cameraEnabled ? " active" : ""}`} disabled={isBusy} onClick={onCameraToggle} type="button">
            {cameraEnabled ? "Camera on" : "Camera off"}
          </button>
        </div>
      </div>

      <p className="body-copy">{coachMessage}</p>

      {cameraEnabled ? (
        previewStream ? <video ref={videoRef} autoPlay className="camera-preview" muted playsInline /> : <div className="camera-preview camera-preview-placeholder">Camera preview will appear once recording starts.</div>
      ) : (
        <div className="camera-preview camera-preview-placeholder">Audio-only mode still scores pace, fillers, structure, and clarity.</div>
      )}

      <div className="studio-timer">{formatClock(seconds)}</div>

      <div className="button-row">
        <button className="ghost" disabled={isBusy} onClick={onBack}>
          Change prompt
        </button>
        <button className="primary" disabled={isBusy} onClick={onStart}>
          {status === "requesting" ? "Allow microphone" : status === "recording" ? "Recording..." : "Start recording"}
        </button>
        <button className="secondary" disabled={status !== "recording"} onClick={onStop}>
          Stop and analyze
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="compact-list">
        {STRUCTURE_TIPS.map((tip) => (
          <span key={tip}>{tip}</span>
        ))}
      </div>
    </section>
  );
}

function ReviewScreen({
  analysis,
  promptLabel,
  onChangePrompt,
  onNewAttempt
}: {
  analysis: AnalysisResponse;
  promptLabel: string;
  onChangePrompt: () => void;
  onNewAttempt: () => void;
}) {
  return (
    <section className="single-column">
      <article className="card-surface content-card">
        <div className="content-head">
          <div>
            <p className="eyebrow">Review</p>
            <h2>{promptLabel}</h2>
          </div>
          <div className="button-row">
            <button className="ghost" onClick={onChangePrompt}>
              Change prompt
            </button>
            <button className="primary" onClick={onNewAttempt}>
              New attempt
            </button>
          </div>
        </div>

        <div className="review-score-line">
          <strong>{readinessScore(analysis.score)}</strong>
          <span>/100 readiness</span>
        </div>

        <ul className="takeaway-list">
          {analysis.feedback.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <ExpandableSection title="Speech metrics">
        <div className="metric-row review-row">
          <MetricTile label="Pacing" value={`${analysis.metrics.wpm} WPM`} note={pacingLabel(analysis.metrics.pacingBand)} />
          <MetricTile label="Fillers" value={`${analysis.metrics.fillerCount}`} note={`${analysis.metrics.fillerRate}% of words`} />
          <MetricTile label="Clarity" value={`${analysis.metrics.clarityScore}/10`} note="Main idea clarity" />
        </div>
      </ExpandableSection>

      {analysis.nonverbal ? (
        <ExpandableSection title="Nonverbal feedback">
          <div className="nonverbal-row">
            <SignalTile label="Eye contact" signal={analysis.nonverbal.eyeContact} />
            <SignalTile label="Posture" signal={analysis.nonverbal.posturePresence} />
            <SignalTile label="Gestures" signal={analysis.nonverbal.gestureActivity} />
          </div>
          <ul className="plain-list">
            {analysis.nonverbal.feedback.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ExpandableSection>
      ) : null}

      <ExpandableSection title="Transcript">
        <p className="body-copy no-top-gap">{analysis.transcript}</p>
      </ExpandableSection>
    </section>
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
    <details className="expand-card">
      <summary>{title}</summary>
      <div className="expand-body">{children}</div>
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
    <article className="metric-tile">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function SignalTile({
  label,
  signal
}: {
  label: string;
  signal: NonverbalAnalysis["eyeContact"];
}) {
  return (
    <article className={`signal-tile signal-${signal.status}`}>
      <p className="eyebrow">{label}</p>
      <strong>{signal.score}/10</strong>
      <span>{signal.note}</span>
    </article>
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
    <header className="simple-topbar">
      <div className="brand-lockup">
        <SmallDuckAvatar mood="neutral" />
        <div>
          <p className="brand-name">Ameego</p>
          <p className="brand-tag">{title}</p>
        </div>
      </div>
      <button className="ghost" onClick={onBack}>
        Back
      </button>
    </header>
  );
}

function SmallDuckAvatar({ mood }: { mood: BuddyMood }) {
  return (
    <div className="duck-mark" aria-hidden="true">
      <LargeDuckAvatar mood={mood} compact />
    </div>
  );
}

function LargeDuckAvatar({ mood, compact = false }: { mood: BuddyMood; compact?: boolean }) {
  return (
    <div className={`duck-asset${compact ? " compact" : ""}`} aria-hidden="true">
      <img alt="" className="duck-asset-image" src={buddyMoodAsset(mood)} />
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

function buildLearningPath(analysis: AnalysisResponse | null, recommendation: ModuleRecommendation | null): PathModule[] {
  if (!analysis || !recommendation) {
    return LEARNING_MODULES.map((module) => ({
      ...module,
      status: "locked",
      reason: "Complete one scored session to personalize this module."
    }));
  }

  const currentIndex = LEARNING_MODULES.findIndex((module) => module.id === recommendation.id);

  return LEARNING_MODULES.map((module, index) => {
    if (index === currentIndex) {
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
}): BuddyState {
  const { route, assessmentStage, practiceStage, status, error, analysis, selectedPrompt, recommendation } = input;

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
      headline: `${readinessScore(analysis.score)}/100 with one clear next move.`,
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
    case "record":
      return "Recording";
    case "review":
      return "Review";
    default:
      return "Prompt";
  }
}

function stageState(currentStage: PracticeStage, stage: PracticeStage) {
  const order: PracticeStage[] = ["prompt", "record", "review"];
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
    case "current":
      return "Current";
    case "up-next":
      return "Up next";
    default:
      return "Later";
  }
}

function averageNonverbalScore(nonverbal: NonverbalAnalysis) {
  const total = nonverbal.eyeContact.score + nonverbal.posturePresence.score + nonverbal.gestureActivity.score;
  return Number((total / 3).toFixed(1));
}

function buddyMoodAsset(mood: BuddyMood) {
  switch (mood) {
    case "attentive":
      return "/ameego-icons/ameego-thinking.svg";
    case "thinking":
      return "/ameego-icons/ameego-thinking.svg";
    case "celebrating":
      return "/ameego-icons/ameego-laughing.svg";
    case "concerned":
      return "/ameego-icons/ameego-worried.svg";
    case "encouraging":
      return "/ameego-icons/ameego-heart-eyes.svg";
    default:
      return "/ameego-icons/ameego-neutral.svg";
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

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredSession>;
  return isAnalysisResponse(candidate.analysis);
}
