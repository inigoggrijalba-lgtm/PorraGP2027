// Envía los avisos al móvil. La base de datos decide cuáles tocan (push_plan);
// aquí solo se cifran, se mandan al servicio de avisos de cada móvil y se anota el resultado.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { generateVapidKeys, send, type VapidKeys } from "./webpush.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Contacto que piden los servicios de avisos para identificar a quien envía.
const SUBJECT = "https://inigoggrijalba-lgtm.github.io/PorraGP2027/";

// deno-lint-ignore no-explicit-any
type Any = any;

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

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-sync-secret") ?? "";
  if (!secret) return new Response("No autorizado", { status: 401 });
  try {
    const plan = await rpc("push_plan", { p_secret: secret });
    let keys: VapidKeys | null = plan.vapid;
    if (!keys) {
      // Primera vez: se crean las claves del servidor y se guardan en la base de datos.
      const fresh = await generateVapidKeys();
      keys = await rpc("push_keys", { p_secret: secret, p_public: fresh.publicKey, p_private: fresh.privateJwk });
    }
    const items: Any[] = plan.items ?? [];
    if (!items.length || !keys) return Response.json({ ok: true, sent: 0 });

    const results: { id: number; status: number }[] = [];
    // De cuatro en cuatro, para no saturar a nadie.
    for (let i = 0; i < items.length; i += 4) {
      const batch = items.slice(i, i + 4);
      const done = await Promise.all(
        batch.map(async (it) => {
          try {
            return { id: it.id, status: await send({ endpoint: it.endpoint, p256dh: it.p256dh, auth: it.auth }, it.payload, keys!, SUBJECT, it.ttl) };
          } catch (_) {
            return { id: it.id, status: 0 };
          }
        }),
      );
      results.push(...done);
    }
    await rpc("push_done", { p_secret: secret, p: results });
    return Response.json({ ok: true, sent: results.filter((r) => r.status >= 200 && r.status < 300).length, failed: results.filter((r) => r.status < 200 || r.status >= 300).length });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
