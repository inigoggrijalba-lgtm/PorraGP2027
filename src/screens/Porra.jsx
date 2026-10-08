// Pestaña Porra: clasificación general, votos y puntos de cada GP, y estadísticas.
import { useEffect, useRef, useState } from 'react';
import { now } from '../store.js';
import { championOf } from '../data.js';
import { ChampionCard, Offline, Plate, TopBar, useData } from '../ui.jsx';
import Stats from './Stats.jsx';

function Tabs({ current }) {
  return (
    <div className="tabs">
      <a href="#/porra" aria-current={current === 'general' ? 'page' : undefined}>
        Clasificación
      </a>
      <a href="#/porra/gp" aria-current={current === 'gp' ? 'page' : undefined}>
        Por GP
      </a>
      <a href="#/porra/estadisticas" aria-current={current === 'estadisticas' ? 'page' : undefined}>
        Estadísticas
      </a>
    </div>
  );
}

function General() {
  const { d, standings, active, boot } = useData();
  const list = standings.filter((s) => s.active);
  const lead = list.length ? list[0].total : 0;
  const last = d.lastFinished;
  const champ = championOf(d, standings, boot.season);
  return (
    <>
      {champ ? <ChampionCard champ={champ} /> : null}
      <div className="page-head" style={{ paddingBottom: 12, gap: 4 }}>
        <h1 className="h1" style={{ fontSize: 24 }}>
          Clasificación general
        </h1>
        <div className="small muted">
          Tras {d.finishedCount} de {d.rounds} grandes premios
        </div>
      </div>
      <div className="table">
        <div className="thead">
          <div className="c-pos" />
          <div className="c-name">
            <span>Jugador</span>
          </div>
          <div className="c-gap">Dif.</div>
          {last ? <div className="c-last">{last.short_name}</div> : null}
          <div className="c-pts">Puntos</div>
        </div>
        {list.map((s, i) => {
          const lastScore = last ? d.scoreOf(s.player_id, last.id) : null;
          const lastPts = lastScore ? lastScore.total : 0;
          return (
            <div key={s.player_id} className={`trow ${s.player_id === active ? 'mine' : ''}`}>
              <div className={`c-pos ${i === 0 ? 'first' : ''}`}>{i + 1}</div>
              <div className="c-name">
                <span>{s.name}</span>
                {s.player_id === active ? <span className="tag you">Tú</span> : null}
              </div>
              <div className="c-gap">{i === 0 ? '–' : `−${lead - s.total}`}</div>
              {last ? <div className={`c-last ${lastPts ? '' : 'zero'}`}>{lastPts ? `+${lastPts}` : '0'}</div> : null}
              <div className="c-pts">{s.total}</div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ padding: '14px 20px 0' }}>
        En caso de empate va delante quien tenga más victorias de domingo y, si sigue el empate, más victorias de sábado.
      </p>
    </>
  );
}

function ByGp() {
  const { boot, d, active } = useData();
  const shown = boot.events.filter((e) => e.status === 'finished' || e.id === boot.current_event_id || e.id === boot.voting_event_id);
  const fallback = d.events.get(boot.current_event_id) || d.lastFinished || shown[shown.length - 1];
  const [sel, setSel] = useState(fallback ? fallback.id : null);
  const strip = useRef(null);
  useEffect(() => {
    const el = strip.current && strip.current.querySelector('[aria-pressed="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);
  const event = d.events.get(sel);
  if (!event) return <p className="muted" style={{ padding: 20 }}>Todavía no hay grandes premios.</p>;

  const rows = d.activePlayers.map((p) => {
    const v = d.voteOf(p.id, event.id);
    return { p, rider: v ? d.riders.get(v.rider_id) : null, score: d.scoreOf(p.id, event.id) };
  });
  rows.sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1) || !!b.rider - !!a.rider || a.p.name.localeCompare(b.p.name, 'es'));
  // Mientras la votación sigue abierta no hay puntos: quien no ha votado está pendiente, no a cero.
  const closed = event.status === 'finished' || Date.parse(event.close_at) <= now();
  const show = (r, key) => (r.score ? r.score[key] : closed && !r.rider ? '0' : '–');

  return (
    <>
      <div className="page-head" style={{ paddingBottom: 12, gap: 4 }}>
        <h1 className="h1" style={{ fontSize: 24 }}>
          GP de {event.name}
        </h1>
        <div className="small muted">
          Ronda {event.round} de {d.rounds} · {event.status === 'finished' ? 'Terminado' : closed ? 'En juego' : 'Votación abierta'}
        </div>
      </div>
      <div className="gp-strip" ref={strip}>
        {shown.map((e) => (
          <button key={e.id} aria-pressed={e.id === sel} onClick={() => setSel(e.id)} aria-label={`Ronda ${e.round}, ${e.name}`}>
            <b>{e.short_name}</b>
            <small>R{e.round}</small>
          </button>
        ))}
      </div>
      <div className="table by-gp" style={{ marginTop: 12 }}>
        <div className="thead">
          <div className="c-name">
            <span>Jugador</span>
          </div>
          <div className="c-rider">Piloto</div>
          <div className="c-pts">Puntos</div>
        </div>
        {rows.map((r) => (
          <div key={r.p.id} className={`trow ${r.p.id === active ? 'mine' : ''}`}>
            <div className="c-name">
              <span>{r.p.name}</span>
            </div>
            <div className="c-rider">
              {r.rider ? (
                <>
                  <Plate rider={r.rider} />
                  <span className="c-two">
                    <span>{r.rider.short_name}</span>
                    {closed ? (
                      <small>
                        Sprint {show(r, 'sprint_points')} · Carrera {show(r, 'race_points')}
                      </small>
                    ) : null}
                  </span>
                </>
              ) : (
                <span className="muted small">{closed ? 'Sin voto' : 'Pendiente'}</span>
              )}
            </div>
            <div className="c-pts">{show(r, 'total')}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Porra({ tab }) {
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <Tabs current={tab} />
        {tab === 'gp' ? <ByGp /> : tab === 'estadisticas' ? <Stats /> : <General />}
      </main>
    </>
  );
}
