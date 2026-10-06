// Sincroniza el calendario, las sesiones y los resultados de MotoGP con la base de datos.
// La base de datos decide qué hay que pedir (sync_plan) y guarda lo que llega (sync_ingest).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API = "https://api.motogp.pulselive.com/motogp/v1";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CATEGORIES = ["MotoGP", "Moto2", "Moto3"];

// deno-lint-ignore no-explicit-any
type Any = any;

async function api(path: string): Promise<Any> {
  const r = await fetch(API + path, {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (PorraGP sync)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`MotoGP ${r.status} ${path}`);
  return await r.json();
}

async function rpc(name: string, args: Record<string, unknown>): Promise<Any> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`RPC ${name} ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// Los PDF de cada sesión llegan como texto o como { url }: nos quedamos con la dirección.
function fileUrls(files: Any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!files || typeof files !== "object") return out;
  for (const [key, value] of Object.entries(files)) {
    const url = typeof value === "string" ? value : (value as Any)?.url;
    if (typeof url === "string" && url.startsWith("http")) out[key] = url;
  }
  return out;
}

function row(c: Any) {
  return {
    pos: c.position ?? null,
    rider_uuid: c.rider?.riders_api_uuid ?? c.rider?.id ?? null,
    legacy_id: c.rider?.legacy_id ?? null,
    full_name: c.rider?.full_name ?? null,
    number: c.rider?.number ?? null,
    country: c.rider?.country?.iso ?? null,
    team: c.team?.name ?? null,
    constructor: c.constructor?.name ?? null,
    time: c.time ?? c.best_lap?.time ?? null,
    gap: c.gap?.first ?? null,
    gap_lap: c.gap?.lap ?? null,
    laps: c.total_laps ?? null,
    top_speed: c.top_speed ?? null,
    points: c.points ?? null,
    status: c.status ?? null,
  };
}

// Fotos de los pilotos de MotoGP, una vez al día. Si falla, no afecta al resto de la sincronización.
async function syncPhotos(secret: string): Promise<Any> {
  try {
    const plan = await rpc("sync_riders_plan", { p_secret: secret });
    if (!plan?.due) return null;
    // Equipos y pilotos usan otros identificadores de categoría que los resultados.
    const cats = await api(`/categories?seasonYear=${plan.season}`);
    const gp = cats.find((c: Any) => String(c.name).replace(/[™®]/g, "").trim() === "MotoGP");
    if (!gp) return { error: "sin categoría MotoGP" };
    const teams = await api(`/teams?categoryUuid=${gp.id}&seasonYear=${plan.season}`);
    const riders = teams.flatMap((t: Any) =>
      (t.riders ?? []).map((r: Any) => ({
        rider_uuid: r.id,
        legacy_id: r.legacy_id ?? null,
        photo: r.current_career_step?.pictures?.profile?.main ?? null,
      }))
    );
    return await rpc("sync_riders_ingest", { p_secret: secret, p: { riders } });
  } catch (err) {
    return { error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-sync-secret") ?? "";
  if (!secret) return new Response("No autorizado", { status: 401 });

  const rounds: Any[] = [];
  try {
    for (let round = 0; round < 3; round++) {
      const plan = await rpc("sync_plan", { p_secret: secret });
      const payload: Any = {};
      const errors: string[] = [];
      let work = 0;

      let seasonUuid: string | null = plan.season_uuid ?? null;
      if (!seasonUuid) {
        const seasons = await api("/results/seasons");
        seasonUuid = seasons.find((s: Any) => s.year === plan.season)?.id ?? null;
        payload.season_uuid = seasonUuid;
        work++;
      }

      let cats: Record<string, string> = plan.categories ?? {};
      if (seasonUuid && CATEGORIES.some((c) => !cats[c])) {
        const list = await api(`/results/categories?seasonUuid=${seasonUuid}`);
        cats = {};
        for (const c of list) {
          const name = String(c.name).replace(/[™®]/g, "").trim();
          if (CATEGORIES.includes(name)) cats[name] = c.id;
        }
        payload.categories = cats;
        work++;
      }

      if (seasonUuid && plan.refresh_events) {
        const [finished, pending] = await Promise.all([
          api(`/results/events?seasonUuid=${seasonUuid}&isFinished=true`),
          api(`/results/events?seasonUuid=${seasonUuid}&isFinished=false`),
        ]);
        const map = (e: Any, done: boolean) => ({
          api_uuid: e.id,
          short_name: e.short_name,
          name: e.name,
          sponsored_name: e.sponsored_name ?? null,
          date_start: e.date_start ?? null,
          date_end: e.date_end ?? null,
          finished: done,
        });
        payload.events = [
          ...finished.filter((e: Any) => !e.test).map((e: Any) => map(e, true)),
          ...pending.filter((e: Any) => !e.test).map((e: Any) => map(e, false)),
        ];
        work++;
      }

      const wantSessions: Any[] = plan.fetch_sessions ?? [];
      if (wantSessions.length && Object.keys(cats).length) {
        const jobs = wantSessions.flatMap((e) => CATEGORIES.filter((c) => cats[c]).map((c) => ({ e, c })));
        const lists = await pool(jobs, 6, async ({ e, c }) => {
          try {
            const list = await api(`/results/sessions?eventUuid=${e.event_api_uuid}&categoryUuid=${cats[c]}`);
            return list.map((s: Any) => ({
              event_api_uuid: e.event_api_uuid,
              category: c,
              api_uuid: s.id,
              type: s.type,
              number: s.number ?? null,
              date: s.date ?? null,
              status: s.status ?? null,
              condition: s.condition ?? null,
              files: fileUrls(s.session_files),
            }));
          } catch (err) {
            errors.push(String(err));
            return [];
          }
        });
        payload.sessions = lists.flat();
        payload.sessions_events = wantSessions.map((e) => e.event_api_uuid);
        work++;
      }

      const wantResults: string[] = plan.fetch_results ?? [];
      if (wantResults.length) {
        payload.results = await pool(wantResults, 6, async (id) => {
          try {
            const d = await api(`/results/session/${id}/classification?seasonYear=${plan.season}&test=false`);
            return { session_api_uuid: id, file: d.file ?? null, rows: (d.classification ?? []).map(row) };
          } catch (err) {
            errors.push(String(err));
            return { session_api_uuid: id, file: null, rows: [] };
          }
        });
        work++;
      }

      if (!work) break;
      payload.errors = errors;
      rounds.push(await rpc("sync_ingest", { p_secret: secret, p: payload }));
    }
    return Response.json({ ok: true, rounds, photos: await syncPhotos(secret) });
  } catch (err) {
    const message = String(err);
    try {
      await rpc("sync_note", { p_secret: secret, p_ok: false, p_detail: { error: message, rounds } });
    } catch (_) {
      // sin acceso a la base de datos no hay dónde anotarlo
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
