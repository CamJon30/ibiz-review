import { createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
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
