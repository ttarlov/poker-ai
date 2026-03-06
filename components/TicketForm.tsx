"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function TicketForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState("");
  const [jiraLoaded, setJiraLoaded] = useState(false);
  const [jiraSummary, setJiraSummary] = useState<string | null>(null);
  const [jiraIssueType, setJiraIssueType] = useState<string | null>(null);
  const [jiraPriority, setJiraPriority] = useState<string | null>(null);
  const [jiraAssignee, setJiraAssignee] = useState<string | null>(null);
  const [jiraUrl, setJiraUrl] = useState<string | null>(null);
  const [fullDescription, setFullDescription] = useState("");
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [mode, setMode] = useState<"manual" | "jira">("manual");
  const { addTicket, cacheJiraData } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (jiraLoaded) {
      await addTicket({
        title: title.trim(),
        description: "",
        jiraKey: jiraKey.trim().toUpperCase(),
        externalUrl: jiraUrl || undefined,
      });
    } else {
      await addTicket({
        title: title.trim(),
        description: description.trim(),
      });
    }

    setTitle(""); setDescription(""); onClose();
  };

  const handleJiraLoad = async () => {
    const key = jiraKey.trim().toUpperCase();
    if (!key) { setJiraError("Enter a ticket key"); return; }
    setJiraError("");
    setJiraLoading(true);
    setJiraLoaded(false);
    setShowFullDesc(false);

    try {
      const res = await fetch("/api/jira/" + encodeURIComponent(key));
      const data = await res.json();

      if (!res.ok) {
        setJiraError(data.error || "Failed to load ticket");
        setJiraLoading(false);
        return;
      }

      cacheJiraData(data);

      setJiraLoaded(true);
      setTitle(data.key + ": " + data.title);
      setJiraSummary(data.summary || null);
      setJiraIssueType(data.issueType);
      setJiraPriority(data.priority);
      setJiraAssignee(data.assignee);
      setJiraUrl(data.url);
      setFullDescription(data.description || "");
      setDescription(data.summary || data.description || "");
      setJiraLoading(false);
    } catch (err) {
      setJiraError("Failed to connect — check your network");
      setJiraLoading(false);
    }
  };

  const handleJiraKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJiraLoad();
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm"
           style={{ background: "var(--overlay-bg)" }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]"
           style={{ background: "var(--bg)", border: "1px solid var(--border-medium)" }}>
        <div className="p-6">
          <h2 className="font-display text-xl mb-1" style={{ color: "var(--text-primary)" }}>Add Ticket</h2>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-5 mt-3">
            <button
              type="button"
              onClick={() => { setMode("manual"); setJiraError(""); setJiraLoaded(false); }}
              className="px-3 py-1.5 text-sm rounded-lg transition-all"
              style={{
                background: mode === "manual" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
                color: mode === "manual" ? "var(--accent)" : "var(--text-muted)",
                border: mode === "manual" ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--border-subtle)",
              }}>
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => { setMode("jira"); setJiraError(""); }}
              className="px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5"
              style={{
                background: mode === "jira" ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "transparent",
                color: mode === "jira" ? "var(--accent)" : "var(--text-muted)",
                border: mode === "jira" ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--border-subtle)",
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84c0-.46-.38-.84-.84-.84H11.53zM6.77 6.8c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V7.64c0-.46-.38-.84-.84-.84H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V12.44c0-.46-.38-.84-.84-.84H2z"/>
              </svg>
              Load from Jira
            </button>
          </div>

          {/* Jira Loader */}
          {mode === "jira" && (
            <div className="mb-4">
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Jira Ticket Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={jiraKey}
                  onChange={e => setJiraKey(e.target.value.toUpperCase())}
                  onKeyDown={handleJiraKeyDown}
                  placeholder="e.g. ENG-1234"
                  className="flex-1 px-4 py-3 rounded-xl font-mono transition-all focus:outline-none uppercase"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleJiraLoad}
                  disabled={jiraLoading || !jiraKey.trim()}
                  className="px-4 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))",
                    color: "var(--btn-primary-text)",
                  }}>
                  {jiraLoading ? "Loading..." : "Fetch"}
                </button>
              </div>
              {jiraError && (
                <p className="text-sm mt-2" style={{ color: "var(--red-suit, #ef4444)" }}>{jiraError}</p>
              )}
              {jiraLoaded && (
                <div className="mt-3 rounded-xl text-sm" style={{ background: "color-mix(in srgb, var(--status-active) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--status-active) 30%, transparent)" }}>
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--status-active)" }}>✓</span>
                      <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>{jiraKey.toUpperCase()}</span>
                      {jiraIssueType && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
                          {jiraIssueType}
                        </span>
                      )}
                      {jiraPriority && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{jiraPriority}</span>
                      )}
                    </div>
                    <p style={{ color: "var(--text-primary)" }}>{title}</p>
                    {jiraAssignee && (
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Assigned to {jiraAssignee}</p>
                    )}
                  </div>

                  {/* Poker Summary — scrollable */}
                  {jiraSummary && (
                    <div className="px-3 pb-3 pt-1" style={{ borderTop: "1px solid color-mix(in srgb, var(--status-active) 20%, transparent)" }}>
                      <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>📋 Poker Summary</span>
                      <div className="mt-1 max-h-28 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-medium) transparent" }}>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{jiraSummary}</p>
                      </div>
                    </div>
                  )}

                  {/* Full description — expandable and scrollable */}
                  {fullDescription && (
                    <div className="px-3 pb-3">
                      <button
                        type="button"
                        onClick={() => setShowFullDesc(!showFullDesc)}
                        className="text-xs transition-all"
                        style={{ color: "var(--text-muted)" }}>
                        {showFullDesc ? "▲ Hide full description" : "▼ Show full Jira description"}
                      </button>
                      {showFullDesc && (
                        <div className="mt-2 max-h-40 overflow-y-auto p-2 rounded-lg pr-1"
                             style={{ background: "color-mix(in srgb, var(--bg-dark) 50%, transparent)", scrollbarWidth: "thin", scrollbarColor: "var(--border-medium) transparent" }}>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
                            {fullDescription}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title + Description form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder={mode === "jira" ? "Auto-filled from Jira" : "e.g. Add user authentication flow"}
                autoFocus={mode === "manual"}
                className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }} />
            </div>
            {!jiraLoaded && (
              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Description <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Acceptance criteria, notes, context..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl resize-none transition-all focus:outline-none"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }} />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl transition-all"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-medium)" }}>Cancel</button>
              <button type="submit" disabled={!title.trim()}
                className="flex-1 py-3 font-bold rounded-xl hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
                Add to Queue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
