const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type TranscriptSegment = {
  startSeconds?: number;
  endSeconds?: number;
  text?: string;
};

type TranscriptionPayload = {
  transcript: string;
  segments?: TranscriptSegment[];
};

type FeedbackPayload = {
  clarityScore: number;
  feedback: string[];
};

type NonverbalPayload = {
  eyeContact: {
    score: number;
    status: "needs-attention" | "steady" | "strong";
    note: string;
  };
  posturePresence: {
    score: number;
    status: "needs-attention" | "steady" | "strong";
    note: string;
  };
  gestureActivity: {
    score: number;
    status: "needs-attention" | "steady" | "strong";
    note: string;
  };
  feedback: string[];
};

export async function transcribeAudio(file: File) {
  const payload = await generateStructuredContent<TranscriptionPayload>({
    prompt: [
      "Generate a verbatim transcript of this speech recording.",
      "Return JSON only.",
      "Include a `transcript` string with the full transcript.",
      "Include a `segments` array with short utterance chunks and estimated `startSeconds`, `endSeconds`, and `text`.",
      "Use numeric seconds for timestamps.",
      "Do not summarize or add commentary."
    ].join("\n"),
    schema: {
      type: "OBJECT",
      properties: {
        transcript: { type: "STRING" },
        segments: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              startSeconds: { type: "NUMBER" },
              endSeconds: { type: "NUMBER" },
              text: { type: "STRING" }
            },
            required: ["startSeconds", "endSeconds", "text"]
          }
        }
      },
      required: ["transcript", "segments"]
    },
    file
  });

  return {
    transcript: payload.transcript?.trim() || "",
    durationSeconds: 0,
    segments: (payload.segments || []).map((segment) => ({
      start: typeof segment.startSeconds === "number" ? segment.startSeconds : undefined,
      end: typeof segment.endSeconds === "number" ? segment.endSeconds : undefined,
      text: segment.text?.trim() || ""
    }))
  };
}

export async function generateClarityFeedback(input: {
  transcript: string;
  durationSeconds: number;
  wpm: number;
  fillerCount: number;
  structureStatus: string;
}) {
  return generateStructuredContent<FeedbackPayload>({
    prompt: [
      "You are Ameego, a concise public speaking coach.",
      "Analyze this short speech for clarity and coachability.",
      `Transcript: ${input.transcript}`,
      `Duration seconds: ${input.durationSeconds.toFixed(1)}`,
      `Words per minute: ${input.wpm}`,
      `Filler count: ${input.fillerCount}`,
      `Structure status: ${input.structureStatus}`,
      "Return a clarityScore from 0 to 10 and 2-3 short actionable coaching notes.",
      "Use the supplied metrics and transcript only. Do not invent additional numeric measurements."
    ].join("\n"),
    schema: {
      type: "OBJECT",
      properties: {
        clarityScore: { type: "NUMBER" },
        feedback: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "STRING"
          }
        }
      },
      required: ["clarityScore", "feedback"]
    }
  });
}

export async function generateNonverbalFeedback(file: File) {
  const payload = await generateStructuredContent<NonverbalPayload>({
    prompt: [
      "You are Ameego, a concise formal speaking coach.",
      "Analyze only the visible nonverbal delivery in this short speaking video.",
      "Return JSON only.",
      "Rate these 3 signals only: eyeContact, posturePresence, gestureActivity.",
      "For each signal, return a score from 0 to 10, a status of `needs-attention`, `steady`, or `strong`, and one short coaching note.",
      "Return 2-3 short actionable feedback strings in `feedback`.",
      "Only judge what is visible in the clip. If the camera framing is limited, reflect that in the notes rather than inventing detail."
    ].join("\n"),
    schema: {
      type: "OBJECT",
      properties: {
        eyeContact: {
          type: "OBJECT",
          properties: {
            score: { type: "NUMBER" },
            status: { type: "STRING", enum: ["needs-attention", "steady", "strong"] },
            note: { type: "STRING" }
          },
          required: ["score", "status", "note"]
        },
        posturePresence: {
          type: "OBJECT",
          properties: {
            score: { type: "NUMBER" },
            status: { type: "STRING", enum: ["needs-attention", "steady", "strong"] },
            note: { type: "STRING" }
          },
          required: ["score", "status", "note"]
        },
        gestureActivity: {
          type: "OBJECT",
          properties: {
            score: { type: "NUMBER" },
            status: { type: "STRING", enum: ["needs-attention", "steady", "strong"] },
            note: { type: "STRING" }
          },
          required: ["score", "status", "note"]
        },
        feedback: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 3,
          items: {
            type: "STRING"
          }
        }
      },
      required: ["eyeContact", "posturePresence", "gestureActivity", "feedback"]
    },
    file
  });

  return {
    eyeContact: normalizeSignal(payload.eyeContact),
    posturePresence: normalizeSignal(payload.posturePresence),
    gestureActivity: normalizeSignal(payload.gestureActivity),
    feedback: (payload.feedback || []).slice(0, 3).map((item) => item.trim()).filter(Boolean)
  };
}

async function generateStructuredContent<T>(input: {
  prompt: string;
  schema: Record<string, unknown>;
  file?: File;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const model = input.file
    ? process.env.GEMINI_AUDIO_MODEL || "gemini-2.5-flash"
    : process.env.GEMINI_FEEDBACK_MODEL || "gemini-2.5-flash";

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];

  if (input.file) {
    parts.push({
      inline_data: {
        mime_type: input.file.type || "audio/webm",
        data: await fileToBase64(input.file)
      }
    });
  }

  const response = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generation_config: {
        response_mime_type: "application/json",
        response_schema: input.schema
      }
    })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Gemini request failed."));
  }

  const payload = await response.json();
  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new Error("Gemini response was empty.");
  }

  return JSON.parse(rawText) as T;
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

function normalizeSignal(signal: NonverbalPayload["eyeContact"]) {
  return {
    score: Number(Math.max(0, Math.min(10, signal.score)).toFixed(1)),
    status: signal.status,
    note: signal.note.trim()
  };
}

function extractOutputText(payload: any) {
  const candidates = payload?.candidates ?? [];
  const content = candidates.flatMap((candidate: any) => candidate?.content?.parts ?? []);
  const textPart = content.find((part: any) => typeof part?.text === "string" && part.text.length > 0);
  return textPart?.text ?? "";
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = await response.json();
    return payload?.error?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
