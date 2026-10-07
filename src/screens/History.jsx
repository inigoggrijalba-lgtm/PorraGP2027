// Más › Histórico: cualquier clasificación del Mundial. Temporada → categoría → gran premio → sesión.
import { useEffect, useMemo, useRef, useState } from 'react';
import { catName, catRank, catSlug, gpLabel, gpTitle, oldDate, oldTime, slugRank, sortCats } from '../history.js';
import { chipName, conditionText, fullName, isRace } from '../results.js';
import { resultImage } from '../share.js';
import { loadHistory } from '../store.js';
import { Icon, Offline, ShareSheet, TopBar, useData } from '../ui.jsx';
import { Files } from './MotoGP.jsx';

// Lo que hay elegido viaja en la dirección: #/mas/historico/1970/500cc/SPA/RAC
function fromHash() {
  const [, , year, slug, short, code] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const y = Number(year);
  return {
    year: Number.isInteger(y) && y > 1900 ? y : null,
    rank: slug ? slugRank(decodeURIComponent(slug)) ?? 0 : 0,
    short: short ? decodeURIComponent(short) : null,
    code: code ? decodeURIComponent(code) : null,
  };
}

const decadeOf = (year) => (year < 1960 ? 1949 : Math.floor(year / 10) * 10);

// Carga algo cada vez que cambia la clave. Sin clave, no hay nada que cargar.
function useLoad(key, load) {
  const [state, setState] = useState({ key: null, status: 'idle', data: null });
  const [again, setAgain] = useState(0);
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    setState({ key, status: 'loading', data: null });
    load()
      .then((data) => alive && setState({ key, status: 'ready', data }))
      .catch((err) => alive && setState({ key, status: err && err.code === 'HISTORICO_SIN_DATOS' ? 'empty' : 'error', data: null }));
    return () => {
      alive = false;
    };
  }, [key, again]);
  const mine = state.key === key;
  return { status: !key ? 'idle' : mine ? state.status : 'loading', data: key && mine ? state.data : null, retry: () => setAgain((n) => n + 1) };
}

function Step({ n, title, hint, children, innerRef }) {
  return (
    <section className="hstep" ref={innerRef}>
      <div className="hstep-head">
        <span className="hn">{n}</span>
        <h2 className="h2">{title}</h2>
        {hint ? <span className="small muted">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Failed({ what, onRetry }) {
  return (
    <div className="hfail">
      <span className="err-text">No se ha podido cargar {what}. Comprueba la conexión.</span>
      <button className="btn faint lit" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

export default function History() {
  const { d } = useData();
  const start = useRef(null);
  if (!start.current) start.current = fromHash();
  const [year, setYear] = useState(start.current.year);
  const [decade, setDecade] = useState(null);
  const [rank, setRank] = useState(start.current.rank);
  const [short, setShort] = useState(start.current.short);
  const [code, setCode] = useState(start.current.code);
  const [sharing, setSharing] = useState(false);
  const wantScroll = useRef(false);
  const stepFour = useRef(null);
  const strip = useRef(null);

  const all = useLoad('temporadas', () => loadHistory());
  const seasons = all.data ? all.data.seasons : [];
  const decades = useMemo(() => {
    const map = new Map();
    for (const s of seasons) {
      const from = decadeOf(s.year);
      if (!map.has(from)) map.set(from, { from, years: [] });
      map.get(from).years.push(s.year);
    }
    return [...map.values()]
      .map((g) => ({ ...g, years: g.years.sort((a, b) => a - b) }))
      .sort((a, b) => a.from - b.from)
      .map((g) => ({ ...g, label: `${g.years[0]}–${String(g.years[g.years.length - 1]).slice(2)}` }));
  }, [seasons]);
  const shownDecade = decades.find((g) => g.from === (decade ?? (year ? decadeOf(year) : -1))) || decades[decades.length - 1] || null;
  const season = seasons.find((s) => s.year === year) || null;

  const sea = useLoad(season ? season.id : null, () => loadHistory(season.id));
  const cats = sea.data ? sortCats(sea.data.categories) : [];
  const events = sea.data ? sea.data.events : [];
  const category = cats.find((c) => catRank(c) === rank) || cats[0] || null;
  const event = events.find((e) => e.short === short) || null;

  const ses = useLoad(season && event && category ? `${event.id}|${category.id}` : null, () => loadHistory(season.id, event.id, category.id));
  const sessions = ses.data ? ses.data.sessions : [];
  const session = sessions.find((s) => s.code === code) || [...sessions].reverse().find((s) => /^RAC/.test(s.code)) || sessions[sessions.length - 1] || null;

  const res = useLoad(session ? session.id : null, () => loadHistory(season.id, event.id, category.id, session.id));
  const rows = res.data ? res.data.result.rows : [];
  const race = !!session && isRace(session.code);
  const withPoints = race && rows.some((r) => r.points > 0);

  // La dirección sigue a lo elegido, para que recargar o compartir el enlace lleve al mismo sitio.
  useEffect(() => {
    const parts = ['mas', 'historico'];
    if (year) {
      parts.push(year);
      if (category) {
        parts.push(catSlug(category));
        if (event) {
          parts.push(event.short);
          if (session) parts.push(session.code);
        }
      }
    }
    const hash = `#/${parts.join('/')}`;
    if (window.location.hash !== hash && /^#\/mas\/historico/.test(window.location.hash)) window.history.replaceState(null, '', hash);
  }, [year, category && category.id, event && event.id, session && session.code]);

  useEffect(() => {
    const el = strip.current && strip.current.querySelector('[aria-pressed="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [shownDecade && shownDecade.from]);

  // Al elegir gran premio, la pantalla baja sola hasta la clasificación.
  useEffect(() => {
    if (!wantScroll.current || ses.status === 'loading' || ses.status === 'idle') return;
    wantScroll.current = false;
    if (stepFour.current) stepFour.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ses.status, event && event.id]);

  const pickYear = (y) => {
    setYear(y);
    setShort(null);
    setCode(null);
  };
  const title = event ? gpTitle(event, year) : '';
  const cond = session ? conditionText(session.condition) : '';
  const pdf = (res.data && res.data.result.file) || (session && session.files && session.files.classification) || null;
  const blanks = race && rows.some((r) => r.pos > 1 && !oldTime(r, true));

  return (
    <>
      <TopBar title="Histórico" back="mas" who={false} />
      <main className="main has-nav">
        <Offline />
        <Step n="1" title="Temporada" hint={seasons.length ? `Desde ${seasons[seasons.length - 1].year}` : null}>
          {all.status === 'loading' ? (
            <p className="muted">Cargando las temporadas…</p>
          ) : all.status !== 'ready' ? (
            <Failed what="el histórico" onRetry={all.retry} />
          ) : (
            <>
              <div className="hdec" ref={strip} role="group" aria-label="Década">
                {decades.map((g) => (
                  <button key={g.from} aria-pressed={shownDecade === g} onClick={() => setDecade(g.from)}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="hgrid c5 years" role="group" aria-label="Año">
                {(shownDecade ? shownDecade.years : []).map((y) => (
                  <button key={y} aria-pressed={y === year} onClick={() => pickYear(y)}>
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}
        </Step>

        {!year && all.status === 'ready' ? (
          <p className="muted" style={{ padding: '20px 20px 0' }}>
            Todas las clasificaciones del Mundial, carrera a carrera. Elige un año para empezar.
          </p>
        ) : null}

        {season ? (
          sea.status === 'loading' ? (
            <p className="muted" style={{ padding: '24px 20px 0' }}>
              Cargando la temporada {year}…
            </p>
          ) : sea.status !== 'ready' ? (
            <div style={{ padding: '24px 20px 0' }}>
              <Failed what={`la temporada ${year}`} onRetry={sea.retry} />
            </div>
          ) : (
            <>
              <Step n="2" title="Categoría" hint={`Las que hubo en ${year}`}>
                <div className={`hgrid c${Math.max(4, Math.min(5, cats.length))}`} role="group" aria-label="Categoría">
                  {cats.map((c) => (
                    <button key={c.id} aria-pressed={c === category} onClick={() => setRank(catRank(c))}>
                      {catName(c)}
                    </button>
                  ))}
                </div>
              </Step>
              <Step n="3" title="Gran Premio" hint={events.length ? `${events.length} en ${year}` : null}>
                {events.length ? (
                  <div className="hgrid c3" role="group" aria-label="Gran Premio">
                    {events.map((e) => (
                      <button
                        key={e.id}
                        aria-pressed={e === event}
                        onClick={() => {
                          wantScroll.current = true;
                          setShort(e.short);
                        }}
                      >
                        {gpLabel(e, year)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Todavía no se ha disputado ningún Gran Premio en {year}.</p>
                )}
              </Step>
            </>
          )
        ) : null}

        {event && category ? (
          <Step n="4" title="Sesión" innerRef={stepFour} hint={ses.status !== 'ready' || !sessions.length ? null : sessions.length === 1 && race ? 'Solo hay datos de carrera' : `${sessions.length} sesiones`}>
            {ses.status === 'loading' ? (
              <p className="muted">Cargando las sesiones…</p>
            ) : ses.status !== 'ready' ? (
              <Failed what="las sesiones" onRetry={ses.retry} />
            ) : !sessions.length ? (
              <p className="muted">
                En el {title} de {year} no hay resultados de {catName(category)}.
              </p>
            ) : (
              <div className="hdec red" role="group" aria-label="Sesión">
                {sessions.map((s) => (
                  <button key={s.id} aria-pressed={s === session} onClick={() => setCode(s.code)}>
                    {chipName(s.code)}
                  </button>
                ))}
              </div>
            )}
          </Step>
        ) : null}

        {session ? (
          <div className="hpanel">
            <div className="hpanel-head">
              <div style={{ minWidth: 0 }}>
                <div className="label">
                  {catName(category)} · {fullName(session.code)} · {oldDate(session.date)}
                </div>
                <h1 className="h1 s" style={{ marginTop: 2 }}>
                  {title}
                </h1>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {session.circuit || event.circuit}
                  {cond ? ` · ${cond}` : ''}
                </div>
              </div>
              <div className="hbtns">
                {pdf ? (
                  <a className="hbtn" href={pdf} target="_blank" rel="noopener noreferrer" aria-label="PDF oficial de la clasificación">
                    <Icon name="pdf" size={18} />
                  </a>
                ) : null}
                <button className="hbtn red" onClick={() => setSharing(true)} disabled={!rows.length} aria-label="Compartir esta clasificación">
                  <Icon name="share" size={18} stroke={2.4} />
                </button>
              </div>
            </div>
            <div className="hrows">
              {res.status === 'loading' ? (
                <p className="muted" style={{ padding: '16px 0' }}>
                  Cargando la clasificación…
                </p>
              ) : res.status === 'error' ? (
                <div style={{ padding: '16px 0' }}>
                  <Failed what="la clasificación" onRetry={res.retry} />
                </div>
              ) : !rows.length ? (
                <p className="muted" style={{ padding: '16px 0' }}>
                  MotoGP no conserva la clasificación de esta sesión.
                </p>
              ) : (
                rows.map((row, i) => {
                  const first = row.pos === 1;
                  return (
                    <div className="hrow" key={i}>
                      <div className={`rpos ${first ? 'first' : ''}`}>{row.pos ?? '–'}</div>
                      <div className="hname">
                        <span>{row.full_name}</span>
                        {row.country ? <small>{row.country}</small> : null}
                      </div>
                      <div className="hmoto">{typeof row.constructor === 'string' ? row.constructor : ''}</div>
                      <div className={`rtime ${first ? 'first' : ''}`}>{oldTime(row, race)}</div>
                      {withPoints ? <div className="rpts">{row.points || ''}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
            {rows.length ? (
              <p className="small muted" style={{ padding: '12px 0 0' }}>
                {blanks ? 'De esta carrera solo se conservan los tiempos de los primeros. ' : ''}
                Datos oficiales de MotoGP.
              </p>
            ) : null}
            <div style={{ margin: '0 -20px' }}>
              <Files files={session.files} except="classification" />
            </div>
          </div>
        ) : null}
      </main>
      {sharing && session ? (
        <ShareSheet
          title={`${chipName(session.code)} · ${title} ${year}`}
          name={`${catSlug(category)}-${session.code}-${event.short}-${year}.png`}
          make={() =>
            resultImage({
              event: { name: gpLabel(event, year), title: `${title} ${year}`, circuit: session.circuit || event.circuit },
              session: { category: catName(category), code: session.code, condition: session.condition, when: oldDate(session.date) },
              rows,
              d,
              old: true,
            })
          }
          onClose={() => setSharing(false)}
        />
      ) : null}
    </>
  );
}
