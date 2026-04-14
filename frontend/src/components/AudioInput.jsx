import { useMemo, useRef, useState } from "react";

function AudioInput({ onRunAgent, isRunning }) {
  const [activeTab, setActiveTab] = useState("mic");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const audioPreviewUrl = useMemo(() => {
    if (activeTab === "mic" && recordedBlob) {
      return URL.createObjectURL(recordedBlob);
    }
    if (activeTab === "file" && uploadedFile) {
      return URL.createObjectURL(uploadedFile);
    }
    return "";
  }, [activeTab, recordedBlob, uploadedFile]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone access failed. Please allow mic permissions and try again.");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) {
      return;
    }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }

  function onFileSelect(file) {
    if (!file) return;
    const allowed = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"];
    if (!allowed.includes(file.type)) {
      alert("Please upload a WAV or MP3 file.");
      return;
    }
    setUploadedFile(file);
  }

  async function handleRun() {
    if (isRunning) return;

    if (activeTab === "mic") {
      if (!recordedBlob) {
        alert("Please record and stop audio first.");
        return;
      }
      const file = new File([recordedBlob], "recording.webm", { type: "audio/webm" });
      await onRunAgent(file);
      return;
    }

    if (!uploadedFile) {
      alert("Please upload an audio file first.");
      return;
    }
    await onRunAgent(uploadedFile);
  }

  return (
    <section className="card p-4">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-200">Audio Input</h2>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("mic")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "mic"
              ? "bg-accent text-white"
              : "border border-border bg-bg text-slate-300"
          }`}
        >
          Mic Recording
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("file")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "file"
              ? "bg-accent text-white"
              : "border border-border bg-bg text-slate-300"
          }`}
        >
          File Upload
        </button>
      </div>

      {activeTab === "mic" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startRecording}
              disabled={isRecording}
              className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
                isRecording
                  ? "bg-red-500 animate-pulseRed cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {isRecording ? "Recording..." : "Start Recording"}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={!isRecording}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Stop
            </button>
          </div>

          {audioPreviewUrl && (
            <audio controls src={audioPreviewUrl} className="w-full" />
          )}
        </div>
      ) : (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onFileSelect(event.dataTransfer.files?.[0] || null);
          }}
          className="rounded-lg border border-dashed border-border bg-bg p-5 text-center"
        >
          <p className="mb-2 text-sm text-slate-300">Drag and drop WAV/MP3 here</p>
          <p className="mb-3 text-xs text-slate-400">or</p>
          <label className="inline-flex cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
            Choose File
            <input
              type="file"
              accept=".wav,.mp3,audio/wav,audio/mpeg"
              className="hidden"
              onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
            />
          </label>
          {uploadedFile ? (
            <p className="mt-3 text-xs text-slate-300">Selected: {uploadedFile.name}</p>
          ) : null}
          {audioPreviewUrl && (
            <audio controls src={audioPreviewUrl} className="mt-3 w-full" />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning}
        className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? "Running Agent..." : "Run Agent"}
      </button>
    </section>
  );
}

export default AudioInput;
