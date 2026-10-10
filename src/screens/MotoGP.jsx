// Pestaña MotoGP: resultados de cada sesión, calendario de la temporada y horario completo.
import { useEffect, useRef, useState } from 'react';
import { sessionsOf } from '../data.js';
import { chipName, conditionText, fileList, isRace, rowRider, rowTimes, titleName } from '../results.js';
import { gridImage, resultImage, scheduleImage } from '../share.js';
import { loadEvent, loadGrid, loadResult, now } from '../store.js';
import { dateRange, dayKey, dayLong, dayMidCap, hm } from '../time.js';
import { cameFrom, GpNav, Icon, Offline, ShareSheet, TopBar, useData, useNow } from '../ui.jsx';

const CLASSES = ['MotoGP', 'Moto2', 'Moto3'];

export function Tabs({ current }) {
  return (
    <div className="tabs">
      <a href="#/motogp" aria-current={current === 'resultados' ? 'page' : undefined}>
        Resultados
      </a>
      <a href="#/motogp/calendario" aria-current={current === 'calendario' ? 'page' : undefined}>
        Calendario
      </a>
      <a href="#/motogp/mundial" aria-current={current === 'mundial' ? 'page' : undefined}>
        Mundial
      </a>
      <a href="#/motogp/pilotos" aria-current={current === 'pilotos' ? 'page' : undefined}>
        Pilotos
      </a>
    </div>
  );
}

// Fila de una clasificación o de la parrilla.
function Row({ pos, first, rider, time, sub, points }) {
  return (
    <div className="rrow">
      <div className={`rpos ${first ? 'first' : ''}`}>{pos}</div>
      <span className="plate rp" style={{ background: rider.color, color: rider.ink }}>
        {rider.number}
      </span>
      <div className="rname">
        <span>{rider.short}</span>
        <small>{rider.moto}</small>
      </div>
      <div className={`rtime ${first ? 'first' : ''}`}>
        <span>{time}</span>
        {sub ? <small>{sub}</small> : null}
      </div>
      {points === undefined ? null : <div className="rpts">{points || ''}</div>}
    </div>
  );
}

export function Files({ files, except }) {
  const list = fileList(files, except);
  if (!list.length) return null;
  return (
    <section className="sec">
      <h2 className="h2" style={{ marginBottom: 12 }}>
        Más PDF de la sesión
      </h2>
      <div className="chips">
        {list.map((f) => (
          <a key={f.key} className="btn faint lit" href={f.url} target="_blank" rel="noopener noreferrer">
            {f.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function Actions({ onShare, pdf, pdfLabel = 'PDF oficial' }) {
  return (
    <div className="two" style={{ marginTop: 0 }}>
      <button className="cta m" onClick={onShare} disabled={!onShare}>
        <Icon name="share" />
        <span>Compartir</span>
      </button>
      {pdf ? (
        <a className="btn" style={{ height: 48 }} href={pdf} target="_blank" rel="noopener noreferrer">
          <Icon name="pdf" />
          <span>{pdfLabel}</span>
        </a>
      ) : (
        <span className="btn quiet" style={{ height: 48, opacity: 0.5 }} aria-disabled="true">
          <Icon name="pdf" />
          <span>Sin PDF</span>
        </span>
      )}
    </div>
  );
}

function useLoaded(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null });
    load()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => {
      alive = false;
    };
  }, deps);
  return state;
}

function SessionView({ event, session }) {
  const { d } = useData();
  const t = useNow(30000);
  const [sharing, setSharing] = useState(false);
  const { status, data } = useLoaded(() => (session.has_result ? loadResult(session.id) : Promise.resolve(null)), [session.id, session.has_result]);
  const rows = (data && data.classification) || [];
  const race = isRace(session.code);
  const started = Date.parse(session.starts_at) <= t;
  const files = (data && data.files) || session.files || {};
  const cond = conditionText((data && data.condition) || session.condition);
  return (
    <>
      <div className="page-head" style={{ gap: 12, paddingBottom: 0 }}>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="h1">{titleName(session.code)}</h1>
            <div className="small muted" style={{ marginTop: 2 }}>
              {dayMidCap(session.starts_at)} · {hm(session.starts_at)}
              {cond && session.has_result ? ` · ${cond}` : ''}
            </div>
          </div>
          <span className={`tag ${session.has_result ? 'ok' : 'quiet'}`}>{session.has_result ? 'Finalizada' : started ? 'Sin datos aún' : 'Pendiente'}</span>
        </div>
        <Actions onShare={rows.length ? () => setSharing(true) : null} pdf={files.classification} />
      </div>
      <div className="rlist">
        {!session.has_result ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            {started ? 'MotoGP todavía no ha publicado la clasificación. Aparecerá aquí sola en unos minutos.' : `Esta sesión empieza el ${dayMidCap(session.starts_at).toLowerCase()} a las ${hm(session.starts_at)}.`}
          </p>
        ) : status === 'loading' ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            Cargando la clasificación…
          </p>
        ) : status === 'error' ? (
          <p className="err-text" style={{ padding: '16px 0' }}>
            No se ha podido cargar la clasificación. Comprueba la conexión.
          </p>
        ) : (
          rows.map((row, i) => {
            const t = rowTimes(rows, i, race);
            return <Row key={i} pos={row.pos == null ? '–' : row.pos} first={row.pos === 1} rider={rowRider(row, d, session.category)} time={t.main} sub={t.sub} points={race ? row.points : undefined} />;
          })
        )}
        {rows.length > 1 && status === 'ready' ? (
          <p className="small muted" style={{ padding: '10px 0 0' }}>
            Debajo de cada tiempo: diferencia con el primero / con el de delante.
          </p>
        ) : null}
      </div>
      <Files files={files} except="classification" />
      {sharing ? (
        <ShareSheet
          title={`${chipName(session.code)} · GP de ${event.name}`}
          name={`${session.category}-${session.code}-${event.short_name}.png`}
          make={() => resultImage({ event, session: { ...session, condition: (data && data.condition) || session.condition }, rows, d })}
          onClose={() => setSharing(false)}
        />
      ) : null}
    </>
  );
}

function GridView({ event, category, sessions }) {
  const { d } = useData();
  const [sharing, setSharing] = useState(false);
  const { status, data } = useLoaded(() => loadGrid(event.id, category), [event.id, category]);
  const rows = (data && data.rows) || [];
  const quali = [...sessions].reverse().find((s) => /^Q/.test(s.code));
  // El PDF de la parrilla viene colgado de la Q2 y de las carreras.
  const pdf = sessions.map((s) => s.files && s.files.grid).find(Boolean);
  return (
    <>
      <div className="page-head" style={{ gap: 12, paddingBottom: 0 }}>
        <div>
          <h1 className="h1">Parrilla</h1>
          <div className="small muted" style={{ marginTop: 2 }}>
            {category === 'MotoGP' ? 'Para la Sprint y la carrera' : 'Para la carrera'} · tiempos de la clasificación
          </div>
        </div>
        <Actions onShare={rows.length ? () => setSharing(true) : null} pdf={pdf} pdfLabel="PDF parrilla" />
      </div>
      <div className="rlist">
        {status === 'loading' ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            Cargando la parrilla…
          </p>
        ) : status === 'error' ? (
          <p className="err-text" style={{ padding: '16px 0' }}>
            No se ha podido cargar la parrilla. Comprueba la conexión.
          </p>
        ) : (
          rows.map((row, i) => <Row key={i} pos={row.pos ?? i + 1} first={i === 0} rider={rowRider(row, d, category)} time={row.time ? String(row.time).replace(/^0(\d:)/, '$1') : 'Sin tiempo'} />)
        )}
      </div>
      {sharing ? (
        <ShareSheet
          title={`Parrilla · GP de ${event.name}`}
          name={`${category}-parrilla-${event.short_name}.png`}
          make={() => gridImage({ event, category, rows, d, when: quali ? quali.starts_at : null })}
          onClose={() => setSharing(false)}
        />
      ) : null}
    </>
  );
}

export function Results({ eventId }) {
  const { boot, d, eventData } = useData();
  const events = boot.events;
  const [index, setIndex] = useState(() => {
    const wanted = eventId && d.events.get(eventId);
    const current = d.events.get(boot.current_event_id);
    // El GP en juego si su fin de semana ya ha empezado; si no, el último terminado.
    const live = current && Date.parse(`${current.date_start}T00:00:00Z`) - 12 * 3600e3 <= now() ? current : null;
    const start = wanted || live || d.lastFinished || current || events[0];
    return Math.max(0, events.findIndex((e) => e.id === (start && start.id)));
  });
  const [category, setCategory] = useState('MotoGP');
  const [picked, setPicked] = useState(null);
  const strip = useRef(null);
  const event = events[index];
  const data = event ? eventData[event.id] : null;
  useEffect(() => {
    if (event) loadEvent(event.id);
    setPicked(null);
  }, [event && event.id, category]);

  const sessions = sessionsOf(data, event, category);
  const chips = sessions.map((s) => ({ key: s.id, label: chipName(s.code), session: s, ready: s.has_result }));
  if (data && (data.grids || []).includes(category)) {
    // La parrilla va detrás de la última clasificación.
    let at = -1;
    chips.forEach((c, i) => {
      if (/^Q/.test(c.session.code)) at = i;
    });
    chips.splice(at + 1, 0, { key: 'grid', label: 'Parrilla', ready: true });
  }
  const ready = chips.filter((c) => c.ready && c.key !== 'grid');
  const active = chips.find((c) => c.key === picked) || ready[ready.length - 1] || chips[0] || null;
  useEffect(() => {
    const el = strip.current && strip.current.querySelector('[aria-pressed="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active && active.key, event && event.id, category]);

  if (!event) return null;
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <Tabs current="resultados" />
        <GpNav event={event} sub={`${event.circuit} · ${dateRange(event.date_start, event.date_end)}`} canPrev={index > 0} canNext={index < events.length - 1} onMove={(step) => setIndex((i) => Math.min(events.length - 1, Math.max(0, i + step)))} />
        <div style={{ padding: '12px 20px 0' }}>
          <div className="seg" role="group" aria-label="Categoría">
            {CLASSES.map((c) => (
              <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {!data ? (
          <p className="muted" style={{ padding: 20 }}>
            Cargando las sesiones…
          </p>
        ) : !chips.length ? (
          <div style={{ padding: 20 }}>
            <p className="muted">MotoGP aún no ha publicado las sesiones de este Gran Premio.</p>
          </div>
        ) : (
          <>
            <div className="schips" ref={strip} role="group" aria-label="Sesión">
              {chips.map((c) => (
                <button key={c.key} aria-pressed={active && c.key === active.key} className={c.ready ? '' : 'wait'} onClick={() => setPicked(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            {active.key === 'grid' ? <GridView key={`${event.id}-${category}`} event={event} category={category} sessions={sessions} /> : <SessionView key={active.key} event={event} session={active.session} />}
          </>
        )}
        <a className="linkrow" style={{ marginTop: 20 }} href={`#/horario/${event.id}`}>
          <span>Horario completo de este GP</span>
          <Icon name="next" size={14} stroke={2.4} />
        </a>
      </main>
    </>
  );
}

export function Calendar() {
  const { boot, d } = useData();
  const currentId = boot.current_event_id || boot.voting_event_id;
  const t = now();
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <Tabs current="calendario" />
        <div className="page-head" style={{ paddingBottom: 4, gap: 4 }}>
          <h1 className="h1" style={{ fontSize: 24 }}>
            Calendario {boot.season}
          </h1>
          <div className="small muted">
            {d.finishedCount} de {d.rounds} grandes premios disputados · toca uno para ver sus resultados o su horario
          </div>
        </div>
        <div className="menu" style={{ paddingTop: 4 }}>
          {boot.events.map((e) => {
            const done = e.status === 'finished';
            const isNow = e.id === currentId;
            // Con el fin de semana empezado ya hay resultados; antes, solo horario.
            const started = done || Date.parse(`${e.date_start}T00:00:00Z`) <= t;
            return (
              <a key={e.id} className={`cal ${done ? 'is-done' : ''} ${isNow ? 'is-now' : ''}`} href={started ? `#/motogp/r/${e.id}` : `#/horario/${e.id}`}>
                <span className="rnd">{String(e.round).padStart(2, '0')}</span>
                <span className="txt">
                  <b>{e.name}</b>
                  <small>
                    {e.circuit} · {dateRange(e.date_start, e.date_end)}
                  </small>
                </span>
                {isNow ? <span className="tag red">Próximo</span> : done ? <span className="small">Resultados</span> : <span className="small muted">Horario</span>}
                <span className="muted">
                  <Icon name="next" />
                </span>
              </a>
            );
          })}
        </div>
      </main>
    </>
  );
}

const CATS = ['Todo', ...CLASSES];

export function FullSchedule({ eventId }) {
  const { boot, d, eventData } = useData();
  const [cat, setCat] = useState('Todo');
  const [back] = useState(() => (cameFrom() === 'motogp' ? 'motogp' : ''));
  const [sharing, setSharing] = useState(false);
  const t = useNow(30000);
  const event = d.events.get(eventId) || d.events.get(boot.current_event_id);
  const data = event ? eventData[event.id] : null;
  useEffect(() => {
    if (event && !eventData[event.id]) loadEvent(event.id);
  }, [event && event.id]);
  if (!event) return null;

  const sessions = sessionsOf(data, event, cat === 'Todo' ? null : cat);
  const motogp = sessionsOf(data, event, 'MotoGP');
  const votingHere = boot.voting_event_id === event.id;
  let lastDay = '';
  return (
    <>
      <TopBar title="Horario" back={back} who={false} />
      <main className="main has-nav">
        <Offline />
        <div className="page-head" style={{ gap: 12 }}>
          <div>
            <div className="label">
              Ronda {event.round} de {d.rounds} · Hora peninsular
            </div>
            <h1 className="h1" style={{ marginTop: 2 }}>
              GP de {event.name}
            </h1>
            <div className="muted" style={{ marginTop: 2 }}>
              {event.circuit} · {dateRange(event.date_start, event.date_end)}
            </div>
          </div>
          <div className="seg" role="group" aria-label="Categoría">
            {CATS.map((c) => (
              <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          {motogp.length ? (
            <button className="cta m" onClick={() => setSharing(true)}>
              <Icon name="share" />
              <span>Compartir horario MotoGP</span>
            </button>
          ) : null}
        </div>
        <div style={{ padding: '0 20px' }}>
          {!data ? (
            <p className="muted">Cargando el horario…</p>
          ) : !sessions.length ? (
            <p className="muted">MotoGP aún no ha publicado el horario de este Gran Premio.</p>
          ) : (
            sessions.map((s) => {
              const key = dayKey(s.starts_at);
              const first = key !== lastDay;
              lastDay = key;
              const gp = s.category === 'MotoGP';
              const past = Date.parse(s.starts_at) < t;
              return (
                <div key={s.id}>
                  {first ? <div className="day-head">{dayLong(s.starts_at)}</div> : null}
                  <div className={`frow ${gp ? 'gp' : ''} ${past ? 'past' : ''}`}>
                    <div className="time">{hm(s.starts_at)}</div>
                    <div className="cat">{s.category}</div>
                    <div className="what">{titleName(s.code)}</div>
                    {gp && s.code === 'SPR' && votingHere ? <span className="tag red">Cierra el voto</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {sharing ? <ScheduleShare event={event} sessions={motogp} onClose={() => setSharing(false)} /> : null}
      </main>
    </>
  );
}

// Imagen del horario de MotoGP, lista para el grupo.
export function ScheduleShare({ event, sessions, onClose }) {
  const { boot, d } = useData();
  const voteOpen = boot.voting_event_id === event.id && Date.parse(event.close_at) > now();
  return <ShareSheet title={`Horario · GP de ${event.name}`} name={`horario-${event.short_name}.png`} make={() => scheduleImage({ event, sessions, rounds: d.rounds, voteOpen })} onClose={onClose} />;
}
