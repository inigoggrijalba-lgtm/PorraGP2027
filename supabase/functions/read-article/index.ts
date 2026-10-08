// Modo lectura de las noticias: descarga la página de una noticia de nuestra lista y devuelve
// solo su texto, sus ladillos y sus fotos, sin anuncios ni avisos de cookies.
// No se guarda nada: cada vez que alguien abre una noticia se descarga y se limpia en el momento.
import { Readability } from 'npm:@mozilla/readability@0.5.0';
import { parseHTML } from 'npm:linkedom@0.18.5';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, content-type, authorization, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const MAX_BYTES = 4_000_000;

type Block = { t: 'p' | 'h' | 'q' | 'li' | 'img'; text?: string; src?: string; cap?: string };

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json', ...extra } });

// Lo que ya se ha limpiado se recuerda unos minutos mientras la función siga despierta.
const memo = new Map<number, { at: number; body: unknown }>();

async function newsItem(token: string, id: number, apikey: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/news_item`, {
    method: 'POST',
    headers: { apikey, authorization: `Bearer ${apikey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_id: id }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || 'NOTICIA_NO_VALIDA');
  return data;
}

async function download(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'es-ES,es;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!/html/i.test(type)) throw new Error('NO_ES_HTML');
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('DEMASIADO_GRANDE');
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] || 'utf-8';
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = new TextDecoder().decode(buf);
    }
    return { html, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
// Igual, pero respeta los saltos de línea (<br>), que en las clasificaciones separan a cada piloto.
const lines = (s: string | null | undefined) =>
  (s || '').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();

function absolute(src: string | null | undefined, base: string) {
  if (!src) return '';
  const s = src.trim().split(/\s+/)[0];
  if (!s || s.startsWith('data:')) return '';
  try {
    const u = new URL(s, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

// La mejor dirección de una foto: algunas webs la cargan tarde y la esconden en data-src o srcset.
function imgSrc(img: Element, base: string) {
  const srcset = img.getAttribute('data-srcset') || img.getAttribute('srcset') || '';
  const biggest = srcset
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0])
    .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))[0]?.[0];
  return absolute(img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || biggest || img.getAttribute('src'), base);
}

const JUNK = /^(lee también|leer también|read also|read more|also read|more:|related:|te puede interesar|publicidad|advertisement|anuncio|suscríbete|subscribe|sigue a|follow us|compartir|share this)/i;

const STOP = /^(queremos tu opini[oó]n|comparte o guarda este art[ií]culo|¿te gustan las motos|tienes 2 opciones|\w+ joined the crash\.net team|redactora? (en|y) )/i;

function toBlocks(html: string, base: string): Block[] {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  for (const br of Array.from(document.querySelectorAll('br'))) br.replaceWith(document.createTextNode('\n'));
  const out: Block[] = [];
  const seenImg = new Set<string>();
  const walk = (el: Element) => {
    for (const node of Array.from(el.children)) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'p') {
        const text = lines(node.textContent);
        // Un párrafo que solo es una foto
        const img = node.querySelector('img');
        if (!text && img) {
          const src = imgSrc(img, base);
          if (src && !seenImg.has(src)) {
            seenImg.add(src);
            out.push({ t: 'img', src });
          }
        } else if (text.length > 1 && !JUNK.test(text)) out.push({ t: 'p', text });
      } else if (/^h[1-6]$/.test(tag)) {
        const text = clean(node.textContent);
        if (text && !JUNK.test(text)) out.push({ t: 'h', text });
      } else if (tag === 'blockquote') {
        // Los tuits incrustados llegan como citas con el texto del tuit; se quedan como cita.
        const text = clean(node.textContent);
        if (text) out.push({ t: 'q', text });
      } else if (tag === 'li') {
        const text = clean(node.textContent);
        if (text && !JUNK.test(text)) out.push({ t: 'li', text });
      } else if (tag === 'img' || tag === 'figure' || tag === 'picture') {
        const img = tag === 'img' ? node : node.querySelector('img');
        const src = img ? imgSrc(img, base) : '';
        const w = img ? parseInt(img.getAttribute('width') || '0') : 0;
        if (src && !seenImg.has(src) && (!w || w >= 200)) {
          seenImg.add(src);
          const cap = clean(node.querySelector('figcaption')?.textContent);
          out.push({ t: 'img', src, ...(cap ? { cap } : {}) });
        }
      } else if (['script', 'style', 'noscript', 'iframe', 'form', 'button', 'svg', 'video', 'audio'].includes(tag)) {
        continue;
      } else {
        walk(node);
      }
    }
  };
  walk(document.body);
  // Lo que viene después de estos bloques ya no es la noticia (encuestas, suscripciones, firma del autor).
  const end = out.findIndex((b) => b.t !== 'img' && STOP.test(b.text!));
  const kept = end < 0 ? out : out.slice(0, end);
  while (kept.length && kept[kept.length - 1].t === 'img' && !kept[kept.length - 1].cap) kept.pop();
  // Ficha del autor al final: su foto (sin pie) y un párrafo corto.
  const n = kept.length;
  if (n > 3 && kept[n - 2].t === 'img' && !kept[n - 2].cap && kept[n - 1].t === 'p' && kept[n - 1].text!.length < 500) kept.splice(n - 2, 2);
  // "Foto: …" justo debajo de una foto es su pie.
  const done: Block[] = [];
  for (const b of kept) {
    const prev = done[done.length - 1];
    if (b.t === 'p' && prev && prev.t === 'img' && !prev.cap && /^(foto|photo|fotos|image|imagen)\s*:/i.test(b.text!) && b.text!.length < 160) prev.cap = b.text;
    else done.push(b);
  }
  return done;
}

async function read(item: { id: number; url: string; title: string; image: string | null; source: string }) {
  const { html, finalUrl } = await download(item.url);
  const { document } = parseHTML(html);
  // Fuera lo que nunca es parte de la noticia antes de buscar el texto.
  for (const el of Array.from(document.querySelectorAll('script, style, noscript, iframe, form, nav, footer, aside, [aria-hidden="true"], [class*="cookie"], [id*="cookie"], [class*="newsletter"], [class*="related"], [class*="advert"], [class*="ad-slot"], [class*="social"], [class*="share"]'))) {
    el.remove();
  }
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content') || '';
  const art = new Readability(document as unknown as Document, { charThreshold: 300, keepClasses: false }).parse();
  if (!art || !art.content) throw new Error('SIN_TEXTO');
  let blocks = toBlocks(art.content, finalUrl);
  const hero = item.image || absolute(meta('meta[property="og:image"]'), finalUrl) || null;
  // Fuera la foto principal si se repite al principio del texto, y el título si se repite como ladillo.
  const norm = (s: string) => s.toLowerCase().replace(/\W+/g, '');
  const heroKey = hero ? hero.split('?')[0] : '';
  blocks = blocks.filter((b, i) => !(b.t === 'img' && i < 3 && heroKey && b.src!.split('?')[0] === heroKey));
  blocks = blocks.filter((b) => !(b.t === 'h' && norm(b.text!) === norm(art.title || '')));
  const words = blocks.filter((b) => b.t !== 'img').reduce((n, b) => n + b.text!.split(/\s+/).length, 0);
  if (words < 60) throw new Error('POCO_TEXTO');
  return {
    ok: true,
    id: item.id,
    url: finalUrl,
    source: item.source,
    byline: clean(art.byline).slice(0, 120) || null,
    image: hero,
    words,
    blocks: blocks.slice(0, 400),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'METODO' }, 405);
  let body: { token?: string; id?: number };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'PETICION' }, 400);
  }
  const id = Number(body.id);
  if (!body.token || !Number.isFinite(id)) return json({ ok: false, error: 'PETICION' }, 400);
  let item;
  try {
    item = await newsItem(body.token, id, req.headers.get('apikey') || ANON);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 403);
  }
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < 30 * 60e3) return json(hit.body, 200, { 'cache-control': 'private, max-age=600' });
  try {
    const out = await read(item);
    if (memo.size > 200) memo.clear();
    memo.set(id, { at: Date.now(), body: out });
    return json(out, 200, { 'cache-control': 'private, max-age=600' });
  } catch (e) {
    // La app abre entonces la noticia en la web del medio.
    return json({ ok: false, error: (e as Error).message || 'FALLO', url: item.url });
  }
});
