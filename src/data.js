// Vistas de los datos del servidor, calculadas una sola vez por carga.
import { MAX_USES } from './config.js';
import { sortRiders } from './teams.js';

let lastBoot = null;
let lastIndex = null;

export function indexOf(boot) {
  if (boot === lastBoot) return lastIndex;
  const players = new Map(boot.players.map((p) => [p.id, p]));
  const riders = new Map(boot.riders.map((r) => [r.id, r]));
  const events = new Map(boot.events.map((e) => [e.id, e]));
  const votes = new Map(); // "jugador|gp" -> voto
  for (const v of boot.votes) votes.set(`${v.player_id}|${v.event_id}`, v);
  const scores = new Map();
  for (const s of boot.scores) scores.set(`${s.player_id}|${s.event_id}`, s);
  const finished = boot.events.filter((e) => e.status === 'finished');

  lastIndex = {
    players,
    riders,
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
