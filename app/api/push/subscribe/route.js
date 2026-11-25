import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// Only the signed-in owner may add or remove push subscriptions.
// Ownership is decided by public.is_owner() in Supabase (see supabase/006_lock_down_rls.sql).
async function isOwner(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await userClient.rpc("is_owner");
  return !error && data === true;
}

export async function POST(request) {
  try {
    if (!(await isOwner(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription, action } = body;

    const supabase = createServerClient();

    if (action === "unsubscribe") {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);
      return NextResponse.json({ success: true });
    }

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Upsert subscription
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        subscription: subscription,
      },
      { onConflict: "endpoint" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
