// Avisos al móvil: activar, desactivar y preferencias de este dispositivo.
import { ApiError, rpc } from './api.js';
import { call } from './store.js';

export const DEFAULT_PREFS = { r24: true, r2: true, res: true, ses: false, sch: false };

const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent || '');
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// El servicio que recibe los avisos solo existe con la app servida por https.
function registration() {
  return Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 4000))]);
}

function keyBytes(text) {
  const pad = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const bin = atob(pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

// Estado de los avisos en este móvil:
//   sin-soporte | instalar (iPhone sin la app en la pantalla de inicio) | bloqueados | apagados | activos
export async function pushStatus() {
  if (!supported()) return { state: isApple() && !isInstalled() ? 'instalar' : 'sin-soporte' };
  if (Notification.permission === 'denied') return { state: 'bloqueados' };
  const reg = await registration();
  if (!reg) return { state: 'sin-soporte' };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { state: 'apagados' };
  try {
    const s = await call('push_state', { p_endpoint: sub.endpoint });
    if (s.subscribed) return { state: 'activos', prefs: { ...DEFAULT_PREFS, ...s.prefs }, endpoint: sub.endpoint };
    // El móvil está suscrito pero el servidor no lo sabe (otra porra, datos borrados): se vuelve a apuntar.
    const r = await call('push_subscribe', { p_sub: sub.toJSON(), p_prefs: null });
    if (r.ok) return { state: 'activos', prefs: { ...DEFAULT_PREFS, ...r.prefs }, endpoint: sub.endpoint };
  } catch {
    // sin conexión: se enseña como apagado y se podrá reintentar
  }
  return { state: 'apagados' };
}

export async function enablePush() {
  if (!supported()) throw new ApiError('AVISOS_NO_COMPATIBLES');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new ApiError('AVISOS_DENEGADOS');
  const reg = await registration();
  if (!reg) throw new ApiError('AVISOS_NO_COMPATIBLES');
  const key = await rpc('push_public_key');
  if (!key) throw new ApiError('AVISOS_NO_LISTOS');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const r = await call('push_subscribe', { p_sub: sub.toJSON(), p_prefs: null });
  if (!r.ok) throw new ApiError(r.error);
  return { state: 'activos', prefs: { ...DEFAULT_PREFS, ...r.prefs }, endpoint: sub.endpoint };
}

export async function savePrefs(prefs) {
  const reg = await registration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) throw new ApiError('AVISOS_SIN_ACTIVAR');
  const r = await call('push_subscribe', { p_sub: sub.toJSON(), p_prefs: prefs });
  if (!r.ok) throw new ApiError(r.error);
  return { ...DEFAULT_PREFS, ...r.prefs };
}

export async function disablePush() {
  const reg = await registration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await call('push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => null);
  await sub.unsubscribe().catch(() => null);
}

export async function testPush(endpoint) {
  const r = await call('push_test', { p_endpoint: endpoint });
  if (!r.ok) throw new ApiError(r.error);
}

// ¿Merece la pena ofrecer los avisos en Inicio? Solo si se pueden activar y aún no se ha decidido.
export function canOfferPush() {
  return supported() && Notification.permission === 'default';
}
