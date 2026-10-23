// Logros de la porra. Se calculan en el móvil con los votos y puntos que ya trae la app,
// así que valen desde el primer GP de la temporada sin guardar nada en el servidor.
import { championOf } from './data.js';
import { now } from './store.js';

// [id, nombre, cómo se consigue, icono (trazo blanco, viewBox 0 0 32 32)]
export const BADGES = [
  ['pleno', 'Pleno', 'Hacer 37 puntos en un GP', '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>'],
  ['ganador', 'Ganador del GP', 'Ser quien más puntos hace en un GP', '<path d="M10 5h12v6a6 6 0 0 1-12 0z"/><path d="M10 7H6.5c0 4 1.6 6 4 6.3M22 7h3.5c0 4-1.6 6-4 6.3"/><path d="M16 17v5M11 27h10M12.5 27l1-5h5l1 5"/>'],
  ['sabado', 'Sábado perfecto', 'Tu piloto gana la Sprint', '<circle cx="16" cy="19" r="8"/><path d="M11 4l3.5 7M21 4l-3.5 7"/><text x="16" y="23.2" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">S</text>'],
  ['domingo', 'Domingo perfecto', 'Tu piloto gana la carrera', '<circle cx="16" cy="19" r="8"/><path d="M11 4l3.5 7M21 4l-3.5 7"/><text x="16" y="23.2" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="sans-serif">D</text>'],
  ['racha', 'En racha', 'Puntuar 3 GP seguidos', '<path d="M16 28c-5 0-8-3.4-8-7.6 0-4.6 4-6.6 4-11.4 3 1.6 4.6 4 4.6 6.6 1.4-1 2-2.6 2-4.4 3 2.2 5.4 5.4 5.4 9.2 0 4.2-3 7.6-8 7.6z"/><path d="M16 28c-2.2 0-3.6-1.5-3.6-3.4 0-2.2 2-3.2 2-5.4 2.4 1.4 5.2 3 5.2 5.4 0 1.9-1.4 3.4-3.6 3.4z"/>'],
  ['lobo', 'Lobo solitario', 'Ser el único que lleva a un piloto y que puntúe', '<path d="M6 25l3-14 4 4h6l4-4 3 14"/><path d="M9 25c2 2 4.5 3 7 3s5-1 7-3"/><circle cx="12.5" cy="19" r="1" fill="currentColor"/><circle cx="19.5" cy="19" r="1" fill="currentColor"/>'],
  ['remontada', 'Remontada', 'Subir 3 puestos o más en la general en un GP', '<path d="M4 26l8-8 5 4 10-12"/><path d="M20 10h7v7"/>'],
  ['lider', 'Líder', 'Estar 1.º en la general tras un GP', '<path d="M5 24l-1-14 7 6 5-9 5 9 7-6-1 14z"/><path d="M6 28h20"/>'],
  ['nunca', 'Nunca falla', 'Votar en todos los GP de la temporada', '<rect x="5" y="7" width="22" height="20" rx="1.5"/><path d="M5 13h22M11 4v5M21 4v5M11.5 20.5l3 3 6-6"/>'],
  ['madrugador', 'Madrugador', 'Ser el primero en votar en un GP', '<path d="M5 22h22M9 22a7 7 0 0 1 14 0"/><path d="M16 9v3M7 13.5l2 2M25 13.5l-2 2M4 27h24"/>'],
  ['exprimido', 'Exprimido', 'Gastar los 3 usos de un piloto', '<circle cx="7" cy="16" r="3.4" fill="currentColor"/><circle cx="16" cy="16" r="3.4" fill="currentColor"/><circle cx="25" cy="16" r="3.4" fill="currentColor"/>'],
  ['gafe', 'Gafe', 'Hacer 0 puntos habiendo votado', '<ellipse cx="16" cy="17" rx="7" ry="9"/><path d="M8 27L24 7"/>'],
  ['campeon', 'Campeón', 'Ganar la porra al final del año', '<path d="M16 4l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1L16 22.6l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z"/>'],
];

const total = (d, pid, eid) => d.scoreOf(pid, eid)?.total ?? 0;

// Devuelve, para cada jugador, sus logros: { id: [ {event, text} ... ] }.
export function achievementsOf(boot, d, standings) {
  const players = d.activePlayers;
  const finished = boot.events.filter((e) => e.status === 'finished').sort((a, b) => a.round - b.round);
  const out = new Map(players.map((p) => [p.id, Object.fromEntries(BADGES.map(([id]) => [id, []]))]));
  const add = (pid, id, event, text) => out.get(pid)[id].push({ event, text });
  const rname = (v) => (v && d.riders.get(v.rider_id)?.short_name) || '';

  const cum = new Map(players.map((p) => [p.id, 0]));
  const streak = new Map(players.map((p) => [p.id, 0]));
  let prevRank = null;
  for (const e of finished) {
    const gp = `GP de ${e.name}`;
    const best = Math.max(0, ...players.map((p) => total(d, p.id, e.id)));
    const votes = players.map((p) => ({ p, v: d.voteOf(p.id, e.id) })).filter((x) => x.v);
    const first = [...votes].sort((a, b) => String(a.v.updated_at).localeCompare(String(b.v.updated_at)))[0];
    for (const p of players) {
      const v = d.voteOf(p.id, e.id);
      const s = d.scoreOf(p.id, e.id);
      const t = s?.total ?? 0;
      if (t >= 37) add(p.id, 'pleno', e, `${gp} · ${rname(v)} te dio 37 puntos.`);
      if (best > 0 && t === best) add(p.id, 'ganador', e, `${gp} · ${t} puntos, nadie hizo más.`);
      if ((s?.sprint_points ?? 0) >= 12) add(p.id, 'sabado', e, `${gp} · ${rname(v)} ganó la Sprint.`);
      if ((s?.race_points ?? 0) >= 25) add(p.id, 'domingo', e, `${gp} · ${rname(v)} ganó la carrera.`);
      if (v && t > 0 && !votes.some((x) => x.p.id !== p.id && x.v.rider_id === v.rider_id)) add(p.id, 'lobo', e, `${gp} · Solo tú llevabas a ${rname(v)}.`);
      if (v && t === 0) add(p.id, 'gafe', e, `${gp} · 0 puntos con ${rname(v)}.`);
      if (first && first.p.id === p.id) add(p.id, 'madrugador', e, `${gp} · Fuiste el primero en votar.`);
      // Racha: cuenta una vez al llegar a 3 GP seguidos puntuando.
      const run = t > 0 ? streak.get(p.id) + 1 : 0;
      streak.set(p.id, run);
      if (run === 3) add(p.id, 'racha', e, `${gp} · 3 GP seguidos puntuando.`);
      cum.set(p.id, cum.get(p.id) + t);
    }
    const rank = new Map(players.map((p) => [p.id, 1 + players.filter((q) => cum.get(q.id) > cum.get(p.id)).length]));
    for (const p of players) {
      if (rank.get(p.id) === 1) add(p.id, 'lider', e, `${gp} · Líder de la porra.`);
      if (prevRank && prevRank.get(p.id) - rank.get(p.id) >= 3) add(p.id, 'remontada', e, `${gp} · Del ${prevRank.get(p.id)}.º al ${rank.get(p.id)}.º.`);
    }
    prevRank = rank;
  }
  // Pilotos agotados (3 usos) y asistencia perfecta, contando solo los GP ya cerrados.
  const closed = new Set(boot.events.filter((e) => e.status === 'finished' || Date.parse(e.close_at) <= now()).map((e) => e.id));
  for (const p of players) {
    const uses = new Map();
    for (const v of boot.votes) if (v.player_id === p.id && closed.has(v.event_id)) uses.set(v.rider_id, (uses.get(v.rider_id) || 0) + 1);
    for (const [rid, n] of uses) if (n >= 3) add(p.id, 'exprimido', null, `${d.riders.get(rid)?.short_name || ''} · 3 de 3 usos.`);
    if (finished.length >= 3 && finished.every((e) => d.voteOf(p.id, e.id))) add(p.id, 'nunca', null, `Has votado en los ${finished.length} GP de la temporada.`);
  }
  const champ = championOf(d, standings, boot.season);
  if (champ) {
    const p = players.find((x) => x.name === champ.name);
    if (p) add(p.id, 'campeon', null, `Campeón de la PorraGP ${boot.season}.`);
  }
  return out;
}

const PLATE = '<svg class="pl" viewBox="0 0 58 46" preserveAspectRatio="none" aria-hidden="true"><polygon points="9.75,0.75 57.25,0.75 48.25,45.25 0.75,45.25" vector-effect="non-scaling-stroke"/></svg>';

export function BadgePlate({ icon }) {
  return (
    <span
      className="lg-plate"
      dangerouslySetInnerHTML={{
        __html: `${PLATE}<svg class="ic" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`,
      }}
    />
  );
}

// Sección de Estadísticas con todos los logros de un jugador.
export function BadgeGrid({ mine, name, got }) {
  if (!got) return null;
  const done = BADGES.filter(([id]) => got[id].length).length;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h2">{mine ? 'Tus logros' : `Logros de ${name}`}</h2>
        <div className="small muted">
          <b style={{ color: 'var(--text)' }}>{done}</b> de {BADGES.length}
        </div>
      </div>
      <div className="lg-prog" aria-hidden="true">
        <i style={{ width: `${Math.round((done / BADGES.length) * 100)}%` }} />
      </div>
      <div className="lg-grid">
        {BADGES.map(([id, title, rule, icon]) => {
          const n = got[id].length;
          return (
            <div key={id} className={`lg ${n ? '' : 'off'}`} aria-label={`${title}: ${rule}. ${n ? (n > 1 ? `Conseguido ${n} veces` : 'Conseguido') : 'Aún no conseguido'}`}>
              {n > 1 ? <span className="lg-n">×{n}</span> : null}
              <BadgePlate icon={icon} />
              <b>{title}</b>
              <small>{rule}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Tarjeta de Inicio con los logros que el jugador ganó en el último GP terminado.
export function NewBadges({ got, event }) {
  if (!event) return null;
  const fresh = BADGES.flatMap(([id, title, , icon]) => got[id].filter((x) => x.event && x.event.id === event.id).map((x) => ({ id, title, icon, text: x.text })));
  if (!fresh.length) return null;
  const [one, ...rest] = fresh;
  return (
    <a className="lg-new" href="#/porra/estadisticas">
      <BadgePlate icon={one.icon} />
      <span className="t">
        <span>{fresh.length > 1 ? `${fresh.length} logros nuevos` : 'Nuevo logro'}</span>
        <b>{one.title}</b>
        <small>
          {one.text}
          {rest.length ? ` Y además: ${rest.map((r) => r.title).join(', ')}.` : ''}
        </small>
      </span>
    </a>
  );
}
