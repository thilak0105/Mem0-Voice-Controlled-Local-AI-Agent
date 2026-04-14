import { useEffect, useMemo, useRef, useState } from "react";
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
  const [processingInfo, setProcessingInfo] = useState("");
  const [toasts, setToasts] = useState([]);
  const [result, setResult] = useState({
    transcription: "",
    intent: "",
    action: "",
    output: "",
    filename: "",
  });
  const startedAtRef = useRef(0);
  const toastIdRef = useRef(0);

  const ollamaOnline = useMemo(
    () => health.ollama_reachable && health.model_available,
    [health]
  );

  const statusText = ollamaOnline
    ? "Ollama online · llama3.2:3b"
    : "Ollama offline — run ollama serve";

  function addToast(type, message) {
    const id = ++toastIdRef.current;
    const toast = { id, type, message };
    setToasts((current) => [toast, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3000);
  }

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
        filename: doneResult.filename || prev.filename,
      }));
      const durationSeconds = startedAtRef.current ? ((Date.now() - startedAtRef.current) / 1000).toFixed(1) : "0.0";
      setProcessingInfo(`Completed in ${durationSeconds}s · whisper:small · llama3.2:3b`);
      if (doneResult.success && doneResult.intent === "create_file") {
        addToast("success", doneResult.action_taken || "File created successfully");
      }
      if (doneResult.success && doneResult.intent === "run_code") {
        addToast("info", `Using most recent file: ${doneResult.filename || "output file"}`);
      }
      setHistoryRefreshToken((value) => value + 1);
    }
  }

  async function runAgent(file) {
    setIsRunning(true);
    startedAtRef.current = Date.now();
    setProcessingInfo("");
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
        filename: "",
      });
      addToast("error", "Transcription failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
              <path d="M19 12a7 7 0 0 1-14 0" />
              <path d="M12 19v3" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Voice AI Agent</h1>
            <p className="text-[11px] text-[var(--text-muted)]">FastAPI · Whisper · LLaMA 3.2:3b</p>
          </div>
        </div>
        <div className={`status-pill ${ollamaOnline ? "status-pill--online" : "status-pill--offline"}`}>
          <span className={`status-pill__dot ${ollamaOnline ? "bg-[var(--success-green)]" : "bg-[var(--danger-red)]"}`} />
          <span>{statusText}</span>
        </div>
      </header>

      <main className="app-main">
        <aside className="app-sidebar scrollbar-dark">
          <AudioInput onRunAgent={runAgent} isRunning={isRunning} />
          <div className="flex-1 min-h-[180px]">
            <SessionHistory refreshToken={historyRefreshToken} />
          </div>
        </aside>

        <section className="app-content scrollbar-dark">
          <PipelineStatus steps={steps} />
          <ResultCard
            transcription={result.transcription}
            intent={result.intent}
            action={result.action}
            output={result.output}
            filename={result.filename}
          />
          <div className="pt-2 text-[11px] text-[var(--text-muted)]">{processingInfo || "Completed in 0.0s · whisper:small · llama3.2:3b"}</div>
        </section>
      </main>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span className="toast__dot" />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
