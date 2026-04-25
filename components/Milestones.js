"use client";

import { useState } from "react";

const parseLocal = (d) => {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
};

const toKey = (d) => {
  const date = parseLocal(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatDate = (d) =>
  parseLocal(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

const todayKey = () => toKey(new Date());

const daysUntil = (dueDate) => {
  const today = parseLocal(todayKey());
  const due = parseLocal(dueDate);
  return Math.ceil((due - today) / 86400000);
};

const ALERT_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 14, label: "14 days" },
  { value: 7, label: "7 days" },
  { value: 3, label: "3 days" },
  { value: 1, label: "1 day" },
  { value: 0, label: "Day of" },
];

export default function Milestones({ reminders = [], onAdd, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedAlerts, setSelectedAlerts] = useState([14, 7, 1]);
  const [expandedReminder, setExpandedReminder] = useState(null);

  const activeReminders = reminders.filter((r) => !r.done);
  const doneReminders = reminders.filter((r) => r.done);

  // Sort by due date, soonest first
  const sortedActive = [...activeReminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Upcoming within 14 days
  const upcoming = sortedActive.filter((r) => {
    const days = daysUntil(r.dueDate);
    return days >= 0 && days <= 14;
  });

  const toggleAlert = (val) => {
    setSelectedAlerts((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val].sort((a, b) => b - a)
    );
  };

  const handleAdd = () => {
    if (!title.trim() || !dueDate) return;
    onAdd(title.trim(), dueDate, selectedAlerts.length > 0 ? selectedAlerts : [7, 1], notes.trim());
    setTitle(""); setDueDate(""); setNotes(""); setSelectedAlerts([14, 7, 1]); setShowForm(false);
  };

  const getUrgencyColor = (days) => {
    if (days < 0) return "#c44";
    if (days <= 1) return "#ef4444";
    if (days <= 3) return "#f97316";
    if (days <= 7) return "#E8C547";
    return "#888";
  };

  const getUrgencyLabel = (days) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days}d away`;
  };

  // Collapsed mini view
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all hover:border-neutral-600 mb-4"
        style={{ background: "#0a0a0a", borderColor: upcoming.length > 0 ? "#E8C54744" : "#1a1a1a" }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={upcoming.length > 0 ? "#E8C547" : "#444"} strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          <span className="text-xs text-neutral-400 font-medium">Milestones</span>
        </div>
        <div className="flex items-center gap-2">
          {upcoming.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: getUrgencyColor(daysUntil(upcoming[0].dueDate)) }}>
              {upcoming[0].title.length > 20 ? upcoming[0].title.slice(0, 20) + "..." : upcoming[0].title} &bull; {getUrgencyLabel(daysUntil(upcoming[0].dueDate))}
            </span>
          )}
          <span className="text-[10px] text-neutral-600 font-mono">{activeReminders.length}</span>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border p-4 mb-4 transition-all" style={{ background: "#0f0f0f", borderColor: "#1a1a1a" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#E8C547" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          <span className="text-sm font-semibold text-neutral-300">Milestones</span>
          <span className="text-[10px] text-neutral-600 font-mono">{activeReminders.length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(!showForm)}
            className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded px-2 py-0.5 hover:text-neutral-300 transition-colors">
            {showForm ? "Cancel" : "+ New"}
          </button>
          <button onClick={() => setExpanded(false)}
            className="text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none px-1">&minus;</button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mb-4 p-3 bg-surface border border-surface-4 rounded-xl animate-slide-down">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Milestone title..."
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors mb-2" />
          
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)..."
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-3 py-1.5 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500 resize-none transition-colors mb-2"
            rows={2} />

          <div className="flex gap-2 items-center mb-3">
            <label className="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0">Due</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 bg-surface-1 border border-surface-4 rounded-md px-2.5 py-1.5 text-xs text-neutral-300 font-mono outline-none"
              style={{ colorScheme: "dark" }} />
          </div>

          <div className="mb-3">
            <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1.5">Notify me</label>
            <div className="flex gap-1.5 flex-wrap">
              {ALERT_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => toggleAlert(opt.value)}
                  className="px-2 py-1 text-[10px] rounded-md border font-medium transition-all"
                  style={{
                    background: selectedAlerts.includes(opt.value) ? "#E8C547" : "#1a1a1a",
                    color: selectedAlerts.includes(opt.value) ? "#000" : "#888",
                    borderColor: selectedAlerts.includes(opt.value) ? "#E8C547" : "#222",
                  }}>
                  {opt.label} before
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleAdd}
            disabled={!title.trim() || !dueDate}
            className="w-full py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: title.trim() && dueDate ? "#E8C547" : "#222",
              color: title.trim() && dueDate ? "#000" : "#555",
            }}>
            Add Milestone
          </button>
        </div>
      )}

      {/* Active Reminders */}
      {sortedActive.length === 0 && !showForm && (
        <p className="text-xs text-neutral-600 text-center py-4">No milestones set. Add one to track upcoming deadlines.</p>
      )}

      <div className="flex flex-col gap-1">
        {sortedActive.map((r) => {
          const days = daysUntil(r.dueDate);
          const isExpanded = expandedReminder === r.id;
          const urgencyColor = getUrgencyColor(days);
          return (
            <div key={r.id} className="rounded-lg transition-all" style={{ background: isExpanded ? "#111" : "transparent" }}>
              <div className="flex items-center gap-2.5 px-2 py-2 cursor-pointer" onClick={() => setExpandedReminder(isExpanded ? null : r.id)}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: urgencyColor }} />
                <span className="flex-1 text-sm text-neutral-300 truncate">{r.title}</span>
                <span className="text-[10px] font-mono shrink-0" style={{ color: urgencyColor }}>
                  {getUrgencyLabel(days)}
                </span>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-0">
                  <div className="ml-4 mb-2">
                    <span className="text-[10px] text-neutral-600 font-mono block mb-1">{formatDate(r.dueDate)}</span>
                    {r.notes && <p className="text-xs text-neutral-500 leading-snug mb-2">{r.notes}</p>}
                    <div className="flex gap-1 flex-wrap mb-2">
                      {(r.alertDays || []).sort((a, b) => b - a).map((d) => (
                        <span key={d} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-neutral-500">
                          {d === 0 ? "Day of" : `${d}d before`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button onClick={() => onUpdate(r.id, { done: true })}
                      className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded px-2 py-0.5 hover:text-gold hover:border-gold-border transition-colors">
                      Complete
                    </button>
                    <button onClick={() => onDelete(r.id)}
                      className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded px-2 py-0.5 hover:text-red-400 hover:border-red-900 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completed (collapsed) */}
      {doneReminders.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-3">
          <span className="text-[10px] text-neutral-600 font-mono">{doneReminders.length} completed</span>
        </div>
      )}
    </div>
  );
}
