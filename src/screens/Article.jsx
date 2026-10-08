// Más › Noticias › una noticia en modo lectura: el texto y las fotos, sin anuncios, cookies ni ventanas.
// Si no se puede preparar, se ofrece abrirla en la web del medio.
import { useEffect, useState } from 'react';
import { loadArticle, loadNews, newsFromList, now } from '../store.js';
import { ago } from '../time.js';
import { Icon, Offline, TopBar } from '../ui.jsx';
import { readPref, translatedLink } from './News.jsx';

const LANGS = { en: 'inglés', it: 'italiano', fr: 'francés', de: 'alemán' };
// Fotos a lo ancho, ya redimensionadas y ligeras.
const wide = (url, w) => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=${w}&output=webp&q=75`;

function Img({ src, cap, eager }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="art-fig">
      <img src={wide(src, 800)} alt={cap || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      {cap ? <figcaption>{cap}</figcaption> : null}
    </figure>
  );
}

function Body({ blocks }) {
  const out = [];
  let list = [];
  const flush = (key) => {
    if (list.length) out.push(<ul key={`ul${key}`}>{list}</ul>);
    list = [];
  };
  blocks.forEach((b, i) => {
    if (b.t === 'li') {
      list.push(<li key={i}>{b.text}</li>);
      return;
    }
    flush(i);
    if (b.t === 'p') out.push(<p key={i}>{b.text}</p>);
    else if (b.t === 'h') out.push(<h3 key={i}>{b.text}</h3>);
    else if (b.t === 'q') out.push(<blockquote key={i}>{b.text}</blockquote>);
    else if (b.t === 'img') out.push(<Img key={i} src={b.src} cap={b.cap} />);
  });
  flush('end');
  return <div className="art-body">{out}</div>;
}

export default function Article({ id }) {
  const [item, setItem] = useState(() => newsFromList(id));
  const [state, setState] = useState({ status: 'loading', data: null });
  const [again, setAgain] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    let alive = true;
    // Si se entra directo (al recargar), primero hace falta la lista para saber de qué noticia se trata.
    if (!item)
      loadNews()
        .then(() => alive && setItem(newsFromList(id)))
        .catch(() => null);
    setState({ status: 'loading', data: null });
    loadArticle(id)
      .then((data) => alive && setState({ status: data && data.ok ? 'ready' : 'fail', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => {
      alive = false;
    };
  }, [id, again]);

  const data = state.data;
  const url = (data && data.url) || (item && item.url) || '';
  const web = item && item.lang !== 'es' && readPref() ? translatedLink({ ...item, url }) : url;
  const source = (item && item.source) || (data && data.source) || 'Noticias';
  const image = (data && data.image) || (item && item.image);
  const foreign = item && item.lang && item.lang !== 'es';

  return (
    <>
      <TopBar title={source} back="mas/noticias" who={false} />
      <main className="main has-nav">
        <Offline />
        <article className="art">
          <div className="art-head">
            {item ? (
              <>
                <span className="nmeta">
                  <span className="ntag">{item.source}</span>
                  <span>{ago(item.at, now())}</span>
                  {data && data.byline ? <span>· {data.byline}</span> : null}
                </span>
                <h1 className="art-title">{item.title}</h1>
                {foreign ? (
                  <p className="art-note">
                    {item.translated ? 'Título traducido. ' : ''}El texto está en {LANGS[item.lang] || 'otro idioma'}, como lo publica el medio.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {/* La foto va debajo del titular. Si la noticia ya empieza con una foto, se usa esa (con su pie) y no se repite. */}
          {image && !(state.status === 'ready' && data.blocks.slice(0, 3).some((b) => b.t === 'img')) ? <Img src={image} eager /> : null}
          {state.status === 'loading' ? (
            <div className="art-wait" role="status" aria-label="Cargando la noticia">
              <i />
              <i />
              <i />
              <i className="short" />
              <span className="muted small">Preparando la noticia…</span>
            </div>
          ) : state.status === 'ready' ? (
            <Body blocks={data.blocks} />
          ) : (
            <div className="art-fail">
              <p className="muted">
                {state.status === 'error' ? 'No se ha podido cargar la noticia. Comprueba la conexión.' : 'Esta noticia no se puede leer aquí (puede ser de pago o un vídeo).'}
              </p>
              {state.status === 'error' ? (
                <button className="btn faint lit" onClick={() => setAgain((n) => n + 1)}>
                  Reintentar
                </button>
              ) : null}
            </div>
          )}

          {url ? (
            <div className="art-foot">
              <span className="small muted">Fuente: {source}</span>
              <a className={state.status === 'fail' ? 'cta m' : 'btn wide'} href={web} target="_blank" rel="noopener noreferrer">
                <span>{state.status === 'fail' ? `Abrir en ${source}` : 'Ver en la web'}</span>
                <Icon name="next" size={14} stroke={2.4} />
              </a>
            </div>
          ) : null}
        </article>
      </main>
    </>
  );
}
