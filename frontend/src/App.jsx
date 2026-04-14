import { useEffect, useMemo, useState } from "react";
import AudioInput from "./components/AudioInput";
import PipelineStatus from "./components/PipelineStatus";
import ResultCard from "./components/ResultCard";
import SessionHistory from "./components/SessionHistory";

const API_BASE = "http://localhost:8000";

const initialSteps = {
  Audio: "pending",
  Transcribe: "pending",
  Classify: "pending",
  Execute: "pending",
};

function App() {
  const [steps, setSteps] = useState(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [health, setHealth] = useState({ ollama_reachable: false, model_available: false });
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [result, setResult] = useState({
    transcription: "",
    intent: "",
    action: "",
    output: "",
  });

  const ollamaOnline = useMemo(
    () => health.ollama_reachable && health.model_available,
    [health]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchHealth() {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!ignore) {
          setHealth(data);
        }
      } catch {
        if (!ignore) {
          setHealth({ ollama_reachable: false, model_available: false });
        }
      }
    }

    fetchHealth();
    const timer = setInterval(fetchHealth, 8000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  function updateStepState(stage, payload) {
    if (stage === "transcribing") {
      setSteps({ Audio: "done", Transcribe: "active", Classify: "pending", Execute: "pending" });
      return;
    }

    if (stage === "classifying") {
      setSteps({ Audio: "done", Transcribe: "done", Classify: "active", Execute: "pending" });
      setResult((prev) => ({ ...prev, transcription: payload.transcription || prev.transcription }));
      return;
    }

    if (stage === "executing") {
      setSteps({ Audio: "done", Transcribe: "done", Classify: "done", Execute: "active" });
      setResult((prev) => ({ ...prev, intent: payload.intent || prev.intent }));
      return;
    }

    if (stage === "done") {
      setSteps({ Audio: "done", Transcribe: "done", Classify: "done", Execute: "done" });
      const doneResult = payload.result || {};
      setResult((prev) => ({
        ...prev,
        intent: doneResult.intent || prev.intent,
        action: doneResult.action_taken || "Completed",
        output: doneResult.output || "",
      }));
      setHistoryRefreshToken((value) => value + 1);
    }
  }

  async function runAgent(file) {
    setIsRunning(true);
    setSteps({ Audio: "active", Transcribe: "pending", Classify: "pending", Execute: "pending" });
    setResult({ transcription: "", intent: "", action: "", output: "" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/agent`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error("Agent request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventChunk of events) {
          const line = eventChunk
            .split("\n")
            .find((entry) => entry.startsWith("data:"));

          if (!line) continue;

          const jsonText = line.replace(/^data:\s*/, "").trim();
          if (!jsonText) continue;

          try {
            const payload = JSON.parse(jsonText);
            updateStepState(payload.stage, payload);
          } catch {
            // Ignore malformed chunks while continuing stream processing.
          }
        }
      }
    } catch (error) {
      setSteps({ Audio: "done", Transcribe: "done", Classify: "done", Execute: "done" });
      setResult({
        transcription: "",
        intent: "general_chat",
        action: "Pipeline failed",
        output: error.message || "Unknown error",
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 md:px-8">
      <header className="mx-auto mb-6 flex w-full max-w-7xl items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Voice-Controlled Local AI Agent</h1>
          <p className="text-xs text-slate-400">FastAPI + Whisper + Ollama</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              ollamaOnline ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span>{ollamaOnline ? "Ollama Online" : "Ollama Offline"}</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-2">
          <AudioInput onRunAgent={runAgent} isRunning={isRunning} />
          <div className="h-[340px]">
            <SessionHistory refreshToken={historyRefreshToken} />
          </div>
        </section>

        <section className="space-y-4 lg:col-span-3">
          <PipelineStatus steps={steps} />
          <ResultCard
            transcription={result.transcription}
            intent={result.intent}
            action={result.action}
            output={result.output}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
