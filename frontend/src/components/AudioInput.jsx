import { useEffect, useMemo, useRef, useState } from "react";

function MicIcon({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 12a7 7 0 0 1-14 0" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

function StopIcon({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function UploadIcon({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5-5 5 5" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CloseIcon({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(size) {
  if (!size) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function AudioInput({ onRunAgent, isRunning }) {
  const [activeTab, setActiveTab] = useState("mic");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const audioPreviewUrl = useMemo(() => {
    if (activeTab === "mic" && recordedBlob) {
      return URL.createObjectURL(recordedBlob);
    }
    if (activeTab === "file" && uploadedFile) {
      return URL.createObjectURL(uploadedFile);
    }
    return "";
  }, [activeTab, recordedBlob, uploadedFile]);

  const selectedFile = activeTab === "file" ? uploadedFile : null;
  const hasMicAudio = activeTab === "mic" && recordedBlob;
  const canRun = activeTab === "mic" ? Boolean(recordedBlob) : Boolean(uploadedFile);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRecordSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  useEffect(() => {
    if (!recordedBlob) {
      setRecordSeconds(0);
    }
  }, [recordedBlob]);

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
      setRecordSeconds(0);
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

  function clearRecordedAudio() {
    setRecordedBlob(null);
    setRecordSeconds(0);
  }

  function clearUploadedFile() {
    setUploadedFile(null);
  }

  function handleKeyDown(event) {
    if (activeTab !== "mic") return;
    if (event.code !== "Space" || event.repeat) return;
    const target = event.target;
    const focusedTag = target?.tagName?.toLowerCase();
    if (["input", "textarea", "button", "select"].includes(focusedTag)) return;
    event.preventDefault();
    if (isRecording) {
      stopRecording();
      return;
    }
    if (!isRunning) {
      startRecording();
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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

  const waveformBars = useMemo(
    () => [8, 16, 24, 32, 40, 28, 18, 34, 14, 30, 22, 38],
    []
  );

  return (
    <section className="panel-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--text-primary)]">Audio Input</h2>
          <p className="text-[11px] text-[var(--text-secondary)]">Record a new clip or upload an existing file.</p>
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">Space to record</span>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("mic")}
            className={`rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              activeTab === "mic"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[#7d8590]"
            }`}
          >
            Mic Record
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
              activeTab === "file"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                : "text-[#7d8590]"
            }`}
          >
            File Upload
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-[220px]">
        {activeTab === "mic" ? (
          <div
            className={`flex min-h-[220px] flex-col items-center text-center ${
              hasMicAudio && !isRecording ? "justify-start pt-2" : "justify-center"
            }`}
          >
            {!hasMicAudio && !isRecording ? (
              <>
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] text-[#7d8590]">
                  <MicIcon className="h-8 w-8" />
                </div>
                <p className="text-[13px] text-[var(--text-secondary)]">Click to start recording</p>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRunning}
                  className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-blue)] text-white shadow-[0_0_0_1px_rgba(31,111,235,0.2)] transition-colors hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Start recording"
                >
                  <MicIcon className="h-7 w-7" stroke="#ffffff" />
                </button>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">Space to record</p>
              </>
            ) : null}

            {isRecording ? (
              <>
                <div className="mb-5 flex h-24 items-end justify-center gap-1.5">
                  {waveformBars.map((height, index) => (
                    <span
                      key={`wave-${index}`}
                      className="wave-bar"
                      style={{ height: `${height}px`, animationDelay: `${index * 45}ms` }}
                    />
                  ))}
                </div>
                <div className="text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatDuration(recordSeconds)}
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Recording... click to stop</p>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-red)] text-white recording-stop-ring transition-colors hover:opacity-95"
                  aria-label="Stop recording"
                >
                  <StopIcon className="h-7 w-7" stroke="#ffffff" />
                </button>
              </>
            ) : null}

            {hasMicAudio && !isRecording ? (
              <div className="w-full">
                <audio controls src={audioPreviewUrl} className="voice-audio mt-2 w-full" />
                <p className="mt-3 text-[13px] font-medium text-[var(--success-green)]">Ready to process</p>
                <button type="button" onClick={clearRecordedAudio} className="mt-2 text-[12px] text-[var(--accent-blue-light)] hover:text-white">
                  Re-record
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col justify-center">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                onFileSelect(event.dataTransfer.files?.[0] || null);
              }}
              className={`rounded-lg border border-dashed p-8 text-center transition-colors ${
                isDragOver
                  ? "border-[var(--accent-blue)] bg-[#0f1622]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              }`}
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)]">
                <UploadIcon className="h-6 w-6" />
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">Drop .wav or .mp3 here</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">or click to browse</p>
              <label className="mt-4 inline-flex cursor-pointer items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]">
                Choose File
                <input
                  type="file"
                  accept=".wav,.mp3,audio/wav,audio/mpeg"
                  className="hidden"
                  onChange={(event) => onFileSelect(event.target.files?.[0] || null)}
                />
              </label>

              {selectedFile ? (
                <div className="mt-5 flex items-center justify-between rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-left">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{selectedFile.name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearUploadedFile}
                    className="ml-3 rounded-full p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
                    aria-label="Remove file"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {audioPreviewUrl ? <audio controls src={audioPreviewUrl} className="voice-audio mt-4 w-full" /> : null}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning || !canRun}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-blue)] text-[14px] font-semibold text-white transition-colors hover:bg-[#388bfd] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Spinner />
            <span>Processing...</span>
          </>
        ) : (
          <span>Run Agent →</span>
        )}
      </button>
    </section>
  );
}

export default AudioInput;
