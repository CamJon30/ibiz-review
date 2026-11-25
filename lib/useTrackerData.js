"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";

const LOCAL_KEY = "12wy-tracker-data";

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveLocal(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
}

// ─── Supabase Fetchers ───

async function fetchAllTasks() {
  const { data, error } = await supabase
    .from("tasks").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  const tasks = {};
  (data || []).forEach((row) => {
    if (!tasks[row.date]) tasks[row.date] = [];
    tasks[row.date].push({
      id: row.id, text: row.text, done: row.done,
      notes: row.notes || "",
      createdAt: new Date(row.created_at).getTime(),
    });
  });
  return tasks;
}

async function fetchAllGoals() {
  const { data, error } = await supabase
    .from("goals").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id, text: row.text, createdAt: new Date(row.created_at).getTime(),
  }));
}

async function fetchAllPomoSessions() {
  const { data, error } = await supabase.from("pomodoro_sessions").select("*");
  if (error) throw error;
  const sessions = {};
  (data || []).forEach((row) => { sessions[row.date] = row.count; });
  return sessions;
}

async function fetchAllWeeklyNotes() {
  const { data, error } = await supabase.from("weekly_notes").select("*");
  if (error) throw error;
  const notes = {};
  (data || []).forEach((row) => { notes[row.week_start] = row.notes || ""; });
  return notes;
}

async function fetchAllReminders() {
  const { data, error } = await supabase
    .from("reminders").select("*").order("due_date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    notes: row.notes || "",
    alertDays: row.alert_days || [7, 1],
    notifiedDays: row.notified_days || [],
    done: row.done,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

// Tolerant on purpose: if the cycle_themes table does not exist yet, the rest of the app still works
async function fetchAllCycleThemes() {
  try {
    const { data, error } = await supabase.from("cycle_themes").select("*");
    if (error) throw error;
    const themes = {};
    (data || []).forEach((row) => { themes[row.cycle_start] = row.theme || ""; });
    return themes;
  } catch (err) {
    console.warn("Cycle themes unavailable (run supabase/004_add_cycle_theme.sql):", err);
    return {};
  }
}

async function fetchAll() {
  const [tasks, goals, pomodoroSessions, weeklyNotes, reminders, themes] = await Promise.all([
    fetchAllTasks(), fetchAllGoals(), fetchAllPomoSessions(), fetchAllWeeklyNotes(), fetchAllReminders(),
    fetchAllCycleThemes(),
  ]);
  return { tasks, goals, pomodoroSessions, weeklyNotes, reminders, themes };
}

// ─── Hook ───

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

export function useTrackerData() {
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const lastFetchRef = useRef(0);

  const syncFromRemote = useCallback(async (force = false) => {
    // Skip if we fetched recently (within 10s) unless forced
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 10000) return;
    lastFetchRef.current = now;

    try {
      const remote = await fetchAll();
      if (mountedRef.current) {
        setData(remote);
        saveLocal(remote);
        setError(null);
      }
    } catch (err) {
      console.error("Supabase sync error:", err);
      if (mountedRef.current) setError("Offline mode");
    }
  }, []);

  // Initial load: localStorage first, then Supabase
  useEffect(() => {
    mountedRef.current = true;
    const local = loadLocal();
    if (local) setData(local);
    syncFromRemote(true);
    return () => { mountedRef.current = false; };
  }, [syncFromRemote]);

  // Poll every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => syncFromRemote(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [syncFromRemote]);

  // Refresh when tab becomes visible (switching back from another app/tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncFromRemote();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncFromRemote]);

  // ─── Task Operations ───

  const addTask = useCallback(async (date, text, notes = "") => {
    const tempId = Date.now();
    const newTask = { id: tempId, text, done: false, notes, createdAt: tempId };
    const updated = { ...data, tasks: { ...data.tasks } };
    if (!updated.tasks[date]) updated.tasks[date] = [];
    updated.tasks[date] = [...updated.tasks[date], newTask];
    setData(updated); saveLocal(updated);

    try {
      const { data: inserted, error } = await supabase
        .from("tasks").insert({ date, text, done: false, notes }).select().single();
      if (error) throw error;
      const synced = { ...updated, tasks: { ...updated.tasks } };
      synced.tasks[date] = synced.tasks[date].map((t) =>
        t.id === tempId ? { ...t, id: inserted.id } : t
      );
      setData(synced); saveLocal(synced);
    } catch (err) { console.error("Add task error:", err); }
  }, [data]);

  const toggleTask = useCallback(async (taskId, date) => {
    const tasks = data.tasks[date] || [];
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;
    const updated = { ...data, tasks: { ...data.tasks } };
    updated.tasks[date] = tasks.map((t) => t.id === taskId ? { ...t, done: newDone } : t);
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("tasks").update({ done: newDone }).eq("id", taskId);
      if (error) throw error;
    } catch (err) { console.error("Toggle task error:", err); }
  }, [data]);

  const deleteTask = useCallback(async (taskId, date) => {
    const updated = { ...data, tasks: { ...data.tasks } };
    updated.tasks[date] = (updated.tasks[date] || []).filter((t) => t.id !== taskId);
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    } catch (err) { console.error("Delete task error:", err); }
  }, [data]);

  const updateTask = useCallback(async (taskId, date, updates) => {
    const updated = { ...data, tasks: { ...data.tasks } };
    updated.tasks[date] = (updated.tasks[date] || []).map((t) =>
      t.id === taskId ? { ...t, ...updates } : t
    );
    setData(updated); saveLocal(updated);
    try {
      const dbUpdates = {};
      if (updates.text !== undefined) dbUpdates.text = updates.text;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", taskId);
      if (error) throw error;
    } catch (err) { console.error("Update task error:", err); }
  }, [data]);

  // ─── Goal Operations ───

  const addGoal = useCallback(async (text) => {
    const tempId = Date.now();
    const updated = { ...data, goals: [...data.goals, { id: tempId, text, createdAt: tempId }] };
    setData(updated); saveLocal(updated);
    try {
      const { data: inserted, error } = await supabase.from("goals").insert({ text }).select().single();
      if (error) throw error;
      const synced = { ...updated, goals: updated.goals.map((g) => g.id === tempId ? { ...g, id: inserted.id } : g) };
      setData(synced); saveLocal(synced);
    } catch (err) { console.error("Add goal error:", err); }
  }, [data]);

  const removeGoal = useCallback(async (goalId) => {
    const updated = { ...data, goals: data.goals.filter((g) => g.id !== goalId) };
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
    } catch (err) { console.error("Remove goal error:", err); }
  }, [data]);

  // ─── Pomodoro Operations ───

  const addPomoSession = useCallback(async (date) => {
    const currentCount = (data.pomodoroSessions || {})[date] || 0;
    const newCount = currentCount + 1;
    const updated = { ...data, pomodoroSessions: { ...(data.pomodoroSessions || {}), [date]: newCount } };
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("pomodoro_sessions").upsert({ date, count: newCount }, { onConflict: "date" });
      if (error) throw error;
    } catch (err) { console.error("Pomo session error:", err); }
  }, [data]);

  // ─── Weekly Notes Operations ───

  const updateWeeklyNotes = useCallback(async (weekStart, notes) => {
    const updated = { ...data, weeklyNotes: { ...(data.weeklyNotes || {}), [weekStart]: notes } };
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("weekly_notes").upsert(
        { week_start: weekStart, notes, updated_at: new Date().toISOString() },
        { onConflict: "week_start" }
      );
      if (error) throw error;
    } catch (err) { console.error("Weekly notes error:", err); }
  }, [data]);

  // ─── Cycle Theme Operations ───

  // Returns true on success so the UI can show a failure message
  const updateCycleTheme = useCallback(async (cycleStart, theme) => {
    try {
      const { error } = await supabase.from("cycle_themes").upsert(
        { cycle_start: cycleStart, theme, updated_at: new Date().toISOString() },
        { onConflict: "cycle_start" }
      );
      if (error) throw error;
      const updated = { ...data, themes: { ...(data.themes || {}), [cycleStart]: theme } };
      setData(updated); saveLocal(updated);
      return true;
    } catch (err) {
      console.error("Cycle theme error:", err);
      return false;
    }
  }, [data]);

  // ─── Reminder Operations ───

  const addReminder = useCallback(async (title, dueDate, alertDays = [7, 1], notes = "") => {
    const tempId = Date.now();
    const newReminder = { id: tempId, title, dueDate, notes, alertDays, notifiedDays: [], done: false, createdAt: tempId };
    const updated = { ...data, reminders: [...(data.reminders || []), newReminder] };
    setData(updated); saveLocal(updated);
    try {
      const { data: inserted, error } = await supabase
        .from("reminders")
        .insert({ title, due_date: dueDate, notes, alert_days: alertDays, notified_days: [], done: false })
        .select().single();
      if (error) throw error;
      const synced = { ...updated, reminders: updated.reminders.map((r) => r.id === tempId ? { ...r, id: inserted.id } : r) };
      setData(synced); saveLocal(synced);
    } catch (err) { console.error("Add reminder error:", err); }
  }, [data]);

  const updateReminder = useCallback(async (reminderId, updates) => {
    const updated = { ...data, reminders: (data.reminders || []).map((r) => r.id === reminderId ? { ...r, ...updates } : r) };
    setData(updated); saveLocal(updated);
    try {
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.alertDays !== undefined) dbUpdates.alert_days = updates.alertDays;
      if (updates.done !== undefined) dbUpdates.done = updates.done;
      const { error } = await supabase.from("reminders").update(dbUpdates).eq("id", reminderId);
      if (error) throw error;
    } catch (err) { console.error("Update reminder error:", err); }
  }, [data]);

  const deleteReminder = useCallback(async (reminderId) => {
    const updated = { ...data, reminders: (data.reminders || []).filter((r) => r.id !== reminderId) };
    setData(updated); saveLocal(updated);
    try {
      const { error } = await supabase.from("reminders").delete().eq("id", reminderId);
      if (error) throw error;
    } catch (err) { console.error("Delete reminder error:", err); }
  }, [data]);

  return {
    data, syncing, error,
    addTask, toggleTask, deleteTask, updateTask,
    addGoal, removeGoal,
    addPomoSession,
    updateWeeklyNotes,
    updateCycleTheme,
    addReminder, updateReminder, deleteReminder,
    refresh: () => syncFromRemote(true),
  };
}
