// Votar: elegir piloto, confirmar y, después, pasar el móvil al siguiente jugador.
import { useState } from 'react';
import { messageFor } from '../api.js';
import { MAX_USES } from '../config.js';
import { nextOpening, openText } from '../data.js';
import { now, setActive, vote } from '../store.js';
import { teamShort } from '../teams.js';
import { dayMid, hm } from '../time.js';
import { Avatar, go, Icon, Offline, Photo, PickCard, Plate, TopBar, useData, useNow, VoteStatus } from '../ui.jsx';

const closeText = (ev) => (ev.close_provisional ? `Cierra el ${dayMid(ev.close_at)} · hora por confirmar` : `Cierra el ${dayMid(ev.close_at)} a las ${hm(ev.close_at)}`);

const switchTo = (id) => {
  setActive(id);
  window.scrollTo(0, 0);
};

function NoVoting() {
  const { boot } = useData();
  const next = nextOpening(boot, now());
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <div className="page-head">
          <h1 className="h1 s">Ahora no se vota</h1>
          {next ? (
            <p className="muted">
              La votación del GP de {next.name} se abre el <b style={{ color: 'var(--text)' }}>{openText(next)}</b>, el lunes después de la carrera, para que no se mezcle con el fin de semana en curso.
            </p>
          ) : (
            <p className="muted">No hay ningún Gran Premio con la votación abierta. En cuanto se abra el siguiente, aparecerá aquí.</p>
          )}
        </div>
      </main>
    </>
  );
}

function Picker({ event, current }) {
  const { d, active } = useData();
  const [picked, setPicked] = useState(current ? current.rider_id : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rider = picked ? d.riders.get(picked) : null;
  const used = rider ? d.usesOf(active, rider.id, event.id) : 0;
  const left = MAX_USES - used - 1;
  const same = !!current && picked === current.rider_id;
  const changing = !!current;

  const confirm = async () => {
    if (!rider || same || busy) return;
    setBusy(true);
    setError('');
    try {
      await vote(event.id, rider.id);
      window.scrollTo(0, 0);
      go('votar');
    } catch (e) {
      setError(messageFor(e.code));
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar title={changing ? 'Cambiar voto' : 'Tu voto'} back={changing ? 'votar' : ''} />
      <main className="main has-foot">
        <Offline />
        <div className="page-head">
          <div>
            <div className="label">
              Ronda {event.round} de {d.rounds}
            </div>
            <h1 className="h1" style={{ marginTop: 2 }}>
              GP de {event.name}
            </h1>
          </div>
          <div className="amber strong" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <Icon name="clock" />
            <span>{closeText(event)}</span>
          </div>
          <div className="legend">
            <span>Máximo {MAX_USES} veces cada piloto por temporada</span>
            <span>
              <i>
                <span className="pip on" />
                usado
              </i>
              <i>
                <span className="pip" />
                libre
              </i>
            </span>
          </div>
        </div>
        <div className="rgrid">
          {d.votable.map((r) => {
            const uses = d.usesOf(active, r.id, event.id);
            const blocked = uses >= MAX_USES;
            const on = picked === r.id;
            return (
              <button
                key={r.id}
                className="rider"
                disabled={blocked}
                aria-pressed={on}
                aria-label={`${r.full_name}, ${teamShort(r)}, usado ${uses} de ${MAX_USES}${blocked ? ', agotado' : ''}`}
                onClick={() => {
                  setPicked(r.id);
                  setError('');
                }}
              >
                <span className="rider-info">
                  <span className="rider-top">
                    <Plate rider={r} />
                    <span className="pips">
                      {[1, 2, 3].map((n) => (
                        <span key={n} className={`pip ${uses >= n ? 'on' : ''}`} />
                      ))}
                    </span>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className={`rider-name ${r.short_name.length > 10 ? 'long' : ''}`}>{r.short_name}</span>
                    <span className="rider-sub">{blocked ? 'Agotado' : teamShort(r)}</span>
                  </span>
                </span>
                <Photo rider={r} size="s">
                  {on ? (
                    <span className="check">
                      <Icon name="check" size={13} stroke={3.4} />
                    </span>
                  ) : null}
                </Photo>
              </button>
            );
          })}
        </div>
        <div className="foot">
          <div className="label">Tu elección</div>
          <div className="foot-row">
            <div className={`foot-name ${rider ? '' : 'none'}`}>{rider ? rider.short_name : 'Elige un piloto'}</div>
            <div className="small muted" style={{ textAlign: 'right' }}>
              {!rider ? '' : same ? 'Es tu voto actual' : left === 0 ? 'Será tu último uso de este piloto' : left === 1 ? 'Te quedará 1 uso de este piloto' : `Te quedarán ${left} usos de este piloto`}
            </div>
          </div>
          {error ? (
            <p className="err-text" role="alert">
              {error}
            </p>
          ) : null}
          <button className="cta" onClick={confirm} disabled={!rider || same || busy}>
            <span>{busy ? 'Guardando…' : changing ? 'Confirmar cambio' : 'Confirmar voto'}</span>
            {busy ? null : <Icon name="check" size={18} stroke={2.6} />}
          </button>
          <div className="small muted" style={{ textAlign: 'center' }}>
            {changing ? 'Es tu único cambio: después ya no podrás modificarlo.' : 'Podrás cambiarlo 1 vez antes del cierre.'}
          </div>
        </div>
      </main>
    </>
  );
}

function Done({ event, mine }) {
  const { boot, d, active } = useData();
  const rider = d.riders.get(mine.rider_id);
  const canChange = mine.changes_used < 1;
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <section className="done">
          <div className="done-head">
            <span className="ok-badge">
              <Icon name="check" size={20} stroke={3} />
            </span>
            <h1 className="done-title">Voto registrado</h1>
          </div>
          <PickCard rider={rider} sub={`${teamShort(rider)} · GP de ${event.name}`} />
          <div className="between">
            <div className="muted" style={{ fontSize: 14 }}>
              {canChange ? (
                <>
                  Te queda <span className="strong" style={{ color: 'var(--text)' }}>1 cambio</span> hasta el {dayMid(event.close_at)}
                  {event.close_provisional ? '' : `, ${hm(event.close_at)}`}
                </>
              ) : (
                'Ya has usado tu cambio: este es tu voto definitivo.'
              )}
            </div>
            {canChange ? (
              <a className="btn" href="#/votar/cambiar">
                Cambiar
              </a>
            ) : null}
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 className="h2">¿Vota alguien más?</h2>
            <div className="small muted" style={{ marginTop: 4 }}>
              Jugadores guardados en este móvil
            </div>
          </div>
          <div className="stack">
            {boot.my_players.map((id) => {
              const p = d.players.get(id);
              if (!p) return null;
              const v = d.voteOf(id, event.id);
              const r = v ? d.riders.get(v.rider_id) : null;
              const isActive = id === active;
              return (
                <div key={id} className="prow">
                  <Avatar name={p.name} on={isActive} size="m" />
                  <span className="prow-text">
                    <span>{p.name}</span>
                    <VoteStatus rider={r} />
                  </span>
                  {isActive ? (
                    <span className="tag quiet">Activo</span>
                  ) : r ? (
                    <button className="btn faint" onClick={() => switchTo(id)} aria-label={`Ver el voto de ${p.name}`}>
                      Ver
                    </button>
                  ) : (
                    <button className="cta s" onClick={() => switchTo(id)} aria-label={`Votar como ${p.name}`}>
                      Votar
                    </button>
                  )}
                </div>
              );
            })}
            <a className="btn dashed" href="#/mas/jugadores">
              <Icon name="plus" />
              <span>Añadir otro jugador a este móvil</span>
            </a>
          </div>
        </section>
      </main>
    </>
  );
}

export default function Vote({ changing }) {
  const { boot, d, active } = useData();
  useNow(30000);
  const event = d.events.get(boot.voting_event_id);
  if (!event || Date.parse(event.close_at) <= now()) return <NoVoting />;
  const mine = d.voteOf(active, event.id);
  if (mine && !(changing && mine.changes_used < 1)) return <Done event={event} mine={mine} />;
  return <Picker key={active} event={event} current={mine} />;
}
