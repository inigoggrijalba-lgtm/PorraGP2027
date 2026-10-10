// Inicio: el próximo GP, cuánto falta para que cierre el voto, el horario y cómo va la porra.
import { useContext, useEffect, useRef, useState } from 'react';
import { championOf, nextOpening, openText, sessionsOf } from '../data.js';
import { ScheduleShare } from './MotoGP.jsx';
import { canOfferPush } from '../push.js';
import { now, refresh } from '../store.js';
import { teamShort } from '../teams.js';
import { countdown, dateRange, dayKey, dayMid, dayMidCap, dayShort, hm } from '../time.js';
import { ChampionCard, ChampionPopup, Icon, Offline, Photo, PickCard, SheetContext, useChampionPopup, useData, useNow } from '../ui.jsx';

const HOME_NAMES = { FP1: 'Libres 1', PR: 'Práctica', FP2: 'Libres 2', Q1: 'Clasificación', SPR: 'Sprint', WUP: 'Warm up', RAC: 'Carrera' };

function Countdown({ event }) {
  const t = useNow(1000);
  const close = Date.parse(event.close_at);
  const left = close - t;
  const asked = useRef(false);
  useEffect(() => {
    // Al llegar a cero se pide el estado al servidor, que es quien cierra de verdad.
    if (left <= 0 && !asked.current) {
      asked.current = true;
      refresh();
    }
  }, [left]);
  if (left <= 0) {
    return (
      <div className="count">
        <div className="count-head closed">
          <Icon name="lock" />
          <span>Votación cerrada</span>
        </div>
      </div>
    );
  }
  const parts = countdown(left);
  return (
    <div className={`count ${left < 3 * 3600e3 ? 'urgent' : ''}`}>
      <div className="count-head">
        <Icon name="clock" />
        <span>La votación cierra en</span>
      </div>
      <div className="count-grid" role="timer" aria-label={`Faltan ${parts.map(([n, u]) => `${Number(n)} ${u.toLowerCase()}`).join(', ')}`}>
        {parts.map(([n, u]) => (
          <div key={u}>
            <div className="count-n">{n}</div>
            <div className="count-u">{u}</div>
          </div>
        ))}
      </div>
      <div className="small muted" style={{ fontSize: 14 }}>
        {event.close_provisional
          ? `${dayMidCap(close)} · horario por confirmar`
          : `${dayMidCap(close)} · ${hm(close)} · al arrancar la Sprint`}
      </div>
    </div>
  );
}

function OpenState({ event }) {
  const { d, me, active, boot } = useData();
  const openSheet = useContext(SheetContext);
  const mine = d.voteOf(active, event.id);
  const rider = mine ? d.riders.get(mine.rider_id) : null;
  const spent = d.spentCount(active, event.id);
  const others = boot.my_players.filter((id) => id !== active && !d.voteOf(id, event.id)).map((id) => d.players.get(id)?.name).filter(Boolean);
  return (
    <>
      <Countdown event={event} />
      {rider ? (
        <>
          <div className="hero-state">
            <div className="strong green" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="check" stroke={3} />
              <span>{me.name}, ya has votado</span>
            </div>
          </div>
          <PickCard rider={rider} size="m" />
          <div className="between" style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 14 }}>
              {mine.changes_used >= 1 ? 'Ya has usado tu cambio en este GP.' : 'Te queda 1 cambio antes del cierre.'}
            </div>
            {mine.changes_used >= 1 ? null : (
              <a className="btn" href="#/votar/cambiar">
                Cambiar
              </a>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="hero-state">
            <div className="strong">Aún no has votado</div>
            <div className="small muted">
              {d.votable.length - spent} pilotos disponibles{spent ? ` · ${spent} ${spent === 1 ? 'agotado' : 'agotados'}` : ''}
            </div>
          </div>
          <a className="cta" href="#/votar">
            <span>Votar ahora</span>
            <Icon name="arrow" size={18} stroke={2.4} />
          </a>
        </>
      )}
      {others.length ? (
        <button className="notice" style={{ margin: '12px 0 0', width: '100%' }} onClick={openSheet}>
          <span className="amber">
            <Icon name="clock" />
          </span>
          <span style={{ flex: 1 }}>En este móvil falta por votar: {others.join(', ')}</span>
          <Icon name="next" size={14} stroke={2.4} />
        </button>
      ) : null}
    </>
  );
}

// GP siguiente cuya votación todavía no se ha abierto: se abre el lunes después de la carrera anterior.
function SoonState({ event }) {
  const t = useNow(30000);
  const asked = useRef(false);
  const left = Date.parse(event.open_at) - t;
  useEffect(() => {
    if (left <= 0 && !asked.current) {
      asked.current = true;
      refresh();
    }
  }, [left]);
  return (
    <div className="count">
      <div className="count-head closed">
        <Icon name="lock" />
        <span>La votación se abre el {openText(event)}</span>
      </div>
      <div className="small muted" style={{ fontSize: 14 }}>
        Se abre el lunes después de cada carrera, para que no se mezcle con el fin de semana anterior. {closeLine(event)}
      </div>
    </div>
  );
}
const closeLine = (e) => (e.close_provisional ? `Cerrará el ${dayMid(e.close_at)} (hora por confirmar).` : `Cerrará el ${dayMid(e.close_at)} a las ${hm(e.close_at)}.`);

function NextOpens() {
  const { boot } = useData();
  const t = useNow(60000);
  const next = nextOpening(boot, t);
  if (!next) return null;
  return (
    <div className="count" style={{ marginTop: 12 }}>
      <div className="count-head closed">
        <Icon name="clock" />
        <span>GP de {next.name}: se vota desde el {openText(next)}</span>
      </div>
    </div>
  );
}

function ClosedState({ event, sessions, voting }) {
  const { d, active, eventData } = useData();
  const t = useNow(30000);
  const mine = d.voteOf(active, event.id);
  const rider = mine ? d.riders.get(mine.rider_id) : null;
  const next = sessions.find((s) => Date.parse(s.starts_at) > t);
  const pts = rider ? (eventData[event.id]?.rider_points || []).find((p) => p.rider_id === rider.id) : null;
  const show = (v) => (v == null ? '–' : v);
  const nextVote = voting && voting.id !== event.id ? voting : null;
  const votedNext = nextVote ? d.voteOf(active, nextVote.id) : null;
  return (
    <>
      <div className="count">
        <div className="count-head closed">
          <Icon name="lock" />
          <span>Votación cerrada</span>
        </div>
        <div style={{ fontSize: 14 }} className="muted">
          {next ? `Siguiente: ${HOME_NAMES[next.code] || next.code} · ${dayMid(next.starts_at)} · ${hm(next.starts_at)}` : 'Gran Premio terminado. Los puntos se cargan solos en unos minutos.'}
        </div>
      </div>
      {rider ? (
        <PickCard rider={rider} size="m" sub={`${teamShort(rider)} · Sprint ${show(pts?.sprint_points)} · Carrera ${show(pts?.race_points)}`} />
      ) : (
        <div className="hero-state">
          <div className="strong">No votaste en este GP</div>
          <div className="small muted">0 puntos</div>
        </div>
      )}
      {nextVote ? (
        <div className="count" style={{ marginTop: 12 }}>
          <div className="count-head">
            <Icon name="clock" />
            <span>Ya se vota: GP de {nextVote.name}</span>
          </div>
          <div className="between">
            <div className="muted" style={{ fontSize: 14 }}>
              {nextVote.close_provisional ? `Cierra el ${dayMid(nextVote.close_at)} · hora por confirmar` : `Cierra el ${dayMid(nextVote.close_at)} a las ${hm(nextVote.close_at)}`}
            </div>
            <a className={votedNext ? 'btn' : 'cta s'} href="#/votar">
              {votedNext ? 'Ver voto' : 'Votar'}
            </a>
          </div>
        </div>
      ) : (
        <NextOpens />
      )}
    </>
  );
}

function Schedule({ event, sessions, open }) {
  const t = useNow(30000);
  const [sharing, setSharing] = useState(false);
  const rows = sessions.filter((s) => s.code !== 'Q2');
  if (!rows.length) return <p className="muted">MotoGP aún no ha publicado el horario de este Gran Premio.</p>;
  const nextId = rows.find((s) => Date.parse(s.starts_at) > t)?.id;
  let lastDay = '';
  return (
    <>
      <div className="rows">
        {rows.map((s) => {
          const key = dayKey(s.starts_at);
          const first = key !== lastDay;
          lastDay = key;
          const past = Date.parse(s.starts_at) <= t && s.id !== nextId;
          const big = s.code === 'SPR' || s.code === 'RAC';
          return (
            <div key={s.id} className={`srow ${past ? 'past' : ''}`}>
              <div className="day">{first ? dayShort(s.starts_at) : ''}</div>
              <div className={`what ${big ? 'strong' : ''}`}>{HOME_NAMES[s.code] || s.code}</div>
              {s.code === 'SPR' && open ? <span className="tag red">
                  <span className="wide">Cierra el voto</span>
                  <span className="narrow">Cierre</span>
                </span> : s.id === nextId ? <span className="tag">Siguiente</span> : null}
              <div className="time">{hm(s.starts_at)}</div>
            </div>
          );
        })}
      </div>
      <div className="two">
        <button className="btn" onClick={() => setSharing(true)}>
          <Icon name="share" />
          <span>Compartir</span>
        </button>
        <a className="btn quiet" href={`#/horario/${event.id}`}>
          <span className="wide">Horario completo</span>
          <span className="narrow">Horario</span>
          <Icon name="next" size={14} stroke={2.4} />
        </a>
      </div>
      {sharing ? <ScheduleShare event={event} sessions={sessions} onClose={() => setSharing(false)} /> : null}
    </>
  );
}

function Votes({ event, open }) {
  const { d, active } = useData();
  const players = d.activePlayers;
  const voted = [];
  const pending = [];
  for (const p of players) {
    const v = d.voteOf(p.id, event.id);
    const rider = v ? d.riders.get(v.rider_id) : null;
    if (rider) voted.push({ p, rider, score: d.scoreOf(p.id, event.id) });
    else pending.push(p);
  }
  voted.sort((a, b) => (b.p.id === active) - (a.p.id === active) || a.p.name.localeCompare(b.p.name, 'es'));
  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h2">Votos de este GP</h2>
        <div className="small muted">
          Han votado <span className="num" style={{ color: 'var(--text)' }}>{voted.length}</span> de {players.length}
        </div>
      </div>
      <div className="bars" aria-hidden="true">
        {players.map((p, i) => (
          <i key={p.id} className={i < voted.length ? 'on' : ''} />
        ))}
      </div>
      <div className="vgrid">
        {voted.map(({ p, rider, score }) => (
          <div key={p.id} className={`vcard ${p.id === active ? 'me' : ''}`}>
            <div className="vcard-info">
              <div className="vcard-player">
                <span className="green">
                  <Icon name="check" size={14} stroke={3} />
                </span>
                <span>{p.name}</span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={`vcard-rider ${rider.short_name.length > 11 ? 'long' : ''}`}>{rider.short_name}</div>
                <div className="vcard-sub">{teamShort(rider)}</div>
              </div>
            </div>
            <Photo rider={rider} size="m">
              {!open && score ? <span className="vcard-pts">+{score.total}</span> : null}
            </Photo>
          </div>
        ))}
      </div>
      {pending.length ? (
        <>
          <div className={`pending-head ${open ? '' : 'closed'}`} style={voted.length ? undefined : { marginTop: 0 }}>
            <Icon name={open ? 'clock' : 'lock'} size={14} stroke={2.4} />
            <span>
              {open ? 'Faltan por votar' : 'Sin voto'} · {pending.length}
            </span>
          </div>
          <div className="chips">
            {pending.map((p) => (
              <div key={p.id} className="chip">
                <span>{p.name}</span>
                {p.id === active ? <span className="tag you">Tú</span> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

// Invitación a activar los avisos, hasta que el jugador decida.
function PushHint() {
  const [show, setShow] = useState(() => {
    try {
      return canOfferPush() && !localStorage.getItem('porragp.pushHint');
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const hide = () => {
    try {
      localStorage.setItem('porragp.pushHint', '1');
    } catch {
      // sin almacenamiento volverá a salir, nada más
    }
    setShow(false);
  };
  return (
    <div className="notice hint">
      <span className="amber">
        <Icon name="bell" size={18} />
      </span>
      <span style={{ flex: 1, color: 'var(--text)' }}>Activa los avisos y no se te pasará votar.</span>
      <a className="btn faint lit" href="#/mas/avisos">
        Activar
      </a>
      <button className="back" style={{ width: 36 }} onClick={hide} aria-label="Ocultar este mensaje">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function MiniStandings() {
  const { d, standings, active } = useData();
  const list = standings.filter((s) => s.active);
  if (!list.length) return null;
  const top = list.slice(0, 3);
  const myIndex = list.findIndex((s) => s.player_id === active);
  const mine = myIndex >= 3 ? list[myIndex] : null;
  const lead = list[0].total;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h2">Clasificación</h2>
        <div className="small muted">
          Tras {d.finishedCount} de {d.rounds} GP
        </div>
      </div>
      <div className="rows">
        {top.map((s, i) => (
          <div key={s.player_id} className="lrow">
            <div className={`pos ${i === 0 ? 'first' : ''}`}>{i + 1}</div>
            <div className="name">
              {s.name} {s.player_id === active ? <span className="tag you">Tú</span> : null}
            </div>
            <div className="pts">{s.total}</div>
          </div>
        ))}
        {mine ? (
          <>
            {myIndex > 3 ? (
              <div className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            ) : null}
            <div className="lrow mine">
              <div className="pos">{myIndex + 1}</div>
              <div className="name">
                <span>{mine.name}</span>
                <small>
                  A {lead - mine.total} {lead - mine.total === 1 ? 'punto' : 'puntos'} del líder
                </small>
              </div>
              <div className="pts">{mine.total}</div>
            </div>
          </>
        ) : null}
      </div>
      <a className="linkrow" href="#/porra">
        <span>Ver clasificación completa</span>
        <Icon name="next" size={14} stroke={2.4} />
      </a>
    </section>
  );
}

export default function Home() {
  const { boot, d, eventData, standings } = useData();
  const voting = d.events.get(boot.voting_event_id) || null;
  const event = d.events.get(boot.current_event_id) || voting;
  const champ = championOf(d, standings, boot.season);
  const [popup, closePopup] = useChampionPopup(champ);
  if (champ) {
    return (
      <>
        <Offline />
        {popup ? <ChampionPopup champ={champ} onClose={closePopup} /> : null}
        <ChampionCard champ={champ} />
        <MiniStandings />
      </>
    );
  }
  if (!event) {
    return (
      <>
        <Offline />
        <section className="hero">
          <div className="label">Temporada {boot.season}</div>
          <h1 className="hero-name long">Temporada terminada</h1>
          <div className="muted">Ya no quedan grandes premios por votar.</div>
        </section>
        <MiniStandings />
      </>
    );
  }
  // Abierta de verdad: es el GP que toca votar y su cierre aún no ha pasado.
  const open = !!voting && voting.id === event.id && Date.parse(event.close_at) > now();
  // Aún no ha empezado su fin de semana y su votación no se ha abierto.
  const soon = !open && event.status === 'scheduled' && !!event.open_at && Date.parse(event.open_at) > now();
  const sessions = sessionsOf(eventData[event.id], event, 'MotoGP');
  return (
    <>
      <Offline />
      <section className="hero">
        <div className="label">
          Ronda {event.round} de {d.rounds} · {open || soon ? 'Próximo Gran Premio' : 'Gran Premio en juego'}
        </div>
        <h1 className={`hero-name ${event.name.length > 10 ? 'long' : ''}`}>{event.name}</h1>
        <div className="muted">
          {event.circuit} · {dateRange(event.date_start, event.date_end)}
        </div>
        {open ? <OpenState event={event} /> : soon ? <SoonState event={event} /> : <ClosedState event={event} sessions={sessions} voting={voting} />}
      </section>
      <PushHint />
      <section className="sec">
        <div className="sec-head">
          <h2 className="h2">Horario MotoGP</h2>
          <div className="small muted">Hora peninsular</div>
        </div>
        <Schedule event={event} sessions={sessions} open={open} />
      </section>
      {soon ? null : <Votes event={event} open={open} />}
      <MiniStandings />
    </>
  );
}
