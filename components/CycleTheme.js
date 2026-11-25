"use client";

import { useState, useEffect, useRef } from "react";

export default function CycleTheme({ theme, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(theme || "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef(null);

  // Keep the text in sync with saved data whenever we are not editing
  useEffect(() => { if (!editing) setText(theme || ""); }, [theme, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave(text.trim());
    setSaving(false);
    if (ok) setEditing(false);
    else setFailed(true);
  };

  const cancel = () => {
    setText(theme || "");
    setFailed(false);
    setEditing(false);
  };

  return (
    <div className="bg-[#0f0f0f] border border-surface-3 rounded-xl p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-neutral-300">12 Week Theme</h3>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-[11px] text-neutral-500 font-mono border border-neutral-700 rounded-md px-2.5 py-1 hover:text-neutral-300 transition-colors">
            {theme ? "Edit" : "+ Theme"}
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} rows={2}
            placeholder="What is this 12 weeks about?"
            className="w-full bg-surface-1 border border-surface-4 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-neutral-600 font-mono">{text.length}/200</span>
            <div className="flex gap-2">
              <button onClick={cancel} disabled={saving}
                className="text-[11px] text-neutral-500 font-mono border border-neutral-700 rounded-md px-3 py-1.5 hover:text-neutral-300 transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="text-[11px] text-black font-mono font-semibold bg-gold rounded-md px-3 py-1.5">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {failed && (
            <p className="text-[11px] text-red-400 mt-2">Save failed. Check your connection and that the cycle_themes table exists in Supabase.</p>
          )}
        </div>
      ) : theme ? (
        <p className="text-base text-neutral-200 leading-relaxed whitespace-pre-wrap">{theme}</p>
      ) : (
        <p className="text-sm text-neutral-600 text-center py-2">Give this cycle a theme so you remember why you are doing it.</p>
      )}
    </div>
  );
}
