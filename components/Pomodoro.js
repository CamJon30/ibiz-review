"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MODES = {
  focus: { label: "Focus", color: "#E8C547", defaultMin: 25 },
  shortBreak: { label: "Short Break", color: "#4ADE80", defaultMin: 5 },
  longBreak: { label: "Long Break", color: "#60A5FA", defaultMin: 15 },
};

const POMO_STORAGE = "12wy-pomodoro-settings";

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(POMO_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { focus: 25, shortBreak: 5, longBreak: 15, autoBreak: true };
};

const saveSettings = (s) => {
  try { localStorage.setItem(POMO_STORAGE, JSON.stringify(s)); } catch {}
};

// Simple beep using Web Audio API
const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1000;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.8);
    }, 300);
  } catch {}
};

export default function Pomodoro({ onSessionComplete, todaySessions = 0 }) {
  const [settings, setSettings] = useState(loadSettings);
  const [mode, setMode] = useState("focus");
  const [timeLeft, setTimeLeft] = useState(settings.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [completedInRow, setCompletedInRow] = useState(0);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  const totalSeconds = settings[mode] * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;
  const modeConfig = MODES[mode];

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - ((totalSeconds - timeLeft) * 1000);
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = totalSeconds - elapsed;
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          setTimeLeft(0);
          setIsRunning(false);
          handleComplete();
        } else {
          setTimeLeft(remaining);
        }
      }, 250);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, mode, totalSeconds]);

  // Update document title with timer
  useEffect(() => {
    if (isRunning) {
      const mins = Math.floor(timeLeft / 60);
      const secs = timeLeft % 60;
      document.title = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} - ${modeConfig.label}`;
    } else {
      document.title = "12 Week Year Tracker";
    }
    return () => { document.title = "12 Week Year Tracker"; };
  }, [timeLeft, isRunning, modeConfig.label]);

  const handleComplete = useCallback(() => {
    playBeep();

    // Send browser notification
    if (Notification.permission === "granted") {
      new Notification(mode === "focus" ? "Focus session complete!" : "Break's over!", {
        body: mode === "focus" ? "Time for a break." : "Ready to focus again?",
        icon: "/icon-192.png",
      });
    }

    if (mode === "focus") {
      const newCount = completedInRow + 1;
      setCompletedInRow(newCount);
      if (onSessionComplete) onSessionComplete();

      if (settings.autoBreak) {
        // Every 4 focus sessions, take a long break
        const nextMode = newCount % 4 === 0 ? "longBreak" : "shortBreak";
        setMode(nextMode);
        setTimeLeft(settings[nextMode] * 60);
      }
    } else {
      // Break finished, go back to focus
      if (settings.autoBreak) {
        setMode("focus");
        setTimeLeft(settings.focus * 60);
      }
    }
  }, [mode, completedInRow, settings, onSessionComplete]);

  const switchMode = (newMode) => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    setMode(newMode);
    setTimeLeft(settings[newMode] * 60);
  };

  const toggleTimer = () => {
    if (!isRunning && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
    setTimeLeft(settings[mode] * 60);
  };

  const updateSetting = (key, value) => {
    const v = Math.max(1, Math.min(90, parseInt(value) || 1));
    const updated = { ...settings, [key]: v };
    setSettings(updated);
    saveSettings(updated);
    if (key === mode && !isRunning) {
      setTimeLeft(v * 60);
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Collapsed mini view
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all hover:border-neutral-600 mb-4"
        style={{
          background: isRunning ? "#0f0f0f" : "#0a0a0a",
          borderColor: isRunning ? modeConfig.color + "44" : "#1a1a1a",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isRunning ? modeConfig.color : "#333",
              boxShadow: isRunning ? `0 0 8px ${modeConfig.color}66` : "none",
              animation: isRunning ? "pulse 2s infinite" : "none",
            }}
          />
          <span className="text-xs text-neutral-400 font-medium">Pomodoro</span>
        </div>
        <div className="flex items-center gap-3">
          {todaySessions > 0 && (
            <span className="text-[10px] text-neutral-600 font-mono">{todaySessions} sessions</span>
          )}
          <span
            className="text-sm font-mono font-bold"
            style={{ color: isRunning ? modeConfig.color : "#666" }}
          >
            {display}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-4 mb-4 transition-all"
      style={{
        background: "#0f0f0f",
        borderColor: isRunning ? modeConfig.color + "33" : "#1a1a1a",
      }}
    >
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isRunning ? modeConfig.color : "#444",
              boxShadow: isRunning ? `0 0 8px ${modeConfig.color}66` : "none",
              animation: isRunning ? "pulse 2s infinite" : "none",
            }}
          />
          <span className="text-sm font-semibold text-neutral-300">Pomodoro</span>
          {todaySessions > 0 && (
            <span className="text-[10px] text-neutral-600 font-mono ml-1">
              {todaySessions} today
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-neutral-600 hover:text-neutral-400 transition-colors text-sm px-1"
            title="Settings"
          >
            &#9881;
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none px-1"
          >
            &minus;
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 mb-5">
        {Object.entries(MODES).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all"
            style={{
              background: mode === key ? cfg.color + "18" : "transparent",
              color: mode === key ? cfg.color : "#555",
              border: `1px solid ${mode === key ? cfg.color + "33" : "transparent"}`,
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        {/* Progress ring */}
        <div className="relative inline-block mb-2">
          <svg width="160" height="160" viewBox="0 0 160 160" className="block">
            <circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="4"
            />
            <circle
              cx="80" cy="80" r="70"
              fill="none"
              stroke={modeConfig.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={2 * Math.PI * 70 * (1 - progress / 100)}
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
              opacity={0.8}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-4xl font-bold font-mono tracking-tight"
              style={{ color: isRunning ? modeConfig.color : "#ddd" }}
            >
              {display}
            </span>
            <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest mt-1">
              {modeConfig.label}
            </span>
          </div>
        </div>

        {/* Session dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i < (completedInRow % 4) ? "#E8C547" : "#222",
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3 mb-2">
        <button
          onClick={resetTimer}
          className="px-4 py-2 text-xs font-medium text-neutral-500 border border-surface-4 rounded-lg hover:text-neutral-300 hover:border-neutral-600 transition-all"
        >
          Reset
        </button>
        <button
          onClick={toggleTimer}
          className="px-8 py-2 text-sm font-bold rounded-lg transition-all"
          style={{
            background: isRunning ? "transparent" : modeConfig.color,
            color: isRunning ? modeConfig.color : "#000",
            border: `2px solid ${modeConfig.color}`,
          }}
        >
          {isRunning ? "Pause" : timeLeft < totalSeconds && timeLeft > 0 ? "Resume" : "Start"}
        </button>
        <button
          onClick={() => {
            const nextMode = mode === "focus"
              ? (completedInRow % 4 === 3 ? "longBreak" : "shortBreak")
              : "focus";
            switchMode(nextMode);
          }}
          className="px-4 py-2 text-xs font-medium text-neutral-500 border border-surface-4 rounded-lg hover:text-neutral-300 hover:border-neutral-600 transition-all"
        >
          Skip
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-surface-3 animate-slide-down">
          <div className="grid grid-cols-3 gap-3 mb-3">
            {Object.entries(MODES).map(([key, cfg]) => (
              <div key={key}>
                <label className="text-[10px] text-neutral-600 uppercase tracking-wider block mb-1">
                  {cfg.label}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={settings[key]}
                    onChange={(e) => updateSetting(key, e.target.value)}
                    className="w-full bg-surface border border-surface-4 rounded-md px-2 py-1.5 text-xs text-neutral-300 font-mono outline-none focus:border-neutral-500 text-center"
                  />
                  <span className="text-[10px] text-neutral-600">m</span>
                </div>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => {
                const updated = { ...settings, autoBreak: !settings.autoBreak };
                setSettings(updated);
                saveSettings(updated);
              }}
              className="w-8 h-[18px] rounded-full transition-all relative cursor-pointer"
              style={{
                background: settings.autoBreak ? "#E8C547" : "#333",
              }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full bg-black absolute top-[2px] transition-all"
                style={{ left: settings.autoBreak ? 16 : 2 }}
              />
            </div>
            <span className="text-[11px] text-neutral-500">Auto-start breaks</span>
          </label>
        </div>
      )}
    </div>
  );
}
