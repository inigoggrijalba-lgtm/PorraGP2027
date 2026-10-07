// Noticias de MotoGP. Lee los titulares que cada medio publica en su RSS, se queda con los de
// MotoGP, Moto2 y Moto3, traduce los que no están en castellano y los guarda en la base de datos.
// Solo se guarda el titular, una entradilla corta, la imagen y el enlace: la noticia se lee en el medio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "Mozilla/5.0 (compatible; PorraGP/1.0; +https://inigoggrijalba-lgtm.github.io/PorraGP2027/)";

// deno-lint-ignore no-explicit-any
type Any = any;
type Item = { source: string; guid: string; url: string; lang: string; title: string; summary: string | null; image: string | null; published_at: string; categories: string[]; title_es?: string | null; summary_es?: string | null };
type Feed = { source: string; url: string; lang: string; keep?: (it: Item) => boolean };

const TOPIC = /\/(motogp|moto2|moto3)\//i;
const FEEDS: Feed[] = [
  { source: "Motorsport.com", url: "https://es.motorsport.com/rss/motogp/news/", lang: "es" },
  { source: "Motosan", url: "https://www.motosan.es/feed/", lang: "es", keep: (it) => TOPIC.test(it.url) || it.categories.some((c) => /^moto(gp|2|3)$/i.test(c)) },
  { source: "Crash.net", url: "https://www.crash.net/rss/motogp", lang: "en", keep: (it) => TOPIC.test(it.url) },
  { source: "GPOne", url: "https://www.gpone.com/en/article-feed.xml", lang: "en", keep: (it) => TOPIC.test(it.url) },
  { source: "The Race", url: "https://www.the-race.com/category/motogp/feed/", lang: "en" },
];

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

// ---------- Lectura de los RSS ----------

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", iexcl: "¡", iquest: "¿",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü", ccedil: "ç",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù", euro: "€", ordm: "º", ordf: "ª", deg: "°",
};
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}
const uncdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
// Texto limpio de una etiqueta: sin CDATA, sin HTML y con los acentos en su sitio.
function plain(raw: string | null): string {
  if (!raw) return "";
  let s = decode(uncdata(raw));
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  return decode(s).replace(/\s+/g, " ").trim();
}
function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? m[1] : null;
}
function attrOf(el: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(el);
  return m ? decode(m[1]).trim() : null;
}
// Entradilla: unas 200 letras, sin el "Sigue leyendo" ni las coletillas que añade cada medio.
function lead(raw: string | null): string | null {
  let s = plain(raw);
  s = s.replace(/\s*La entrada\b.*\bse publicó primero en\b.*$/i, "");
  s = s.replace(/\s*(\.{3}|…)?\s*(Sigue leyendo|Leer más|Read more|Keep reading|Continue reading)\.?\s*$/i, "…");
  s = s.replace(/(…|\.{3})\s*…$/, "…").trim();
  if (s.length < 20) return null;
  if (s.length > 220) s = s.slice(0, 220).replace(/\s+\S*$/, "").replace(/[\s,;:.…]+$/, "") + "…";
  return s;
}
function cleanUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(decode(uncdata(raw)).trim());
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:") return null;
    for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.href;
  } catch (_) {
    return null;
  }
}
function when(raw: string): Date | null {
  let s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function imageOf(x: string): string | null {
  for (const m of x.matchAll(/<(enclosure|media:content|media:thumbnail)\b[^>]*>/gi)) {
    const url = attrOf(m[0], "url");
    const type = attrOf(m[0], "type") ?? attrOf(m[0], "medium") ?? "";
    if (url && (/image/i.test(type) || /\.(jpe?g|png|webp|avif)(\?|$)/i.test(url) || m[1].toLowerCase() === "media:thumbnail")) return cleanUrl(url);
  }
  const html = decode(uncdata(tag(x, "description") ?? ""));
  const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
  return img ? cleanUrl(img[1]) : null;
}

function parse(xml: string, feed: Feed, since: number): Item[] {
  const out: Item[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const x = m[0];
    const title = plain(tag(x, "title"));
    const url = cleanUrl(tag(x, "link"));
    const date = when(plain(tag(x, "pubDate")) || plain(tag(x, "dc:date")));
    if (!title || !url || !date || date.getTime() < since) continue;
    const item: Item = {
      source: feed.source,
      guid: plain(tag(x, "guid")) || url,
      url,
      lang: feed.lang,
      title,
      summary: lead(tag(x, "description")),
      image: imageOf(x),
      published_at: date.toISOString(),
      categories: [...x.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((c) => plain(c[1])),
    };
    if (!feed.keep || feed.keep(item)) out.push(item);
  }
  return out;
}

async function readFeed(feed: Feed, since: number): Promise<Item[]> {
  const r = await fetch(feed.url, {
    headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return parse((await r.text()).slice(0, 2_000_000), feed, since);
}

// Algunos medios no ponen la imagen en el RSS: se toma la que la propia noticia declara como portada.
async function coverOf(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const html = (await r.text()).slice(0, 400_000);
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
      if (/\b(property|name)\s*=\s*["'](og:image|og:image:secure_url|twitter:image)["']/i.test(m[0])) {
        const img = cleanUrl(attrOf(m[0], "content"));
        if (img) return img;
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

// ---------- Traducción ----------
// Dos servicios gratuitos, uno detrás de otro. Si un servicio falla una vez, no se le insiste más en esta pasada.

const used: Record<string, number> = {};
const down: Record<string, string> = {};
// Correo de contacto para MyMemory: con él da diez veces más cupo diario. Llega de la base de datos.
let contact = "";

async function viaGoogle(q: string, from: string): Promise<string | null> {
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=es&dt=t&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  const text = (j?.[0] ?? []).map((p: Any) => p?.[0] ?? "").join("").trim();
  return text || null;
}
async function viaMyMemory(q: string, from: string): Promise<string | null> {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 450))}&langpair=${from}|es${contact ? `&de=${encodeURIComponent(contact)}` : ""}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  const text = String(j?.responseData?.translatedText ?? "");
  if (String(j?.responseStatus) !== "200" || !text || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(text)) throw new Error(`cupo (${j?.responseStatus})`);
  return decode(text).trim();
}
const SERVICES: [string, (q: string, from: string) => Promise<string | null>][] = [["google", viaGoogle], ["mymemory", viaMyMemory]];

async function translate(q: string | null | undefined, from: string): Promise<string | null> {
  if (!q) return null;
  for (const [name, fn] of SERVICES) {
    if (down[name]) continue;
    try {
      const text = await fn(q, from);
      if (text) {
        used[name] = (used[name] ?? 0) + 1;
        return text;
      }
    } catch (err) {
      down[name] = String(err instanceof Error ? err.message : err).slice(0, 60);
    }
  }
  return null;
}

// ---------- Pasada ----------

Deno.serve(async (req: Request) => {
  const secret = req.headers.get("x-sync-secret") ?? "";
  if (!secret) return new Response("No autorizado", { status: 401 });
  for (const k of Object.keys(used)) delete used[k];
  for (const k of Object.keys(down)) delete down[k];
  const started = Date.now();
  const left = () => 100_000 - (Date.now() - started);
  try {
    const plan = await rpc("news_plan", { p_secret: secret });
    const known = new Set<string>(plan.known ?? []);
    contact = typeof plan.contact === "string" ? plan.contact : "";
    const since = Date.now() - 21 * 86400e3;

    const feeds: Record<string, number | string> = {};
    const lists = await Promise.all(
      FEEDS.map(async (f) => {
        try {
          const items = await readFeed(f, since);
          feeds[f.source] = items.length;
          return items;
        } catch (err) {
          feeds[f.source] = `fallo: ${String(err instanceof Error ? err.message : err).slice(0, 60)}`;
          return [] as Item[];
        }
      }),
    );
    const fresh = lists.flat().filter((it) => !known.has(`${it.source}|${it.guid}`))
      .sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 200);

    // Portadas que faltan: primero las de las noticias nuevas, luego las pendientes de otras pasadas.
    const noCover = fresh.filter((it) => !it.image).slice(0, 12);
    await pool(noCover, 4, async (it) => {
      it.image = await coverOf(it.url);
    });
    const updates = new Map<number, Any>();
    const edit = (id: number) => {
      if (!updates.has(id)) updates.set(id, { id });
      return updates.get(id);
    };
    await pool(((plan.no_image ?? []) as Any[]).slice(0, Math.max(0, 12 - noCover.length)), 4, async (p) => {
      const e = edit(p.id);
      e.img_tried = true;
      e.image = await coverOf(p.url);
    });

    // Primero todos los titulares, los nuevos antes que los pendientes. Después, si a los servicios
    // gratuitos les queda cupo, la entradilla de la noticia más reciente de cada medio, que es la
    // única que puede salir destacada.
    const titles: (() => Promise<void>)[] = [];
    const leads: (() => Promise<void>)[] = [];
    const withLead = new Set<string>();
    for (const it of fresh.filter((x) => x.lang !== "es").slice(0, 30)) {
      titles.push(async () => {
        it.title_es = await translate(it.title, it.lang);
      });
      if (it.summary && !withLead.has(it.source)) {
        withLead.add(it.source);
        leads.push(async () => {
          if (it.title_es) it.summary_es = await translate(it.summary, it.lang);
        });
      }
    }
    for (const p of ((plan.untranslated ?? []) as Any[]).slice(0, Math.max(0, 30 - titles.length))) {
      const e = edit(p.id);
      titles.push(async () => {
        e.title_es = await translate(p.title, p.lang);
        // Si los dos servicios están caídos no cuenta como intento: se probará en la siguiente pasada.
        e.tr_tried = !!e.title_es || Object.keys(down).length < SERVICES.length;
      });
      if (p.summary && !withLead.has(p.source)) {
        withLead.add(p.source);
        leads.push(async () => {
          if (e.title_es) e.summary_es = await translate(p.summary, p.lang);
        });
      }
    }
    const run = async (job: () => Promise<void>) => {
      if (left() > 15_000 && Object.keys(down).length < SERVICES.length) await job();
    };
    await pool(titles, 2, run);
    await pool(leads, 2, run);

    const status = { feeds, fresh: fresh.length, translated: used, down, took_ms: Date.now() - started };
    const saved = await rpc("news_ingest", {
      p_secret: secret,
      p_items: fresh.map(({ categories: _c, ...rest }) => rest),
      p_updates: [...updates.values()],
      p_status: status,
    });
    return Response.json({ ok: true, ...status, ...saved });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
