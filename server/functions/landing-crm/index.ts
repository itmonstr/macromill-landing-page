import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const CRM_KEY = Deno.env.get("LANDING_CRM_KEY") ?? "";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const STAGES = [
  [1, "Открыли лендинг"],
  [2, "Начали собирать заказ"],
  [3, "Сформировали рацион"],
  [4, "Нажали «Оформить»"],
  [5, "Открыли оформление"],
  [6, "Начали вводить контакты"],
  [7, "Попытались отправить"],
  [8, "Создали заявку"],
] as const;

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405, headers: JSON_HEADERS });
  if (!CRM_KEY || req.headers.get("x-crm-key") !== CRM_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
  }

  try {
    const [{ data: sessions, error: sessionsError }, { data: events, error: eventsError }, { data: leads, error: leadsError }] = await Promise.all([
      supabase.from("landing_sessions").select("*").order("last_seen_at", { ascending: false }).limit(500),
      supabase.from("landing_events").select("event_id,session_id,event_name,stage,path,payload,created_at").order("created_at", { ascending: false }).limit(1500),
      supabase.from("landing_leads").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (sessionsError) throw sessionsError;
    if (eventsError) throw eventsError;
    if (leadsError) throw leadsError;

    const now = Date.now();
    const abandonedAfterMs = 2 * 60 * 1000;
    const enrichedSessions = (sessions || []).map((session) => ({
      ...session,
      display_status: session.status === "converted"
        ? "converted"
        : now - new Date(session.last_seen_at).getTime() >= abandonedAfterMs
        ? "abandoned"
        : "active",
    }));

    const funnel = STAGES.map(([stage, label]) => {
      const count = enrichedSessions.filter((session) => Number(session.max_stage) >= stage).length;
      return { stage, label, count };
    }).map((row, index, rows) => ({
      ...row,
      conversion_from_previous: index === 0 || rows[index - 1].count === 0
        ? null
        : Math.round((row.count / rows[index - 1].count) * 1000) / 10,
      dropoff_from_previous: index === 0 ? 0 : Math.max(0, rows[index - 1].count - row.count),
    }));

    const leadBySession = new Map((leads || []).map((lead) => [lead.session_id, lead]));
    const deviceMap = new Map<string, any>();
    for (const session of enrichedSessions) {
      const key = session.visitor_id;
      const current = deviceMap.get(key) || {
        visitor_id: key,
        device_types: new Set<string>(),
        sessions_count: 0,
        lead_count: 0,
        first_seen_at: session.started_at,
        last_seen_at: session.last_seen_at,
        latest_session_id: session.session_id,
        latest_status: session.display_status,
        max_stage: 0,
        last_event: session.last_event,
        sources: new Set<string>(),
      };
      if (session.device_type) current.device_types.add(session.device_type);
      if (session.utm_source || session.source) current.sources.add(session.utm_source || session.source);
      current.sessions_count += 1;
      if (leadBySession.has(session.session_id)) current.lead_count += 1;
      if (new Date(session.started_at).getTime() < new Date(current.first_seen_at).getTime()) current.first_seen_at = session.started_at;
      if (new Date(session.last_seen_at).getTime() > new Date(current.last_seen_at).getTime()) {
        current.last_seen_at = session.last_seen_at;
        current.latest_session_id = session.session_id;
        current.latest_status = session.display_status;
        current.last_event = session.last_event;
      }
      current.max_stage = Math.max(current.max_stage, Number(session.max_stage || 0));
      deviceMap.set(key, current);
    }
    const devices = Array.from(deviceMap.values()).map((device) => ({
      ...device,
      device_types: Array.from(device.device_types),
      sources: Array.from(device.sources),
    })).sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());
    const deviceTypes = ["desktop", "mobile", "tablet", "unknown"].map((type) => ({
      type,
      devices: devices.filter((device) => type === "unknown" ? !device.device_types.length : device.device_types.includes(type)).length,
      sessions: enrichedSessions.filter((session) => type === "unknown" ? !session.device_type : session.device_type === type).length,
      leads: enrichedSessions.filter((session) => (type === "unknown" ? !session.device_type : session.device_type === type) && leadBySession.has(session.session_id)).length,
    })).filter((row) => row.devices || row.sessions || row.leads);

    return new Response(JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      abandonment_minutes: 2,
      summary: {
        sessions: enrichedSessions.length,
        devices: devices.length,
        active: enrichedSessions.filter((row) => row.display_status === "active").length,
        abandoned: enrichedSessions.filter((row) => row.display_status === "abandoned").length,
        converted: enrichedSessions.filter((row) => row.display_status === "converted").length,
        leads: (leads || []).length,
        conversion_rate: enrichedSessions.length ? Math.round(((leads || []).length / enrichedSessions.length) * 1000) / 10 : 0,
      },
      funnel,
      device_summary: deviceTypes,
      devices,
      leads: leads || [],
      sessions: enrichedSessions,
      events: events || [],
    }), { headers: JSON_HEADERS });
  } catch (error) {
    console.error("landing-crm:", error);
    return new Response(JSON.stringify({ ok: false, error: "internal error" }), { status: 500, headers: JSON_HEADERS });
  }
});

