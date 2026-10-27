import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("LANDING_BOT_TOKEN") ?? "";
const CHAT_ID = Deno.env.get("LANDING_CHAT_ID") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_ORIGINS = new Set([
  "https://macromill.ru",
  "https://www.macromill.ru",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://macromill.ru",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function factsMap(order: Record<string, unknown>) {
  const map = new Map<string, string>();
  for (const row of Array.isArray(order.facts) ? order.facts : []) {
    if (Array.isArray(row) && row.length >= 2) map.set(clean(row[0], 80), clean(row[1], 300));
  }
  return map;
}

function safeOrder(value: unknown) {
  const order = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    orderType: clean(order.orderType, 30),
    name: clean(order.name, 120),
    phone: clean(order.phone, 40),
    total: clean(order.total, 80),
    method: clean(order.method, 80),
    destination: clean(order.destination, 600),
    firstDate: clean(order.firstDate, 20),
    timeSlot: clean(order.timeSlot, 80),
    comment: clean(order.comment, 1000),
    promo: clean(order.promo, 100),
    facts: Array.isArray(order.facts) ? order.facts.slice(0, 20) : [],
    menuDays: Array.isArray(order.menuDays) ? order.menuDays.slice(0, 31) : null,
    dishes: Array.isArray(order.dishes) ? order.dishes.slice(0, 100) : null,
  };
}

async function saveLead(body: Record<string, unknown>) {
  const sessionId = clean(body.session_id, 40);
  const visitorId = clean(body.visitor_id, 40);
  const order = safeOrder(body.order);
  const phoneDigits = order.phone.replace(/\D/g, "");

  // Older cached landing clients only send Telegram text. Keep them working,
  // but only structured, validated requests are written to the CRM.
  if (!UUID.test(sessionId) || !UUID.test(visitorId)) return { leadId: null, saved: false };
  if (!order.name || !/^(7|8)\d{10}$/.test(phoneDigits) || !["ration", "custom_dishes"].includes(order.orderType)) {
    throw new Error("invalid CRM lead");
  }

  const { data: prior, error: priorError } = await supabase
    .from("landing_leads")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (priorError) throw priorError;
  if (prior?.id) return { leadId: prior.id, saved: true };

  const facts = factsMap(order as unknown as Record<string, unknown>);
  const configuration = {
    order_type: order.orderType,
    tier: facts.get("Линейка") || null,
    goal: facts.get("Рацион") || null,
    days: Number.parseInt(facts.get("Срок питания") || facts.get("Дней питания") || "", 10) || null,
    items_count: order.dishes?.length || order.menuDays?.length || null,
    meals_per_day: facts.get("Блюд в день") || null,
    total_text: order.total,
  };
  const now = new Date().toISOString();
  const checkoutPath = order.orderType === "custom_dishes" ? "/dish-checkout.html" : "/checkout.html";
  const { error: sessionError } = await supabase.from("landing_sessions").upsert({
    session_id: sessionId,
    visitor_id: visitorId,
    last_seen_at: now,
    last_path: checkoutPath,
    status: "converted",
    max_stage: 8,
    last_event: "lead_created",
    configuration,
    converted_at: now,
  }, { onConflict: "session_id" });
  if (sessionError) throw sessionError;

  const firstDate = /^\d{4}-\d{2}-\d{2}$/.test(order.firstDate) ? order.firstDate : null;
  const { data: lead, error: leadError } = await supabase.from("landing_leads").insert({
    session_id: sessionId,
    customer_name: order.name,
    phone: order.phone,
    order_type: order.orderType,
    tier: configuration.tier,
    goal: configuration.goal,
    days: configuration.days,
    meals_per_day: configuration.meals_per_day,
    total_text: order.total,
    fulfillment_method: order.method,
    destination: order.destination,
    first_date: firstDate,
    time_slot: order.timeSlot || null,
    promo: order.promo || null,
    comment: order.comment || null,
    order_data: order,
    is_test: false,
  }).select("id").single();
  if (leadError) throw leadError;

  const { error: eventError } = await supabase.from("landing_events").insert({
    event_id: crypto.randomUUID(),
    session_id: sessionId,
    event_name: "lead_created",
    stage: 8,
    path: checkoutPath,
    payload: configuration,
  });
  if (eventError) throw eventError;
  return { leadId: lead.id, saved: true };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  if (!BOT_TOKEN || !CHAT_ID) return new Response(JSON.stringify({ ok: false, error: "service unavailable" }), { status: 503, headers: jsonHeaders });

  try {
    const body = await req.json() as Record<string, unknown>;
    const text = clean(body.text, 12001);
    if (!text || text.length > 12000) return new Response(JSON.stringify({ ok: false, error: "invalid text" }), { status: 400, headers: jsonHeaders });

    const [tgResult, crmResult] = await Promise.allSettled([
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
      }).then(async (response) => ({ response, data: await response.json() })),
      saveLead(body),
    ]);

    if (crmResult.status === "rejected") console.error("landing-lead CRM:", crmResult.reason);
    if (tgResult.status === "rejected" || !tgResult.value.response.ok || !tgResult.value.data.ok) {
      return new Response(JSON.stringify({ ok: false, error: "telegram delivery failed" }), { status: 502, headers: jsonHeaders });
    }
    const crm = crmResult.status === "fulfilled" ? crmResult.value : { leadId: null, saved: false };
    return new Response(JSON.stringify({ ok: true, lead_id: crm.leadId, crm_saved: crm.saved }), { headers: jsonHeaders });
  } catch (error) {
    console.error("landing-lead:", error);
    return new Response(JSON.stringify({ ok: false, error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
