const STEP_LABELS = ["Audio", "Transcribe", "Classify", "Execute"];

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function DotIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}

function PipelineStatus({ steps }) {
  const stepStates = STEP_LABELS.map((label, index) => {
    const status = steps[label] || "pending";
    const prevStatus = index > 0 ? steps[STEP_LABELS[index - 1]] || "pending" : "pending";

    let lineState = "default";
    if (status === "done") lineState = "done";
    else if (status === "active" || prevStatus === "active") lineState = "active";
    else if (prevStatus === "done") lineState = "done";

    return { label, status, lineState };
  });

  return (
    <section className="panel-surface p-4">
      <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Pipeline Status</h2>
      <div className="flex items-start">
        {stepStates.map(({ label, status, lineState }, index) => {
          const isPending = status === "pending";
          const isActive = status === "active";
          const isDone = status === "done";

          return (
            <div key={label} className="flex flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`pipeline-node ${
                    isPending ? "pipeline-node--pending" : isActive ? "pipeline-node--active" : "pipeline-node--done"
                  }`}
                >
                  {isDone ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <DotIcon className={`h-3.5 w-3.5 ${isActive ? "text-[var(--accent-blue-light)]" : "text-[#7d8590]"}`} />
                  )}
                </div>
                <span className="mt-2 text-[11px] font-medium text-[var(--text-primary)]">{label}</span>
                <span
                  className={`mt-1 text-[10px] capitalize ${
                    isDone
                      ? "text-[var(--success-green)]"
                      : isActive
                        ? "text-[var(--accent-blue-light)]"
                        : "text-[var(--text-muted)]"
                  }`}
                >
                  {status === "active" ? "processing..." : status === "done" ? "done" : "waiting"}
                </span>
              </div>

              {index < stepStates.length - 1 ? (
                <div className="pipeline-connector-wrapper" aria-hidden="true">
                  <div className={`pipeline-connector pipeline-connector--${lineState}`} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PipelineStatus;
