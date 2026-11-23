import webpush from "web-push";
import { createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:hello@example.com";

// Get today's date in YYYY-MM-DD format (EST/EDT)
function getTodayEST() {
  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const y = est.getFullYear();
  const m = String(est.getMonth() + 1).padStart(2, "0");
  const d = String(est.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getESTHour() {
  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return est.getHours();
}

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  const supabase = createServerClient();
  const todayDate = getTodayEST();
  const estHour = getESTHour();

  // Get subscriptions
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ message: "No subscriptions", sent: 0 });
  }

  // Get today's tasks
  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("date", todayDate);

  // Get active reminders
  const { data: activeReminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("done", false);

  const tasks = todayTasks || [];
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const pendingTasks = totalTasks - doneTasks;
  const firstPending = tasks.find((t) => !t.done);
  const completionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Check milestones that need alerts today
  const todayDateObj = new Date(getTodayEST().replace(/-/g, "/"));
  const milestoneAlerts = (activeReminders || []).filter((r) => {
    const dueDate = new Date(r.due_date.replace(/-/g, "/"));
    const daysUntil = Math.ceil((dueDate - todayDateObj) / 86400000);
    const alertDays = r.alert_days || [7, 1];
    const notified = r.notified_days || [];
    return alertDays.some((d) => d === daysUntil && !notified.includes(daysUntil));
  });

  // Build milestone text for notifications
  let milestoneText = "";
  if (milestoneAlerts.length > 0) {
    const alerts = milestoneAlerts.map((r) => {
      const dueDate = new Date(r.due_date.replace(/-/g, "/"));
      const daysUntil = Math.ceil((dueDate - todayDateObj) / 86400000);
      return daysUntil === 0 ? `${r.title} is TODAY` : `${r.title} in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
    });
    milestoneText = alerts.join(". ") + ".";

    // Mark these as notified
    for (const r of milestoneAlerts) {
      const dueDate = new Date(r.due_date.replace(/-/g, "/"));
      const daysUntil = Math.ceil((dueDate - todayDateObj) / 86400000);
      const updatedNotified = [...(r.notified_days || []), daysUntil];
      await supabase.from("reminders").update({ notified_days: updatedNotified }).eq("id", r.id);
    }
  }

  // Build personalized reminder based on time of day
  let reminder;

  if (estHour >= 6 && estHour < 9) {
    // Morning
    let body = "";
    if (totalTasks === 0) {
      body = "No tasks set yet. Open your tracker and define today's priorities.";
    } else {
      body = firstPending
        ? `First up: ${firstPending.text}`
        : "All tasks already done! Add more or review your goals.";
    }
    if (milestoneText) body += ` | ${milestoneText}`;
    reminder = {
      title: milestoneAlerts.length > 0 && totalTasks === 0
        ? `Milestone alert`
        : `${totalTasks} tasks today`,
      body,
      tag: "morning-plan",
    };
  } else if (estHour >= 11 && estHour < 14) {
    // Midday
    if (totalTasks === 0) {
      reminder = {
        title: "Midday check-in",
        body: "You haven't set any tasks today. Still time to plan your afternoon.",
        tag: "midday-check",
      };
    } else {
      reminder = {
        title: `${doneTasks}/${totalTasks} tasks done`,
        body:
          pendingTasks > 0
            ? `${pendingTasks} remaining. Next: ${firstPending?.text || "Check your list"}`
            : `100% execution today. Keep the streak going.`,
        tag: "midday-check",
      };
    }
  } else if (estHour >= 17 && estHour < 20) {
    // Evening
    if (totalTasks === 0) {
      reminder = {
        title: "End of day",
        body: "No tasks were tracked today. Tomorrow's a fresh start.",
        tag: "evening-review",
      };
    } else {
      reminder = {
        title:
          completionRate === 100
            ? "100% execution today"
            : `${completionRate}% complete today`,
        body:
          completionRate === 100
            ? `All ${totalTasks} tasks done. Solid day.`
            : `${doneTasks} of ${totalTasks} done. ${pendingTasks} still open.`,
        tag: "evening-review",
      };
    }
  } else {
    // Outside normal reminder hours, but still send if milestones are firing
    if (milestoneAlerts.length > 0) {
      reminder = {
        title: "Milestone alert",
        body: milestoneText,
        tag: "milestone-alert",
      };
    } else {
      return NextResponse.json({
        message: "No reminder for this hour",
        estHour,
        sent: 0,
      });
    }
  }

  const payload = JSON.stringify({
    title: reminder.title,
    body: reminder.body,
    tag: reminder.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/" },
  });

  let sent = 0;
  let failed = 0;

  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (error) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", row.subscription.endpoint);
      }
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, reminder: reminder.tag, estHour });
}
