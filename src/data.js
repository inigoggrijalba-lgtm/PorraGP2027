// Vistas de los datos del servidor, calculadas una sola vez por carga.
import { MAX_USES } from './config.js';
import { sortRiders } from './teams.js';
import { dayMid, hm } from './time.js';

let lastBoot = null;
let lastIndex = null;

export function indexOf(boot) {
  if (boot === lastBoot) return lastIndex;
  const players = new Map(boot.players.map((p) => [p.id, p]));
  const riders = new Map(boot.riders.map((r) => [r.id, r]));
  const byApi = new Map(boot.riders.filter((r) => r.api_uuid).map((r) => [r.api_uuid, r])); // por identificador de MotoGP
  const events = new Map(boot.events.map((e) => [e.id, e]));
  const votes = new Map(); // "jugador|gp" -> voto
  for (const v of boot.votes) votes.set(`${v.player_id}|${v.event_id}`, v);
  const scores = new Map();
  for (const s of boot.scores) scores.set(`${s.player_id}|${s.event_id}`, s);
  const finished = boot.events.filter((e) => e.status === 'finished');

  lastIndex = {
    players,
    riders,
    byApi,
    events,
    rounds: boot.events.length,
    activePlayers: boot.players.filter((p) => p.active),
    votable: sortRiders(boot.riders.filter((r) => r.votable)),
    finishedCount: finished.length,
    lastFinished: finished.length ? finished[finished.length - 1] : null,
    voteOf: (playerId, eventId) => votes.get(`${playerId}|${eventId}`) || null,
    scoreOf: (playerId, eventId) => scores.get(`${playerId}|${eventId}`) || null,
    // Veces que el jugador se ha quedado con ese piloto, sin contar el GP que se está votando.
    usesOf: (playerId, riderId, exceptEventId) =>
      boot.votes.filter((v) => v.player_id === playerId && v.rider_id === riderId && v.event_id !== exceptEventId).length,
    spentCount(playerId, exceptEventId) {
      return this.votable.filter((r) => this.usesOf(playerId, r.id, exceptEventId) >= MAX_USES).length;
    },
  };
  lastBoot = boot;
  return lastIndex;
}

// Sesiones del GP que caen dentro de sus fechas (MotoGP publica a veces horarios de relleno).
export function sessionsOf(eventData, event, category) {
  if (!eventData || !event) return [];
  const from = Date.parse(`${event.date_start}T00:00:00Z`) - 36 * 3600e3;
  const to = Date.parse(`${event.date_end}T23:59:59Z`) + 36 * 3600e3;
  return eventData.sessions.filter((s) => {
    if (category && s.category !== category) return false;
    const t = Date.parse(s.starts_at);
    return t >= from && t <= to;
  });
}

export const ordinal = (n) => `${n}.º`;

// Fin de temporada: el campeón, el podio y sus datos. Nada hasta que se haya corrido el último GP.
export function championOf(d, standings, season) {
  const list = standings.filter((s) => s.active);
  if (!d.rounds || d.finishedCount < d.rounds || list.length < 2) return null;
  const finished = [...d.events.values()].filter((e) => e.status === 'finished');
  const champ = list[0];
  // GP ganados: los que cerró con más puntos que nadie (si empata, cuenta para todos los empatados).
  let wins = 0;
  for (const e of finished) {
    const best = Math.max(0, ...list.map((s) => d.scoreOf(s.player_id, e.id)?.total || 0));
    if (best > 0 && (d.scoreOf(champ.player_id, e.id)?.total || 0) === best) wins += 1;
  }
  // Piloto fetiche: el que más veces votó; si hay empate, con el que sumó más puntos.
  const tally = new Map();
  for (const e of finished) {
    const v = d.voteOf(champ.player_id, e.id);
    if (!v) continue;
    const t = tally.get(v.rider_id) || { n: 0, pts: 0 };
    t.n += 1;
    t.pts += d.scoreOf(champ.player_id, e.id)?.total || 0;
    tally.set(v.rider_id, t);
  }
  const fav = [...tally.entries()].sort((a, b) => b[1].n - a[1].n || b[1].pts - a[1].pts)[0];
  return {
    season,
    rounds: d.rounds,
    players: list.length,
    name: champ.name,
    total: champ.total,
    wins,
    margin: champ.total - list[1].total,
    rider: fav ? d.riders.get(fav[0]) || null : null,
    podium: list.slice(0, 3).map((s) => ({ name: s.name, total: s.total })),
  };
}

// El siguiente GP cuya votación aún no se ha abierto (se abre el lunes después de la carrera anterior).
export function nextOpening(boot, t) {
  return boot.events.find((e) => e.status === 'scheduled' && e.open_at && Date.parse(e.open_at) > t && Date.parse(e.close_at) > t) || null;
}
export const openText = (e) => `${dayMid(e.open_at)} a las ${hm(e.open_at)}`;
