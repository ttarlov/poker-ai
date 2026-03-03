"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function TicketForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { addTicket } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addTicket(title.trim(), description.trim());
    setTitle(""); setDescription(""); onClose();
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
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl animate-slide-up"
           style={{ background: "var(--bg)", border: "1px solid var(--border-medium)" }}>
        <div className="p-6">
          <h2 className="font-display text-xl mb-1" style={{ color: "var(--text-primary)" }}>Add Ticket</h2>
          <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
            Paste the ticket title and description for the team to point.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Add user authentication flow" autoFocus
                className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Description <span style={{ color: "var(--text-muted)" }}>(optional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Acceptance criteria, notes, context..." rows={4}
                className="w-full px-4 py-3 rounded-xl resize-none transition-all focus:outline-none"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "var(--input-focus-border)"}
                onBlur={e => e.target.style.borderColor = "var(--input-border)"} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl transition-all"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-medium)" }}>Cancel</button>
              <button type="submit" disabled={!title.trim()}
                className="flex-1 py-3 font-bold rounded-xl hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: `linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))`, color: "var(--btn-primary-text)" }}>
                Add to Queue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
