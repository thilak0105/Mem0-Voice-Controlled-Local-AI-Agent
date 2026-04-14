import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

const intentDotClass = {
  create_file: "bg-[#3fb950]",
  write_code: "bg-[#58a6ff]",
  summarize: "bg-[#d29922]",
  run_code: "bg-[#a5a0ff]",
  explain_code: "bg-[#39c5ab]",
  fix_code: "bg-[#f85149]",
  list_files: "bg-[#8b949e]",
  search_web: "bg-[#e3892b]",
  general_chat: "bg-[#8b949e]",
};

function truncate(text, maxLength = 52) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "just now";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 60) return diffSeconds <= 5 ? "just now" : `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function SessionHistory({ refreshToken }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let ignore = false;

    async function fetchHistory() {
      try {
        const response = await fetch(`${API_BASE}/history`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!ignore && Array.isArray(data)) {
          setHistory(data.slice().reverse());
        }
      } catch {
        // Keep the existing list when history fetch fails.
      }
    }

    fetchHistory();
    const timer = setInterval(fetchHistory, 8000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [refreshToken]);

  return (
    <aside className="panel-surface flex h-full flex-col p-4">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Session History</h2>
      <div className="scrollbar-dark min-h-0 flex-1 overflow-auto pr-1">
        {history.length === 0 ? (
          <p className="flex h-full items-center justify-center text-[12px] text-[var(--text-muted)]">No actions yet.</p>
        ) : (
          history.slice(0, 5).map((item, index) => (
            <div key={`${item.timestamp || "item"}-${index}`} className="flex items-start gap-3 border-b border-[var(--border-default)] py-3 last:border-b-0">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${intentDotClass[item.intent] || intentDotClass.general_chat}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-[var(--text-secondary)]">{truncate(item.transcription || "")}</p>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default SessionHistory;
