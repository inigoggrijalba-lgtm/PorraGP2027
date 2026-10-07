// Más › Noticias: titulares de los medios de MotoGP. Cada noticia se abre en la web de quien la publica.
import { useEffect, useState } from 'react';
import { loadNews, now } from '../store.js';
import { ago } from '../time.js';
import { Offline, TopBar } from '../ui.jsx';

const ORDER = ['Motorsport.com', 'Motosan', 'Crash.net', 'GPOne', 'The Race'];
const LANGS = { en: 'inglés', it: 'italiano', fr: 'francés', de: 'alemán' };
const PAGE = 25;

// Las fotos se piden ya recortadas y ligeras a un servicio de imágenes, no al medio.
const picture = (url, w, h) => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=${w}&h=${h}&fit=cover&a=attention&output=webp&q=75`;
// Quien lo active abre las noticias en otro idioma ya traducidas con el traductor web de Google.
const translatedLink = (item) => `https://translate.google.com/translate?sl=${item.lang}&tl=es&u=${encodeURIComponent(item.url)}`;

const KEY = 'porragp.noticias.traducir';
// Apagado de fábrica: lo normal es abrir la noticia en la web del medio, tal cual.
function readPref() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function Picture({ item, w, h, eager }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) return <span className="nph">{item.source}</span>;
  return <img src={picture(item.image, w, h)} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />;
}

export default function News() {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [again, setAgain] = useState(0);
  const [source, setSource] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [translate, setTranslate] = useState(readPref);

  useEffect(() => {
    let alive = true;
    loadNews()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState((s) => (s.data ? s : { status: 'error', data: null })));
    return () => {
      alive = false;
    };
  }, [again]);
  // Al volver a la app se vuelven a pedir (si han pasado unos minutos, llegan nuevas).
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && setAgain((n) => n + 1);
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  const all = (state.data && state.data.items) || [];
  const sources = ORDER.filter((s) => all.some((i) => i.source === s)).concat([...new Set(all.map((i) => i.source))].filter((s) => !ORDER.includes(s)));
  const list = source ? all.filter((i) => i.source === source) : all;
  const [first, ...rest] = list;
  const foreign = all.some((i) => i.lang !== 'es');
  const t = now();
  const href = (item) => (translate && item.lang !== 'es' ? translatedLink(item) : item.url);
  const note = (item) => (item.lang === 'es' ? '' : item.translated ? ' · Traducida' : ` · En ${LANGS[item.lang] || 'otro idioma'}`);
  const pick = (s) => {
    setSource(s);
    setShown(PAGE);
    window.scrollTo(0, 0);
  };
  const togglePref = () => {
    const next = !translate;
    setTranslate(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // sin almacenamiento, vale solo para esta visita
    }
  };

  return (
    <>
      <TopBar title="Noticias" back="mas" who={false} />
      <main className="main has-nav">
        <Offline />
        {state.status === 'loading' ? (
          <p className="muted" style={{ padding: 20 }}>
            Cargando las noticias…
          </p>
        ) : state.status === 'error' ? (
          <div className="hfail" style={{ padding: 20 }}>
            <span className="err-text">No se han podido cargar las noticias. Comprueba la conexión.</span>
            <button className="btn faint lit" onClick={() => setAgain((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : !all.length ? (
          <p className="muted" style={{ padding: 20 }}>
            Todavía no hay noticias. Se buscan nuevas cada 20 minutos.
          </p>
        ) : (
          <>
            <div style={{ padding: '12px 20px 0' }}>
              <div className="hdec nchips" role="group" aria-label="Medio">
                <button aria-pressed={!source} onClick={() => pick(null)}>
                  Todos
                </button>
                {sources.map((s) => (
                  <button key={s} aria-pressed={source === s} onClick={() => pick(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {first ? (
              <a className="nhero" href={href(first)} target="_blank" rel="noopener noreferrer">
                <span className="nhero-img">
                  <Picture item={first} w={700} h={380} eager />
                </span>
                <span className="nhero-body">
                  <span className="nmeta">
                    <span className="ntag">{first.source}</span>
                    <span>
                      {ago(first.at, t)}
                      {note(first)}
                    </span>
                  </span>
                  <span className="nhero-title">{first.title}</span>
                  {first.summary ? <span className="nhero-sum">{first.summary}</span> : null}
                </span>
              </a>
            ) : null}

            <div className="nlist">
              {rest.slice(0, shown).map((item) => (
                <a key={item.id} className="nrow" href={href(item)} target="_blank" rel="noopener noreferrer">
                  <span className="nthumb">
                    <Picture item={item} w={208} h={160} />
                  </span>
                  <span className="nrow-text">
                    <span className="nmeta">
                      {item.source} · {ago(item.at, t)}
                      {note(item)}
                    </span>
                    <span className="nrow-title">{item.title}</span>
                  </span>
                </a>
              ))}
            </div>
            {rest.length > shown ? (
              <div style={{ padding: '16px 20px 0' }}>
                <button className="btn wide" onClick={() => setShown((n) => n + PAGE)}>
                  Ver más noticias
                </button>
              </div>
            ) : null}

            {foreign ? (
              <div style={{ padding: '8px 20px 0' }}>
                <div className="swrow">
                  <span className="swtext">
                    <span>Abrir traducidas las noticias en inglés</span>
                    <small>Con el traductor de Google. Algunas redes de empresa lo bloquean.</small>
                  </span>
                  <button className="sw" role="switch" aria-checked={translate} aria-label="Abrir traducidas las noticias en inglés" onClick={togglePref}>
                    <span className={`sw-track ${translate ? 'on' : ''}`}>
                      <span className="sw-dot" />
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
            <p className="small muted" style={{ padding: '14px 20px 0' }}>
              Cada noticia se abre en la web del medio.
              {state.data.synced_at ? ` Última búsqueda: ${ago(state.data.synced_at, t)}.` : ''}
            </p>
          </>
        )}
      </main>
    </>
  );
}
