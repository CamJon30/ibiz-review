"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// The subscribe route only accepts requests from your signed-in session
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data?.session?.access_token || ""}`,
  };
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Reminders() {
  const [expanded, setExpanded] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState("default");

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setPushSupported(supported);

    if (supported) {
      setPermissionState(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID public key not set");
      return;
    }

    setLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (res.ok) {
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error("Subscribe failed:", error);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // Tell server to remove
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            action: "unsubscribe",
          }),
        });

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch (error) {
      console.error("Unsubscribe failed:", error);
    }
    setLoading(false);
  };

  if (!pushSupported) return null;

  // Collapsed view
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[#1a1a1a] transition-all hover:border-neutral-600 mb-4"
        style={{ background: "#0a0a0a" }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={isSubscribed ? "#E8C547" : "#444"} strokeWidth="1.5">
            <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6v3l-1 2h11l-1-2V6c0-2.5-2-4.5-4.5-4.5z" />
            <path d="M6.5 13a1.5 1.5 0 003 0" />
          </svg>
          <span className="text-xs text-neutral-400 font-medium">Reminders</span>
        </div>
        <span
          className="text-[10px] font-mono"
          style={{ color: isSubscribed ? "#E8C547" : "#555" }}
        >
          {isSubscribed ? "On" : "Off"}
        </span>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border border-[#1a1a1a] p-4 mb-4 transition-all"
      style={{ background: "#0f0f0f" }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={isSubscribed ? "#E8C547" : "#666"} strokeWidth="1.5">
            <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6v3l-1 2h11l-1-2V6c0-2.5-2-4.5-4.5-4.5z" />
            <path d="M6.5 13a1.5 1.5 0 003 0" />
          </svg>
          <span className="text-sm font-semibold text-neutral-300">Daily Reminders</span>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none px-1"
        >
          &minus;
        </button>
      </div>

      {/* Status */}
      {permissionState === "denied" ? (
        <div className="text-xs text-red-400 mb-3">
          Notifications are blocked. Enable them in your browser settings for this site, then reload.
        </div>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-neutral-400">Push notifications</span>
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={loading}
              className="relative w-10 h-[22px] rounded-full transition-all cursor-pointer"
              style={{
                background: isSubscribed ? "#E8C547" : "#333",
                opacity: loading ? 0.5 : 1,
              }}
            >
              <div
                className="w-4 h-4 rounded-full bg-black absolute top-[3px] transition-all"
                style={{ left: isSubscribed ? 21 : 3 }}
              />
            </button>
          </div>

          {isSubscribed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E8C547] shrink-0" />
                <span>7:00 AM</span>
                <span className="text-neutral-700 mx-1">/</span>
                <span className="text-neutral-400">Plan your day</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] shrink-0" />
                <span>12:00 PM</span>
                <span className="text-neutral-700 mx-1">/</span>
                <span className="text-neutral-400">Midday check-in</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] shrink-0" />
                <span>6:00 PM</span>
                <span className="text-neutral-700 mx-1">/</span>
                <span className="text-neutral-400">End of day review</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isSubscribed && permissionState !== "denied" && (
        <p className="text-[11px] text-neutral-600 leading-relaxed">
          Get three daily nudges: morning planning, midday check-in, and evening review.
          Works even when the browser is closed.
        </p>
      )}
    </div>
  );
}
