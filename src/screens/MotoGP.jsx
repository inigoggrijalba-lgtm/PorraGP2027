// Pestaña MotoGP: calendario de la temporada y horario completo de cada GP.
import { useEffect, useState } from 'react';
import { sessionsOf } from '../data.js';
import { loadEvent } from '../store.js';
import { sessionName } from '../teams.js';
import { dateRange, dayKey, dayLong, hm } from '../time.js';
import { cameFrom, Icon, Offline, TopBar, useData, useNow } from '../ui.jsx';

export function Calendar() {
  const { boot, d } = useData();
  const currentId = boot.current_event_id || boot.voting_event_id;
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <div className="page-head" style={{ paddingBottom: 4, gap: 4 }}>
          <h1 className="h1" style={{ fontSize: 24 }}>
            Calendario {boot.season}
          </h1>
          <div className="small muted">
            {d.finishedCount} de {d.rounds} grandes premios disputados · toca uno para ver su horario
          </div>
        </div>
        <div className="menu" style={{ paddingTop: 4 }}>
          {boot.events.map((e) => {
            const done = e.status === 'finished';
            const isNow = e.id === currentId;
            return (
              <a key={e.id} className={`cal ${done ? 'is-done' : ''} ${isNow ? 'is-now' : ''}`} href={`#/horario/${e.id}`}>
                <span className="rnd">{String(e.round).padStart(2, '0')}</span>
                <span className="txt">
                  <b>{e.name}</b>
                  <small>
                    {e.circuit} · {dateRange(e.date_start, e.date_end)}
                  </small>
                </span>
                {isNow ? <span className="tag red">Próximo</span> : done ? <span className="small">Terminado</span> : null}
                <span className="muted">
                  <Icon name="next" />
                </span>
              </a>
            );
          })}
        </div>
        <p className="small muted" style={{ padding: '16px 20px 0' }}>
          Resultados de cada sesión, parrilla y documentos oficiales: llegan en la siguiente actualización.
        </p>
      </main>
    </>
  );
}

const CATS = ['Todo', 'MotoGP', 'Moto2', 'Moto3'];

export function FullSchedule({ eventId }) {
  const { boot, d, eventData } = useData();
  const [cat, setCat] = useState('Todo');
  const [back] = useState(() => (cameFrom() === 'motogp' ? 'motogp' : ''));
  const t = useNow(30000);
  const event = d.events.get(eventId) || d.events.get(boot.current_event_id);
  const data = event ? eventData[event.id] : null;
  useEffect(() => {
    if (event && !eventData[event.id]) loadEvent(event.id);
  }, [event && event.id]);
  if (!event) return null;

  const sessions = sessionsOf(data, event, cat === 'Todo' ? null : cat);
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
                    <div className="what">{sessionName(s.code)}</div>
                    {gp && s.code === 'SPR' && votingHere ? <span className="tag red">Cierra el voto</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
