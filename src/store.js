// Estado de la app: lo que hay guardado en el móvil y lo último que ha dicho el servidor.
import { useSyncExternalStore } from 'react';
import { ApiError, rpc } from './api.js';

const PREFIX = 'porragp.';
const disk = {
  get(key) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, value);
    } catch {
      // sin almacenamiento la app funciona igual, pero pedirá el código al volver a abrirla
    }
  },
  json(key) {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key));
    } catch {
      return null;
    }
  },
};

let state = {
  phase: 'loading', // loading | setup | join | pick | ready | error
  error: null,
  boot: null,
  standings: [],
  eventData: {}, // por GP: sesiones y puntos de los pilotos
  active: null, // jugador con el que se vota ahora
  offline: false,
  syncedAt: null,
};
let token = null;
let offset = 0; // diferencia entre el reloj del servidor y el del móvil
let inflight = null;
const subs = new Set();

function set(patch) {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
}
const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
export const useStore = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;
// Hora del servidor: es la que manda para el cierre del voto.
export const now = () => Date.now() + offset;

function pickActive(boot) {
  const mine = boot.my_players || [];
  const saved = disk.get('active');
  return mine.includes(saved) ? saved : mine[0] || null;
}

function applyBoot(boot, standings, fromCache = false) {
  if (!fromCache) offset = Date.parse(boot.server_time) - Date.now();
  const active = pickActive(boot);
  set({
    boot,
    standings: standings || [],
    active,
    phase: (boot.my_players || []).length ? 'ready' : 'pick',
    error: null,
    offline: fromCache ? state.offline : false,
    syncedAt: fromCache ? state.syncedAt : Date.now(),
  });
}

async function resetDevice() {
  token = null;
  disk.set('token', null);
  disk.set('cache', null);
  disk.set('event', null);
  set({ boot: null, standings: [], eventData: {}, active: null });
  await checkStatus();
}

async function checkStatus() {
  try {
    const s = await rpc('porra_status');
    set({ phase: s.configured ? 'join' : 'setup', error: null });
  } catch (e) {
    set({ phase: 'error', error: e.code || 'ERROR' });
  }
}

// Llamadas que necesitan el identificador del móvil. Si el servidor ya no lo reconoce, se vuelve a pedir el código.
export async function call(name, args = {}) {
  try {
    return await rpc(name, { p_token: token, ...args });
  } catch (e) {
    if (e.code === 'DISPOSITIVO_NO_VALIDO') await resetDevice();
    throw e;
  }
}

export async function init() {
  token = disk.get('token');
  if (!token) {
    set({ phase: 'loading', error: null });
    await checkStatus();
    return;
  }
  const cache = disk.json('cache');
  if (cache && cache.boot) {
    const ev = disk.json('event');
    if (ev && ev.id) set({ eventData: { [ev.id]: ev.data } });
    set({ syncedAt: cache.at || null });
    applyBoot(cache.boot, cache.standings, true);
  } else {
    set({ phase: 'loading', error: null });
  }
  await refresh();
}

export function refresh() {
  if (!token) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [boot, standings] = await Promise.all([call('get_bootstrap'), call('get_standings')]);
      applyBoot(boot, standings);
      disk.set('cache', JSON.stringify({ boot, standings, at: Date.now() }));
      const main = boot.current_event_id || boot.voting_event_id;
      if (main) loadEvent(main, true);
    } catch (e) {
      if (e.code === 'DISPOSITIVO_NO_VALIDO') return;
      if (state.boot) set({ offline: true });
      else set({ phase: 'error', error: e.code || 'ERROR' });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function loadEvent(id, keep = false) {
  try {
    const data = await call('get_event', { p_event: id });
    set({ eventData: { ...state.eventData, [id]: data } });
    if (keep) disk.set('event', JSON.stringify({ id, data }));
  } catch {
    // se queda lo que hubiera; la pantalla avisa si no hay horario
  }
}

// Clasificación de una sesión y parrilla de un GP. Se guardan unos minutos mientras la app está abierta.
const fetched = new Map();
async function cached(key, load) {
  const hit = fetched.get(key);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.data;
  const data = await load();
  fetched.set(key, { at: Date.now(), data });
  return data;
}
export const loadResult = (sessionId) => cached(`s|${sessionId}`, () => call('get_session_result', { p_session: sessionId }));
export const loadGrid = (eventId, category) => cached(`g|${eventId}|${category}`, () => call('get_grid', { p_event: eventId, p_category: category }));
// Pilotos de las tres categorías y ficha de cada uno.
export const loadRiders = () => cached('riders', () => call('get_gp_riders'));
export const loadRider = (id) => cached(`rider|${id}`, () => call('get_gp_rider', { p_rider: id }));

// Histórico. El servidor pide cada dato a MotoGP en segundo plano la primera vez que alguien lo consulta:
// mientras llega contesta "pending" y aquí se vuelve a preguntar. Lo ya pedido sale al momento.
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function askHistory(args) {
  for (let i = 0; i < 28; i += 1) {
    const res = await call('history', args);
    if (res && res.state === 'hit') return res;
    if (res && res.state === 'error') throw new ApiError(res.status === 404 ? 'HISTORICO_SIN_DATOS' : 'HISTORICO_FALLO');
    await wait(i < 5 ? 500 : 900);
  }
  throw new ApiError('HISTORICO_FALLO');
}
const asked = new Map();
export function loadHistory(season, event, category, session) {
  const key = [season, event, category, session].map((v) => v || '').join('|');
  const hit = asked.get(key);
  if (hit && Date.now() - hit.at < 10 * 60000) return hit.promise;
  const args = {};
  if (season) args.p_season = season;
  if (event) args.p_event = event;
  if (category) args.p_category = category;
  if (session) args.p_session = session;
  const promise = askHistory(args);
  asked.set(key, { at: Date.now(), promise });
  promise.catch(() => asked.get(key)?.promise === promise && asked.delete(key));
  return promise;
}

function deviceLabel() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  return 'Ordenador';
}

export async function join(code) {
  const r = await rpc('join_device', { p_code: code, p_label: deviceLabel() });
  if (!r.ok) {
    if (r.error === 'SIN_CONFIGURAR') set({ phase: 'setup' });
    throw new ApiError(r.error);
  }
  token = r.token;
  disk.set('token', token);
  await refresh();
}

export async function setup(code, password) {
  const r = await rpc('setup_porra', { p_code: code, p_admin_password: password });
  if (!r.ok) {
    if (r.error === 'YA_CONFIGURADA') set({ phase: 'join' });
    throw new ApiError(r.error);
  }
  await join(code);
}

export async function setPlayers(ids, on) {
  for (const id of ids) {
    const r = await call('set_device_player', { p_player: id, p_on: on });
    if (!r.ok) throw new ApiError(r.error);
  }
  if (on && !state.active && ids.length) disk.set('active', ids[0]);
  await refresh();
}

export function setActive(id) {
  disk.set('active', id);
  set({ active: id });
}

export async function adminLogin(password) {
  const r = await call('admin_login', { p_password: password });
  if (!r.ok) throw new ApiError(r.error);
  await refresh();
}

export async function adminLogout() {
  await call('admin_logout');
  await refresh();
}

// Consulta de administrador. Si la sesión ha caducado, se recarga para volver a pedir la contraseña.
export async function adminRead(name, args = {}) {
  try {
    return await call(name, args);
  } catch (e) {
    if (e.code === 'NO_ADMIN') await refresh();
    throw e;
  }
}

// Cambio de administrador: después se recargan los datos y, si toca, el GP modificado.
export async function adminDo(name, args = {}, eventId = null) {
  const r = await adminRead(name, args);
  if (r && r.ok === false) throw new ApiError(r.error);
  await refresh();
  if (eventId) await loadEvent(eventId);
  return r;
}

export async function vote(eventId, riderId) {
  const r = await call('cast_vote', { p_player: state.active, p_event: eventId, p_rider: riderId });
  if (!r.ok) {
    if (r.error === 'VOTO_CERRADO' || r.error === 'AUN_NO_SE_VOTA_ESTE_GP') refresh();
    throw new ApiError(r.error);
  }
  await refresh();
  return r;
}
