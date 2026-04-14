import { useEffect, useRef } from "react";

const intentBadgeClass = {
  create_file: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  write_code: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  summarize: "bg-teal-500/20 text-teal-300 border-teal-500/40",
  general_chat: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

function ResultCard({ transcription, intent, action, output }) {
  const codeRef = useRef(null);

  useEffect(() => {
    // Highlight output after each update when highlight.js is available.
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current);
    }
  }, [output]);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Transcribed Text</h3>
        <p className="text-sm text-slate-300">{transcription || "Waiting for transcription..."}</p>
      </article>

      <article className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Detected Intent</h3>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            intentBadgeClass[intent] || intentBadgeClass.general_chat
          }`}
        >
          {intent || "pending"}
        </span>
      </article>

      <article className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Action Taken</h3>
        <p className="text-sm text-slate-300">{action || "No action yet."}</p>
      </article>

      <article className="card p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Final Output</h3>
        <pre className="scrollbar-dark max-h-72 overflow-auto rounded-lg border border-border bg-bg p-3">
          <code ref={codeRef} className="language-python code-block">
            {output || "No output yet."}
          </code>
        </pre>
      </article>
    </section>
  );
}

export default ResultCard;
