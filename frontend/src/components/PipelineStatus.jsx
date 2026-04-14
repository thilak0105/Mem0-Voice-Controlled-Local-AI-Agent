const STEP_LABELS = ["Audio", "Transcribe", "Classify", "Execute"];

const statusStyles = {
  pending: "bg-slate-600",
  active: "bg-accent animate-pulseBlue",
  done: "bg-emerald-500",
};

function PipelineStatus({ steps }) {
  return (
    <section className="card p-4">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-200">Pipeline Status</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEP_LABELS.map((label) => {
          const status = steps[label] || "pending";
          return (
            <div key={label} className="rounded-lg border border-border bg-bg p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusStyles[status]}`} />
                <span className="text-xs font-medium text-slate-300">{label}</span>
              </div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{status}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PipelineStatus;
