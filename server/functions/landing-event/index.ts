import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EVENTS: Record<string, number> = {
  landing_view: 1,
  builder_started: 2,
  order_type_selected: 2,
  ration_configured: 3,
  checkout_clicked: 4,
  checkout_viewed: 5,
  contact_started: 6,
  submit_attempted: 7,
  submit_failed: 7,
  lead_created: 8,
};

const ALLOWED_ORIGINS = new Set(["https://macromill.ru", "https://www.macromill.ru"]);
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://macromill.ru",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 300) => String(value ?? "").slice(0, max);

function safeConfiguration(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  for (const key of ["order_type", "tier", "goal", "days", "items_count", "meals_per_day", "total_text"]) {
    if (source[key] !== undefined) result[key] = typeof source[key] === "number" ? source[key] : text(source[key], 120);
  }
  return result;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405, headers });

  try {
    const body = await req.json();
    const sessionId = text(body.session_id, 40);
    const visitorId = text(body.visitor_id, 40);
    const eventId = text(body.event_id, 40);
    const eventName = text(body.event_name, 40);
    const stage = EVENTS[eventName];

    if (!UUID.test(sessionId) || !UUID.test(visitorId) || !UUID.test(eventId) || !stage) {
      return new Response(JSON.stringify({ ok: false, error: "invalid event" }), { status: 400, headers });
    }

    const path = text(body.path || "/", 300);
    const configuration = safeConfiguration(body.configuration);
    const context = body.context && typeof body.context === "object" ? body.context as Record<string, unknown> : {};

    const { data: existing, error: readError } = await supabase
      .from("landing_sessions")
      .select("max_stage,status,configuration")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (readError) throw readError;

    const sessionRow = {
      visitor_id: visitorId,
      last_seen_at: new Date().toISOString(),
      last_path: path,
      last_event: eventName,
      max_stage: Math.max(Number(existing?.max_stage || 1), stage),
      configuration: { ...(existing?.configuration || {}), ...configuration },
      ...(eventName === "lead_created" ? { status: "converted", converted_at: new Date().toISOString() } : {}),
    };

    if (existing) {
      const { error } = await supabase.from("landing_sessions").update(sessionRow).eq("session_id", sessionId);
      if (error) throw error;
    } else {
      const params = context.params && typeof context.params === "object" ? context.params as Record<string, unknown> : {};
      const { error } = await supabase.from("landing_sessions").insert({
        session_id: sessionId,
        ...sessionRow,
        started_at: new Date().toISOString(),
        first_path: path,
        referrer: text(context.referrer, 500) || null,
        source: text(context.source, 120) || null,
        utm_source: text(params.utm_source, 120) || null,
        utm_medium: text(params.utm_medium, 120) || null,
        utm_campaign: text(params.utm_campaign, 160) || null,
        device_type: ["mobile", "tablet", "desktop"].includes(text(context.device_type, 20)) ? text(context.device_type, 20) : "unknown",
      });
      if (error) throw error;
    }

    const { error: eventError } = await supabase.from("landing_events").upsert({
      event_id: eventId,
      session_id: sessionId,
      event_name: eventName,
      stage,
      path,
      payload: configuration,
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (eventError) throw eventError;

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (error) {
    console.error("landing-event:", error);
    return new Response(JSON.stringify({ ok: false, error: "internal error" }), { status: 500, headers });
  }
});

