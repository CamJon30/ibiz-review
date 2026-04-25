"use client";

import { useState, useEffect, useRef } from "react";
import { useTrackerData } from "@/lib/useTrackerData";
import Pomodoro from "./Pomodoro";
import Reminders from "./Reminders";
import Milestones from "./Milestones";

// ─── Date Utilities (all local timezone safe) ───

const parseLocal = (d) => {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const toKey = (d) => {
  const date = parseLocal(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const today = () => toKey(new Date());

const formatDate = (d) =>
  parseLocal(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const formatShortDay = (d) =>
  parseLocal(d).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);

const formatDayNum = (d) => parseLocal(d).getDate();

// Quarter alignment: Q1=Jan1, Q2=Apr1, Q3=Jul1, Q4=Oct1
const getQuarterStart = (date) => {
  const d = parseLocal(date);
  const qStart = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), qStart, 1);
};

const getQuarterNum = (date) => Math.floor(parseLocal(date).getMonth() / 3) + 1;

const getWeekOfQuarter = (date) => {
  const d = parseLocal(date);
  const quarterStart = getQuarterStart(date);
  const diffMs = d - quarterStart;
  const diffDays = Math.floor(diffMs / 86400000);
  return Math.min(12, Math.floor(diffDays / 7) + 1);
};

const getDaysInRange = (start, end) => {
  const days = [];
  const current = parseLocal(start);
  const last = parseLocal(end);
  while (current <= last) { days.push(toKey(current)); current.setDate(current.getDate() + 1); }
  return days;
};

const getWeekDays = (date) => {
  const d = parseLocal(date);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start); dt.setDate(start.getDate() + i); return toKey(dt);
  });
};

const getWeekStart = (date) => getWeekDays(date)[0];

const getWeekRange = (date) => {
  const days = getWeekDays(date);
  return { start: days[0], end: days[6] };
};

const getMonthRange = (date) => {
  const d = parseLocal(date);
  return { start: toKey(new Date(d.getFullYear(), d.getMonth(), 1)), end: toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
};

const getQuarterRange = (date) => {
  const d = parseLocal(date);
  const qStart = Math.floor(d.getMonth() / 3) * 3;
  return { start: toKey(new Date(d.getFullYear(), qStart, 1)), end: toKey(new Date(d.getFullYear(), qStart + 3, 0)) };
};

// ─── Main Component ───

export default function Tracker() {
  const {
    data,
    addTask: dbAddTask, toggleTask: dbToggleTask, deleteTask: dbDeleteTask, updateTask: dbUpdateTask,
    addGoal: dbAddGoal, removeGoal: dbRemoveGoal,
    addPomoSession, updateWeeklyNotes: dbUpdateWeeklyNotes,
    addReminder: dbAddReminder, updateReminder: dbUpdateReminder, deleteReminder: dbDeleteReminder,
    refresh,
  } = useTrackerData();

  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(today());
  const [newTask, setNewTask] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [expandedTask, setExpandedTask] = useState(null);
  const [editingField, setEditingField] = useState(null); // { taskId, field: "text"|"notes" }
  const [editValue, setEditValue] = useState("");
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [animateIn, setAnimateIn] = useState(true);
  const [weeklyNoteText, setWeeklyNoteText] = useState("");
  const [editingWeeklyNote, setEditingWeeklyNote] = useState(false);
  const inputRef = useRef(null);
  const goalInputRef = useRef(null);
  const editInputRef = useRef(null);
  const weeklyNoteRef = useRef(null);
  const weeklyNoteSaveTimer = useRef(null);

  useEffect(() => { if (inputRef.current && view === "daily") inputRef.current.focus(); }, [view, selectedDate]);
  useEffect(() => { if (goalInputRef.current && showGoalInput) goalInputRef.current.focus(); }, [showGoalInput]);
  useEffect(() => { if (editInputRef.current && editingField) editInputRef.current.focus(); }, [editingField]);
  useEffect(() => { if (weeklyNoteRef.current && editingWeeklyNote) weeklyNoteRef.current.focus(); }, [editingWeeklyNote]);

  useEffect(() => { setAnimateIn(false); const t = setTimeout(() => setAnimateIn(true), 50); return () => clearTimeout(t); }, [view, selectedDate]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  // Sync weekly note text when date or data changes
  const currentWeekStart = getWeekStart(selectedDate);
  useEffect(() => {
    if (data?.weeklyNotes) {
      setWeeklyNoteText((data.weeklyNotes || {})[currentWeekStart] || "");
    }
  }, [currentWeekStart, data?.weeklyNotes]);

  if (!data) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 rounded-full bg-gold animate-pulse" /></div>;

  // ─── Computed ───
  const weekDays = getWeekDays(selectedDate);
  const todayKey = today();
  const dayTasks = data.tasks[selectedDate] || [];
  const completedCount = dayTasks.filter((t) => t.done).length;
  const totalCount = dayTasks.length;
  const dailyRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isToday = selectedDate === todayKey;
  const weekRange = getWeekRange(selectedDate);
  const monthRange = getMonthRange(selectedDate);
  const quarterRange = getQuarterRange(selectedDate);
  const weekStats = calcStats(data, weekRange);
  const monthStats = calcStats(data, monthRange);
  const quarterStats = calcStats(data, quarterRange);
  const weekOfQuarter = getWeekOfQuarter(selectedDate);
  const streak = calcStreak(data, todayKey);
  const todayPomoSessions = (data.pomodoroSessions || {})[todayKey] || 0;

  const quickDates = [
    { label: "Today", key: todayKey },
    { label: "Tomorrow", key: (() => { const d = parseLocal(todayKey); d.setDate(d.getDate() + 1); return toKey(d); })() },
    { label: "This Fri", key: (() => { const d = parseLocal(todayKey); const diff = 5 - d.getDay(); d.setDate(d.getDate() + (diff <= 0 ? diff + 7 : diff)); return toKey(d); })() },
    { label: "Next Mon", key: (() => { const d = parseLocal(todayKey); d.setDate(d.getDate() + (8 - d.getDay())); return toKey(d); })() },
  ];

  // ─── Actions ───
  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    const targetDate = taskDueDate || selectedDate;
    dbAddTask(targetDate, text, newTaskNotes.trim());
    setNewTask(""); setNewTaskNotes(""); setShowNoteInput(false);
    setTaskDueDate(""); setShowDatePicker(false);
    if (targetDate !== selectedDate) setSelectedDate(targetDate);
  };

  const toggleTask = (taskId, dateKey) => dbToggleTask(taskId, dateKey || selectedDate);
  const deleteTask = (taskId, dateKey) => dbDeleteTask(taskId, dateKey || selectedDate);

  const startEditField = (task, field) => {
    setEditingField({ taskId: task.id, field });
    setEditValue(field === "text" ? task.text : (task.notes || ""));
  };

  const saveEditField = () => {
    if (!editingField) return;
    const updates = {};
    updates[editingField.field] = editValue;
    if (editingField.field === "text" && !editValue.trim()) return;
    dbUpdateTask(editingField.taskId, selectedDate, updates);
    setEditingField(null); setEditValue("");
  };

  const addGoal = () => {
    const text = newGoal.trim();
    if (!text) return;
    dbAddGoal(text); setNewGoal(""); setShowGoalInput(false);
  };

  const removeGoal = (goalId) => dbRemoveGoal(goalId);
  const navigateWeek = (dir) => { const d = parseLocal(selectedDate); d.setDate(d.getDate() + dir * 7); setSelectedDate(toKey(d)); };
  const handlePomoComplete = () => addPomoSession(todayKey);

  const dayTaskCount = (dateKey) => (data.tasks[dateKey] || []).length;
  const dayDoneCount = (dateKey) => (data.tasks[dateKey] || []).filter((t) => t.done).length;

  const getReviewDays = (range) =>
    getDaysInRange(range.start, range.end)
      .map((day) => ({ date: day, tasks: data.tasks[day] || [] }))
      .filter((d) => d.tasks.length > 0);

  const calcPomoStats = (range) => {
    let total = 0;
    getDaysInRange(range.start, range.end).forEach((day) => { total += (data.pomodoroSessions || {})[day] || 0; });
    return total;
  };

  // Weekly notes auto-save
  const handleWeeklyNoteChange = (val) => {
    setWeeklyNoteText(val);
    clearTimeout(weeklyNoteSaveTimer.current);
    weeklyNoteSaveTimer.current = setTimeout(() => {
      dbUpdateWeeklyNotes(currentWeekStart, val);
    }, 800);
  };

  // Get weekly notes for a given range (for review views)
  const getWeeklyNotesInRange = (range) => {
    const days = getDaysInRange(range.start, range.end);
    const weekStarts = new Set();
    days.forEach((d) => weekStarts.add(getWeekStart(d)));
    const notes = [];
    weekStarts.forEach((ws) => {
      const n = (data.weeklyNotes || {})[ws];
      if (n) notes.push({ weekStart: ws, notes: n });
    });
    return notes;
  };

  // ─── Render ───
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center pt-6 pb-4 border-b border-surface-3">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="2" fill="#E8C547" opacity="0.9" />
            <rect x="16" y="2" width="10" height="10" rx="2" fill="#E8C547" opacity="0.5" />
            <rect x="2" y="16" width="10" height="10" rx="2" fill="#E8C547" opacity="0.5" />
            <rect x="16" y="16" width="10" height="10" rx="2" fill="#E8C547" opacity="0.2" />
          </svg>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">12 Week Year</h1>
            <span className="text-xs text-neutral-500 font-mono tracking-wide">Week {weekOfQuarter} of 12</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-1 bg-gold-bg border border-gold-border rounded-full px-2.5 py-1">
              <span className="text-gold text-xs">&#9733;</span>
              <span className="text-xs text-gold font-mono font-medium">{streak}d streak</span>
            </div>
          )}
          <button
            onClick={async () => { setRefreshing(true); await refresh(); setTimeout(() => setRefreshing(false), 600); }}
            title="Sync"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-surface-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={refreshing ? "#E8C547" : "#555"} strokeWidth="1.5"
              style={{ transition: "all 0.3s", transform: refreshing ? "rotate(360deg)" : "rotate(0deg)" }}>
              <path d="M1.5 8a6.5 6.5 0 0111.48-4.16M14.5 8a6.5 6.5 0 01-11.48 4.16" />
              <path d="M13 1v3.5h-3.5M3 15v-3.5h3.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 12 Week Progress */}
      <div className="pt-4 pb-2">
        <div className="flex gap-[3px]">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="flex-1 h-5 rounded-[3px] flex items-center justify-center transition-all duration-300"
              style={{ background: i < weekOfQuarter ? "#E8C547" : "#1a1a1a", opacity: i < weekOfQuarter ? (i === weekOfQuarter - 1 ? 1 : 0.5) : 0.15 }}>
              <span className="text-[8px] font-semibold" style={{ color: i < weekOfQuarter ? "#000" : "#444" }}>{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-neutral-600 font-mono text-right mt-1.5">
          Q{getQuarterNum(selectedDate)} &bull; {Math.round((weekOfQuarter / 12) * 100)}% through quarter
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 py-3 border-b border-surface-2">
        {["daily", "weekly", "monthly", "quarterly"].map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-all tracking-wide ${view === v ? "bg-surface-2 text-gold font-semibold" : "text-neutral-600 hover:text-neutral-400"}`}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-4 transition-all duration-250" style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(8px)" }}>

        {/* ═══ DAILY VIEW ═══ */}
        {view === "daily" && (
          <div>
            {/* Calendar Strip */}
            <div className="flex items-center gap-1 mb-2">
              <button onClick={() => navigateWeek(-1)} className="text-neutral-500 text-2xl leading-none px-1 hover:text-neutral-300 transition-colors shrink-0">&lsaquo;</button>
              <div className="flex flex-1 gap-0.5">
                {weekDays.map((dayKey) => {
                  const isSelected = dayKey === selectedDate;
                  const isTodayDay = dayKey === todayKey;
                  const tc = dayTaskCount(dayKey); const dc = dayDoneCount(dayKey);
                  const allDone = tc > 0 && dc === tc;
                  return (
                    <button key={dayKey} onClick={() => setSelectedDate(dayKey)}
                      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all duration-150 hover:bg-surface-3"
                      style={{ background: isSelected ? "#E8C547" : undefined, border: `2px solid ${isTodayDay && !isSelected ? "#E8C547" : "transparent"}` }}>
                      <span className="text-[10px] font-mono font-medium tracking-wider uppercase" style={{ color: isSelected ? "#000" : isTodayDay ? "#E8C547" : "#666" }}>{formatShortDay(dayKey)}</span>
                      <span className="text-base font-bold leading-none" style={{ color: isSelected ? "#000" : "#ddd" }}>{formatDayNum(dayKey)}</span>
                      {tc > 0 && <span className="w-[5px] h-[5px] rounded-full mt-0.5" style={{ background: isSelected ? "#000" : allDone ? "#E8C547" : dc > 0 ? "#886a1a" : "#444" }} />}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => navigateWeek(1)} className="text-neutral-500 text-2xl leading-none px-1 hover:text-neutral-300 transition-colors shrink-0">&rsaquo;</button>
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-400 font-medium">{formatDate(selectedDate)}</span>
              {!isToday && <button onClick={() => setSelectedDate(todayKey)} className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded-lg px-2 py-0.5 hover:text-neutral-300 transition-colors">Today</button>}
            </div>

            <Pomodoro onSessionComplete={handlePomoComplete} todaySessions={todayPomoSessions} />
            <Reminders />
            <Milestones
              reminders={data.reminders || []}
              onAdd={dbAddReminder}
              onUpdate={dbUpdateReminder}
              onDelete={dbDeleteReminder}
            />

            {/* Progress */}
            <div className="mb-5">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs text-neutral-500 font-mono">{completedCount}/{totalCount} tasks</span>
                <span className="text-xl font-bold font-mono" style={{ color: dailyRate === 100 && totalCount > 0 ? "#E8C547" : "#888" }}>{dailyRate}%</span>
              </div>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold to-gold-dark rounded-full transition-all duration-400 animate-progress-fill" style={{ width: `${dailyRate}%` }} />
              </div>
            </div>

            {/* Add Task */}
            <div className="mb-5">
              <div className="flex gap-2">
                <input ref={inputRef} value={newTask} onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  placeholder="Add a task..."
                  className="flex-1 bg-surface-1 border border-surface-4 rounded-lg px-3.5 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors" />
                <button onClick={() => setShowNoteInput(!showNoteInput)} title="Add note"
                  className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-all hover:border-neutral-500"
                  style={{ background: "#111", color: newTaskNotes ? "#E8C547" : "#555", borderColor: newTaskNotes ? "#E8C547" : "#222" }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3h10v10H6l-3-3V3z" /><line x1="5.5" y1="6" x2="10.5" y2="6" /><line x1="5.5" y1="8.5" x2="9" y2="8.5" />
                  </svg>
                </button>
                <button onClick={() => setShowDatePicker(!showDatePicker)} title="Set due date"
                  className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 transition-all hover:border-neutral-500"
                  style={{ background: "#111", color: taskDueDate ? "#E8C547" : "#555", borderColor: taskDueDate ? "#E8C547" : "#222" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="12" height="11" rx="2" /><line x1="2" y1="6.5" x2="14" y2="6.5" /><line x1="5.5" y1="1.5" x2="5.5" y2="4" /><line x1="10.5" y1="1.5" x2="10.5" y2="4" />
                  </svg>
                </button>
                <button onClick={addTask} className="w-10 h-10 bg-gold rounded-lg text-black text-xl font-bold flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">+</button>
              </div>

              {showNoteInput && (
                <textarea value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)}
                  placeholder="Add notes for this task..."
                  className="w-full mt-2 bg-surface-1 border border-surface-4 rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500 resize-none transition-colors"
                  rows={2} style={{ colorScheme: "dark" }} />
              )}

              {showDatePicker && (
                <div className="mt-2.5 p-3 bg-surface-1 border border-surface-4 rounded-xl animate-slide-down">
                  <div className="text-[11px] text-neutral-500 font-mono mb-2">{taskDueDate ? `Due: ${formatDate(taskDueDate)}` : "Assign to day:"}</div>
                  <div className="flex gap-1.5 mb-2.5 flex-wrap">
                    {quickDates.map((qd) => (
                      <button key={qd.key} onClick={() => setTaskDueDate(qd.key)}
                        className="px-2.5 py-1 text-[11px] rounded-md border font-medium transition-all"
                        style={{ background: taskDueDate === qd.key ? "#E8C547" : "#1a1a1a", color: taskDueDate === qd.key ? "#000" : "#aaa", borderColor: taskDueDate === qd.key ? "#E8C547" : "#222" }}>{qd.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}
                      className="flex-1 bg-surface border border-surface-4 rounded-md px-2.5 py-1.5 text-xs text-neutral-400 font-mono outline-none" style={{ colorScheme: "dark" }} />
                    {taskDueDate && <button onClick={() => setTaskDueDate("")} className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded-md px-2 py-1 hover:text-neutral-300 transition-colors">Clear</button>}
                  </div>
                </div>
              )}
            </div>

            {/* Task List */}
            <div className="flex flex-col gap-1">
              {dayTasks.length === 0 && (
                <div className="flex flex-col items-center py-10 gap-2">
                  <span className="text-2xl text-neutral-800">&#9744;</span>
                  <span className="text-sm text-neutral-600">No tasks for this day. Add one above.</span>
                </div>
              )}
              {dayTasks.map((task, i) => {
                const isExpanded = expandedTask === task.id;
                const isEditingText = editingField?.taskId === task.id && editingField?.field === "text";
                const isEditingNotes = editingField?.taskId === task.id && editingField?.field === "notes";
                return (
                  <div key={task.id} className="rounded-lg transition-all" style={{ animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`, background: isExpanded ? "#111" : "transparent" }}>
                    {/* Main row */}
                    <div className="flex items-center gap-2.5 px-2 py-2.5" style={{ opacity: task.done ? 0.5 : 1 }}>
                      <button onClick={() => toggleTask(task.id)}
                        className="w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{ background: task.done ? "#E8C547" : "transparent", borderColor: task.done ? "#E8C547" : "#444" }}>
                        {task.done && <span className="text-black text-xs font-bold">&#10003;</span>}
                      </button>

                      {isEditingText ? (
                        <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEditField(); if (e.key === "Escape") setEditingField(null); }}
                          onBlur={saveEditField}
                          className="flex-1 bg-surface border border-gold rounded-md px-2 py-1 text-sm text-neutral-200 outline-none" />
                      ) : (
                        <span onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                          className="flex-1 text-sm text-neutral-300 leading-snug cursor-pointer transition-all"
                          style={{ textDecoration: task.done ? "line-through" : "none" }}>
                          {task.text}
                          {task.notes && <span className="text-neutral-600 ml-1.5 text-[10px]">&#9998;</span>}
                        </span>
                      )}

                      <button onClick={() => deleteTask(task.id)} className="text-neutral-700 text-lg hover:text-neutral-400 transition-colors shrink-0 px-1">&times;</button>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0">
                        {/* Notes */}
                        <div className="ml-8 mb-2">
                          {isEditingNotes ? (
                            <textarea ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                              onBlur={saveEditField}
                              onKeyDown={(e) => { if (e.key === "Escape") setEditingField(null); }}
                              className="w-full bg-surface border border-gold rounded-md px-2 py-1.5 text-xs text-neutral-300 outline-none resize-none" rows={3} />
                          ) : (
                            <div onClick={() => startEditField(task, "notes")}
                              className="text-xs text-neutral-500 cursor-pointer py-1 px-2 rounded-md hover:bg-surface-3 transition-colors min-h-[28px]">
                              {task.notes || "Tap to add notes..."}
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div className="ml-8 flex gap-2">
                          <button onClick={() => startEditField(task, "text")}
                            className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded px-2 py-0.5 hover:text-neutral-300 transition-colors">
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ WEEKLY VIEW ═══ */}
        {view === "weekly" && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white tracking-tight">Weekly Review</h2>
              <span className="text-xs text-neutral-500 font-mono">{formatDate(weekRange.start)} &ndash; {formatDate(weekRange.end)}</span>
            </div>
            <StatsCards stats={weekStats} pomoSessions={calcPomoStats(weekRange)} />

            {/* Weekly Notes */}
            <div className="bg-[#0f0f0f] border border-surface-3 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-neutral-300">Week Notes</h3>
                {!editingWeeklyNote && (
                  <button onClick={() => setEditingWeeklyNote(true)}
                    className="text-[10px] text-neutral-500 font-mono border border-neutral-700 rounded px-2 py-0.5 hover:text-neutral-300 transition-colors">
                    {weeklyNoteText ? "Edit" : "+ Note"}
                  </button>
                )}
              </div>
              {editingWeeklyNote ? (
                <div>
                  <textarea ref={weeklyNoteRef} value={weeklyNoteText} onChange={(e) => handleWeeklyNoteChange(e.target.value)}
                    placeholder="Reflections, wins, blockers, lessons learned..."
                    className="w-full bg-surface border border-surface-4 rounded-lg px-3 py-2 text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-500 resize-none"
                    rows={4} style={{ colorScheme: "dark" }} />
                  <button onClick={() => { dbUpdateWeeklyNotes(currentWeekStart, weeklyNoteText); setEditingWeeklyNote(false); }}
                    className="mt-2 text-[10px] text-gold font-mono border border-gold-border rounded px-3 py-1 hover:bg-gold-bg transition-colors">Done</button>
                </div>
              ) : weeklyNoteText ? (
                <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{weeklyNoteText}</p>
              ) : (
                <p className="text-xs text-neutral-600 italic">No notes for this week yet.</p>
              )}
            </div>

            <ReviewDays days={getReviewDays(weekRange)} toggleTask={toggleTask} />
          </div>
        )}

        {/* ═══ MONTHLY VIEW ═══ */}
        {view === "monthly" && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white tracking-tight">Monthly Review</h2>
              <span className="text-xs text-neutral-500 font-mono">{parseLocal(selectedDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            </div>
            <StatsCards stats={monthStats} pomoSessions={calcPomoStats(monthRange)} />
            <WeeklyNotesSummary notes={getWeeklyNotesInRange(monthRange)} />
            <ReviewDays days={getReviewDays(monthRange)} toggleTask={toggleTask} />
          </div>
        )}

        {/* ═══ QUARTERLY VIEW ═══ */}
        {view === "quarterly" && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white tracking-tight">Quarterly Review</h2>
              <span className="text-xs text-neutral-500 font-mono">Q{getQuarterNum(selectedDate)} {parseLocal(selectedDate).getFullYear()} &bull; Week {weekOfQuarter}/12</span>
            </div>
            <StatsCards stats={quarterStats} pomoSessions={calcPomoStats(quarterRange)} />

            {/* 12 Week Goals */}
            <div className="bg-[#0f0f0f] border border-surface-3 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-neutral-300">12 Week Goals</h3>
                <button onClick={() => setShowGoalInput(!showGoalInput)} className="text-[11px] text-neutral-500 font-mono border border-neutral-700 rounded-md px-2.5 py-1 hover:text-neutral-300 transition-colors">{showGoalInput ? "Cancel" : "+ Goal"}</button>
              </div>
              {showGoalInput && (
                <div className="flex gap-2 mb-4 animate-slide-down">
                  <input ref={goalInputRef} value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGoal()}
                    placeholder="Define a quarter goal..." className="flex-1 bg-surface-1 border border-surface-4 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors" />
                  <button onClick={addGoal} className="w-10 h-10 bg-gold rounded-lg text-black text-xl font-bold flex items-center justify-center shrink-0">+</button>
                </div>
              )}
              {data.goals.length === 0 && !showGoalInput && <p className="text-sm text-neutral-600 text-center py-4">Set your 12 week goals to stay focused on what matters.</p>}
              {data.goals.map((goal, i) => (
                <div key={goal.id} className="flex items-center gap-2.5 py-2 px-1 border-b border-surface-2" style={{ animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}>
                  <span className="text-gold text-[10px] shrink-0">&#9670;</span>
                  <span className="flex-1 text-sm text-neutral-400">{goal.text}</span>
                  <button onClick={() => removeGoal(goal.id)} className="text-neutral-700 text-lg hover:text-neutral-400 transition-colors px-1">&times;</button>
                </div>
              ))}
            </div>

            <WeeklyNotesSummary notes={getWeeklyNotesInRange(quarterRange)} />
            <ReviewDays days={getReviewDays(quarterRange)} toggleTask={toggleTask} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───

function calcStats(data, range) {
  const days = getDaysInRange(range.start, range.end);
  let total = 0, completed = 0, activeDays = 0;
  days.forEach((day) => { const tasks = data.tasks[day] || []; if (tasks.length > 0) activeDays++; total += tasks.length; completed += tasks.filter((t) => t.done).length; });
  return { total, completed, activeDays, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function calcStreak(data, todayKey) {
  let streak = 0; const d = parseLocal(todayKey);
  while (true) { const key = toKey(d); const tasks = data.tasks[key] || []; if (tasks.length === 0) break; if (!tasks.every((t) => t.done)) break; streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ─── Sub-Components ───

function StatsCards({ stats, pomoSessions = 0 }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-6">
      <div className="bg-surface-1 border border-surface-3 rounded-xl p-3.5">
        <span className="text-2xl font-bold text-white font-mono tracking-tight block">{stats.completed}</span>
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">Completed</span>
      </div>
      <div className="bg-surface-1 border border-surface-3 rounded-xl p-3.5">
        <span className="text-2xl font-bold text-white font-mono tracking-tight block">{stats.total}</span>
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">Total Tasks</span>
      </div>
      <div className="bg-surface-1 rounded-xl p-3.5 border transition-colors" style={{ borderColor: stats.rate >= 80 ? "#E8C547" : stats.rate >= 50 ? "#555" : "#3a1c1c" }}>
        <span className="text-2xl font-bold font-mono tracking-tight block" style={{ color: stats.rate >= 80 ? "#E8C547" : stats.rate >= 50 ? "#aaa" : "#c44" }}>{stats.rate}%</span>
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">Completion</span>
      </div>
      <div className="bg-surface-1 border border-surface-3 rounded-xl p-3.5">
        <span className="text-2xl font-bold text-white font-mono tracking-tight block">{pomoSessions}</span>
        <span className="text-[11px] text-neutral-600 uppercase tracking-widest">Focus Sessions</span>
      </div>
    </div>
  );
}

function WeeklyNotesSummary({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-neutral-300 mb-3">Week Notes</h3>
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <div key={n.weekStart} className="bg-[#0f0f0f] border border-[#161616] rounded-xl p-3">
            <span className="text-[10px] text-neutral-600 font-mono block mb-1">Week of {formatDate(n.weekStart)}</span>
            <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{n.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDays({ days, toggleTask }) {
  if (days.length === 0) return <p className="text-sm text-neutral-600 text-center py-10">No tracked days in this period yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => {
        const done = day.tasks.filter((t) => t.done).length;
        const total = day.tasks.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={day.date} className="bg-[#0f0f0f] border border-[#161616] rounded-xl p-3.5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-neutral-400">{formatDate(day.date)}</span>
              <span className="text-[11px] font-mono" style={{ color: pct === 100 ? "#E8C547" : pct >= 50 ? "#888" : "#c44" }}>{done}/{total}</span>
            </div>
            <div className="h-[3px] bg-surface-3 rounded-full overflow-hidden mb-2.5">
              <div className="h-full bg-gold rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-col gap-1.5">
              {day.tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2">
                  <button onClick={() => toggleTask(task.id, day.date)}
                    className="w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-all mt-0.5"
                    style={{ background: task.done ? "#E8C547" : "transparent", borderColor: task.done ? "#E8C547" : "#333" }}>
                    {task.done && <span className="text-black text-[9px] font-bold">&#10003;</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-neutral-500 transition-all block" style={{ textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.5 : 0.8 }}>{task.text}</span>
                    {task.notes && <span className="text-[10px] text-neutral-600 block mt-0.5 leading-snug">{task.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
