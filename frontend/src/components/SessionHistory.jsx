import { useEffect, useState } from "react";

const API_BASE = "http://localhost:8000";

function truncate(text, maxLength = 62) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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
    <aside className="card flex h-full flex-col p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-200">Session History</h2>
      <div className="scrollbar-dark space-y-2 overflow-auto pr-1">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No actions yet.</p>
        ) : (
          history.map((item, index) => (
            <div key={`${item.timestamp || "item"}-${index}`} className="rounded-lg border border-border bg-bg p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-xs font-medium text-blue-300">
                  {item.intent || "general_chat"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "--:--"}
                </span>
              </div>
              <p className="text-xs text-slate-300">{truncate(item.transcription || "")}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default SessionHistory;
