import { useEffect, useMemo, useRef, useState } from "react";

const intentBadgeClass = {
  pending: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
  create_file: "bg-[#1a2f1a] text-[#3fb950] border-[#2d6a2d]",
  write_code: "bg-[#1a2f52] text-[#58a6ff] border-[#1f6feb]",
  summarize: "bg-[#2d2208] text-[#d29922] border-[#7d4e0a]",
  run_code: "bg-[#2a1f52] text-[#a5a0ff] border-[#6e5bdb]",
  explain_code: "bg-[#1a2d2d] text-[#39c5ab] border-[#1a6b5e]",
  fix_code: "bg-[#2d1a1a] text-[#f85149] border-[#6e2a2a]",
  list_files: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
  search_web: "bg-[#2d1f0a] text-[#e3892b] border-[#7a4c0d]",
  general_chat: "bg-[#21262d] text-[#8b949e] border-[#30363d]",
};

function ChatIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 15a3 3 0 0 1-3 3H9l-5 4V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" />
    </svg>
  );
}

function TargetIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function CodeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m8 9-4 3 4 3" />
      <path d="m16 9 4 3-4 3" />
      <path d="m14 5-4 14" />
    </svg>
  );
}

function FileIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}

function LinkIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 1 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </svg>
  );
}

function CopyIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M7 15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function parseListItems(output) {
  return output
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)(?:\s+\((.*?)\))?$/);
      return {
        name: match?.[1] || item,
        meta: match?.[2] || "",
      };
    });
}

function parseSearchResults(output) {
  const entries = [];
  const lines = output.split("\n");
  let current = null;

  lines.forEach((line) => {
    const resultMatch = line.match(/^\s*(\d+)\.\s+(.*?)\s+-\s+(https?:\/\/\S+)\s*$/);
    if (resultMatch) {
      if (current) entries.push(current);
      current = {
        title: resultMatch[2],
        url: resultMatch[3],
        snippet: "",
      };
      return;
    }

    if (current && line.trim()) {
      current.snippet = current.snippet ? `${current.snippet} ${line.trim()}` : line.trim();
    }
  });

  if (current) entries.push(current);
  return entries.slice(0, 3);
};

function ResultCard({ transcription, intent, action, output, filename }) {
  const codeRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState("Copy");

  useEffect(() => {
    // Highlight output after each update when highlight.js is available.
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current);
    }
  }, [output]);

  useEffect(() => {
    setCopyLabel("Copy");
  }, [transcription]);

  const badgeClass = intentBadgeClass[intent || "pending"] || intentBadgeClass.general_chat;

  const isCodeOutput = intent === "write_code" || intent === "fix_code";
  const isListOutput = intent === "list_files";
  const isSearchOutput = intent === "search_web";

  const listItems = useMemo(() => (isListOutput ? parseListItems(output || "") : []), [isListOutput, output]);
  const searchResults = useMemo(() => (isSearchOutput ? parseSearchResults(output || "") : []), [isSearchOutput, output]);

  async function handleCopy() {
    if (!transcription) return;
    await navigator.clipboard.writeText(transcription);
    setCopyLabel("Copied!");
    window.setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  function renderContent() {
    if (!output) {
      return <p className="result-empty">No output yet.</p>;
    }

    if (isCodeOutput) {
      return (
        <pre className="result-code overflow-auto">
          <code ref={codeRef} className="language-python">
            {output}
          </code>
        </pre>
      );
    }

    if (isListOutput) {
      return (
        <div className="space-y-2">
          {listItems.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex items-start gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2">
              <FileIcon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-[var(--text-primary)]">{item.name}</p>
                {item.meta ? <p className="text-[11px] text-[var(--text-muted)]">{item.meta}</p> : null}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (isSearchOutput) {
      return (
        <div className="space-y-3">
          {searchResults.map((item, index) => (
            <article key={`${item.title}-${index}`} className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-3">
              <div className="mb-1 flex items-start gap-2">
                <LinkIcon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent-blue-light)]" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</p>
                  <a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-[var(--accent-blue-light)] hover:text-white">
                    {item.url}
                  </a>
                </div>
              </div>
              {item.snippet ? <p className="pl-5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.snippet}</p> : null}
            </article>
          ))}
        </div>
      );
    }

    return <p className="result-text">{output}</p>;
  }

  return (
    <section className="result-grid scrollbar-dark">
      <article className="result-card fade-in">
        <div className="result-card__header">
          <div className="result-card__label"><ChatIcon className="h-3 w-3" /> <span>Transcription</span></div>
          <button type="button" onClick={handleCopy} className="result-copy-button">
            <CopyIcon className="h-3.5 w-3.5" /> <span>{copyLabel}</span>
          </button>
        </div>
        <div className="result-card__content">
          <p className={transcription ? "result-text" : "result-empty"}>{transcription || "Waiting for transcription..."}</p>
        </div>
      </article>

      <article className="result-card fade-in">
        <div className="result-card__header">
          <div className="result-card__label"><TargetIcon className="h-3 w-3" /> <span>Detected Intent</span></div>
        </div>
        <div className="result-card__content">
          <div className={`intent-badge ${badgeClass}`}>{intent || "pending"}</div>
          {filename ? <p className="mt-2 text-[11px] text-[var(--text-muted)]">{filename}</p> : null}
        </div>
      </article>

      <article className="result-card fade-in">
        <div className="result-card__header">
          <div className="result-card__label"><CheckIcon className="h-3 w-3" /> <span>Action Taken</span></div>
        </div>
        <div className="result-card__content">
          <p className={action ? "result-text" : "result-empty"}>{action || "No action yet."}</p>
        </div>
      </article>

      <article className="result-card result-card--output fade-in">
        <div className="result-card__header">
          <div className="result-card__label"><CodeIcon className="h-3 w-3" /> <span>Output / Result</span></div>
        </div>
        <div className="result-card__content">
          {renderContent()}
        </div>
      </article>
    </section>
  );
}

export default ResultCard;
