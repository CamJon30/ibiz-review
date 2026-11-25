"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { getCycleWeek } from "@/lib/cycle";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Christian Xavier Hospitality Group, Cycle 1.
// Number metrics: green at/above `green`, yellow at/above `yellow`, red below.
// Select metrics: `statusMap` turns each saved value into green / yellow / red / gray (gray is not scored).
// `startWeek`: before that cycle week a low number is not scored (only a hit shows green).
const METRICS = {
  partner_outreach_count: { label: "Partner & lounge outreach touches", type: "number", green: 1, yellow: 0.5, note: "Target: 1–2 per week (D'Floridian + lounge owners)" },
  followup_status:        { label: "Follow-ups sent to warm contacts", type: "select", note: "All sent / Some missed / None due",
                            statusMap: { all: "green", some: "yellow", none: "gray" } },   // "none" = None due, not scored
  building_distracted:    { label: "Did tinkering or coding distract from hospitality & discovery?", type: "select", note: "No / A little / Yes significantly",
                            statusMap: { no: "green", little: "yellow", yes: "red" } },
  mom_test_count:         { label: "Mom Test discovery conversations completed", type: "number", green: 1, yellow: 0.5, startWeek: 6, note: "Target: 1 per week in Weeks 6–12 (Goal: 6–7 total)" },
  venues_added:           { label: "New partner venues or lounges added to tracker", type: "number", green: 1, yellow: 0.5, note: "Target: 1–2 per week (Atlanta & Monroe)" },
  ops_sync_status:        { label: "Sunday cousin & brand operations sync", type: "select", note: "Weekly 15–20 min alignment",
                            statusMap: { completed: "green", rescheduled: "yellow", missed: "red" } },
  reading_status:         { label: "10x / Mom Test reading + 1 concrete takeaway logged", type: "select", note: "Target: 3+ sessions per week",
                            statusMap: { "3plus": "green", "1to2": "yellow", none: "red" } },
  craft_sessions:         { label: "CCST study + rolling craft sessions", type: "number", green: 3, yellow: 1.5, note: "Target: 3–4 sessions per week" },
};

const SELECT_OPTIONS = {
  followup_status:     [{ val: "", label: "-" }, { val: "all", label: "All sent" }, { val: "some", label: "Some missed" }, { val: "none", label: "None due" }],
  building_distracted: [{ val: "", label: "-" }, { val: "no", label: "No" }, { val: "little", label: "A little" }, { val: "yes", label: "Yes significantly" }],
  ops_sync_status:     [{ val: "", label: "-" }, { val: "completed", label: "Completed" }, { val: "rescheduled", label: "Rescheduled" }, { val: "missed", label: "Missed" }],
  reading_status:      [{ val: "", label: "-" }, { val: "3plus", label: "3+ sessions" }, { val: "1to2", label: "1–2 sessions" }, { val: "none", label: "None" }],
};

const PREMORTEM_WARNINGS = [
  `Zero partner or lounge owner conversations this week`,
  `Thinking about building software before passing the 4 Q1 Gates`,
  `Waiting to "feel ready" before having a casual chat with D'Floridian`,
  `Pitching ideas instead of asking Mom Test questions about past behavior`,
  `CCST study or rolling kit untouched all week`,
  `Skipped Sunday sync with Monroe partner`,
  `Letting W-2 onboarding or holiday stress bleed into venture hours`,
];

function getStatus(key, value, cycleWeek) {
  const m = METRICS[key];
  if (!value && value !== 0) return "gray";
  if (m.type === "number") {
    const v = parseFloat(value);
    if (isNaN(v)) return "gray";
    if (v >= m.green) return "green";
    if (m.startWeek && cycleWeek < m.startWeek) return "gray";
    if (v >= m.yellow) return "yellow";
    return "red";
  }
  return m.statusMap[value] || "gray";
}

function getOverallStatus(form, cycleWeek) {
  const statuses = Object.keys(METRICS).map(k => getStatus(k, form[k], cycleWeek)).filter(s => s !== "gray");
  if (statuses.length === 0) return "gray";
  const score = statuses.reduce((sum, s) => sum + (s === "green" ? 3 : s === "yellow" ? 2 : 1), 0) / statuses.length;
  if (score >= 2.5) return "green";
  if (score >= 1.8) return "yellow";
  return "red";
}

function getWeekStart() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  // Use local date string to avoid UTC timezone rollover
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_CONFIG = {
  green: { dot: "bg-emerald-500", badge: "bg-emerald-900/40 text-emerald-300 border border-emerald-700", label: "On track" },
  yellow: { dot: "bg-amber-500",  badge: "bg-amber-900/40 text-amber-300 border border-amber-700",       label: "Slipping" },
  red:    { dot: "bg-red-500",    badge: "bg-red-900/40 text-red-300 border border-red-700",             label: "Off track" },
  gray:   { dot: "bg-zinc-600",   badge: "bg-zinc-800 text-zinc-400 border border-zinc-600",             label: "—" },
};

const OVERALL_CONFIG = {
  green:  { bg: "bg-emerald-900/30 border-emerald-700", text: "text-emerald-300", icon: "✓", label: "On track" },
  yellow: { bg: "bg-amber-900/30 border-amber-700",     text: "text-amber-300",   icon: "!", label: "Slipping" },
  red:    { bg: "bg-red-900/30 border-red-700",         text: "text-red-300",     icon: "✕", label: "Off track" },
  gray:   { bg: "bg-zinc-800/50 border-zinc-700",       text: "text-zinc-400",    icon: "—", label: "Not started" },
};

const SECTION_STYLES = {
  outreach: "Outreach",
  pipeline: "Pipeline",
  strategic: "Strategic",
};

const METRIC_SECTIONS = {
  outreach: ["partner_outreach_count", "followup_status", "building_distracted"],
  pipeline: ["mom_test_count", "venues_added"],
  strategic: ["ops_sync_status", "reading_status", "craft_sessions"],
};

const emptyForm = {
  partner_outreach_count: "", followup_status: "", building_distracted: "",
  mom_test_count: "", venues_added: "", ops_sync_status: "",
  reading_status: "", craft_sessions: "", reflection: "", warning_signs: "",
};

export default function Scorecard() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyView, setHistoryView] = useState(false);
  const weekStart = getWeekStart();
  const cycleWeek = getCycleWeek(weekStart);

  const loadCurrentWeek = useCallback(async () => {
    const { data } = await supabase
      .from("scorecard_reviews")
      .select("*")
      .eq("week_start", weekStart)
      .single();
    if (data) {
      setForm({
        partner_outreach_count: data.partner_outreach_count ?? "",
        followup_status:        data.followup_status ?? "",
        building_distracted:    data.building_distracted ?? "",
        mom_test_count:         data.mom_test_count ?? "",
        venues_added:           data.venues_added ?? "",
        ops_sync_status:        data.ops_sync_status ?? "",
        reading_status:         data.reading_status ?? "",
        craft_sessions:         data.craft_sessions ?? "",
        reflection:             data.reflection ?? "",
        warning_signs:          data.warning_signs ?? "",
      });
    }
  }, [weekStart]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("scorecard_reviews")
      .select("*")
      .not("partner_outreach_count", "is", null) // only reviews saved with the Cycle 1 form
      .order("week_start", { ascending: false })
      .limit(12);
    if (data) setHistory(data);
  }, []);

  useEffect(() => { loadCurrentWeek(); loadHistory(); }, [loadCurrentWeek, loadHistory]);

  async function save() {
    setSaving(true);
    const overall = getOverallStatus(form, cycleWeek);
    const payload = {
      week_start: weekStart,
      partner_outreach_count: parseInt(form.partner_outreach_count) || 0,
      followup_status:        form.followup_status || null,
      building_distracted:    form.building_distracted || null,
      mom_test_count:         parseInt(form.mom_test_count) || 0,
      venues_added:           parseInt(form.venues_added) || 0,
      ops_sync_status:        form.ops_sync_status || null,
      reading_status:         form.reading_status || null,
      craft_sessions:         parseInt(form.craft_sessions) || 0,
      reflection:             form.reflection || null,
      warning_signs:          form.warning_signs || null,
      overall_status:         overall,
    };
    const { error } = await supabase.from("scorecard_reviews").upsert([payload], { onConflict: "week_start" });
    if (error) {
      console.error("Scorecard save error:", error);
      alert(`Save failed: ${error.message}`);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      loadHistory();
    }
    setSaving(false);
  }

  const overall = getOverallStatus(form, cycleWeek);
  const oc = OVERALL_CONFIG[overall];

  return (
    <div className="max-w-lg mx-auto px-4 pb-24 pt-2">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Weekly Scorecard</h1>
          <p className="text-xs text-zinc-400 font-mono">Week of {formatWeekLabel(weekStart)}</p>
        </div>
        <button
          onClick={() => setHistoryView(!historyView)}
          className="text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-all">
          {historyView ? "Current week" : "History"}
        </button>
      </div>

      {historyView ? (
        /* History View */
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-8">No reviews saved yet.</p>
          ) : history.map((h) => {
            const hc = OVERALL_CONFIG[h.overall_status || "gray"];
            return (
              <div key={h.id} className={`rounded-xl border p-4 ${hc.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Week of {formatWeekLabel(h.week_start)}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {h.partner_outreach_count || 0} outreach • {h.mom_test_count || 0} Mom Tests • {h.craft_sessions || 0} craft sessions
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${hc.text}`}>{hc.icon} {hc.label}</span>
                </div>
                {h.reflection && (
                  <p className="text-xs text-zinc-400 mt-2 border-t border-zinc-700/50 pt-2 italic">{h.reflection}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Overall Status */}
          <div className={`rounded-xl border p-4 mb-5 flex items-center gap-3 ${oc.bg}`}>
            <span className={`text-2xl font-black ${oc.text}`}>{oc.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Mission status this week</p>
              <p className="text-xs text-zinc-400">Fill in the metrics below to update</p>
            </div>
            <span className={`text-base font-bold ${oc.text}`}>{oc.label}</span>
          </div>

          {/* Metric Sections */}
          {Object.entries(METRIC_SECTIONS).map(([section, keys]) => (
            <div key={section} className="mb-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                {SECTION_STYLES[section]}
                <span className="flex-1 h-px bg-zinc-800 block"></span>
              </p>
              <div className="space-y-2">
                {keys.map(key => {
                  const m = METRICS[key];
                  const status = getStatus(key, form[key], cycleWeek);
                  const sc = STATUS_CONFIG[status];
                  return (
                    <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{m.label}</p>
                        <p className="text-xs text-zinc-500">{m.note}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.type === "number" ? (
                          <input
                            type="number" min="0" step="1"
                            value={form[key]}
                            onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder="0"
                            className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white text-center font-mono focus:outline-none focus:border-yellow-500"
                          />
                        ) : (
                          <select
                            value={form[key]}
                            onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-yellow-500">
                            {SELECT_OPTIONS[key].map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                          </select>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-md font-mono min-w-[62px] text-center ${sc.badge}`}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* The One Question */}
          <div className="mb-5">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              The one question
              <span className="flex-1 h-px bg-zinc-800 block"></span>
            </p>
            <p className="text-sm text-white mb-2 leading-relaxed">
              "Did I build real hospitality craft, relationships, and validated truth this week — or did I hide behind busywork and stress?"
            </p>
            <textarea
              value={form.reflection}
              onChange={e => setForm(prev => ({ ...prev, reflection: e.target.value }))}
              placeholder="Be honest with yourself here..."
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500 resize-none"
            />
          </div>

          {/* Premortem Check-in */}
          <div className="mb-5">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              Premortem check-in
              <span className="flex-1 h-px bg-zinc-800 block"></span>
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 mb-2">
              <p className="text-xs text-zinc-500 mb-2">Am I seeing any of these warning signs?</p>
              {PREMORTEM_WARNINGS.map((w, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-t border-zinc-800 first:border-t-0">
                  <span className="text-amber-500 text-xs mt-0.5 flex-shrink-0">!</span>
                  <p className="text-xs text-zinc-400">{w}</p>
                </div>
              ))}
            </div>
            <textarea
              value={form.warning_signs}
              onChange={e => setForm(prev => ({ ...prev, warning_signs: e.target.value }))}
              placeholder="Note any warning signs you're seeing this week..."
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500 resize-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={save}
            disabled={saving}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-emerald-600 text-white" : "bg-yellow-500 hover:bg-yellow-400 text-black"} disabled:opacity-50`}>
            {saving ? "Saving..." : saved ? "✓ Saved for this week" : "Save weekly review"}
          </button>
        </>
      )}
    </div>
  );
}
