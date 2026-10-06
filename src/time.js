// Todas las horas se enseñan en hora peninsular, estés donde estés.
const TZ = 'Europe/Madrid';
const fmt = (opts, tz = TZ) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, ...opts });

const F_HM = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
const F_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const F_WD_SHORT = fmt({ weekday: 'short' });
const F_WD_LONG = fmt({ weekday: 'long' });
const F_DAY = fmt({ day: 'numeric' });
const F_MON_SHORT = fmt({ month: 'short' });
const F_MON_LONG = fmt({ month: 'long' });

const clean = (s) => s.replace('.', '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const d = (v) => (v instanceof Date ? v : new Date(v));

export const hm = (v) => F_HM.format(d(v));
export const dayKey = (v) => F_KEY.format(d(v));
// "sáb 10"
export const dayShort = (v) => `${clean(F_WD_SHORT.format(d(v)))} ${F_DAY.format(d(v))}`;
// "Sábado 10 de octubre"
export const dayLong = (v) => `${cap(F_WD_LONG.format(d(v)))} ${F_DAY.format(d(v))} de ${F_MON_LONG.format(d(v))}`;
// "sábado 10 oct"
export const dayMid = (v) => `${F_WD_LONG.format(d(v))} ${F_DAY.format(d(v))} ${clean(F_MON_SHORT.format(d(v)))}`;
export const dayMidCap = (v) => cap(dayMid(v));

// "Hoy 21:26" o "6 oct · 21:26"
export function whenText(v, nowMs = Date.now()) {
  const date = d(v);
  if (dayKey(date) === dayKey(nowMs)) return `Hoy ${hm(date)}`;
  return `${F_DAY.format(date)} ${clean(F_MON_SHORT.format(date))} · ${hm(date)}`;
}

// Fechas sin hora del calendario ("2026-10-09"): "9–11 de octubre", "30 oct – 1 nov".
export function dateRange(start, end) {
  if (!start || !end) return '';
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${end}T12:00:00Z`);
  const day = fmt({ day: 'numeric' }, 'UTC');
  const monL = fmt({ month: 'long' }, 'UTC');
  const monS = fmt({ month: 'short' }, 'UTC');
  if (a.getUTCMonth() === b.getUTCMonth()) return `${day.format(a)}–${day.format(b)} de ${monL.format(a)}`;
  return `${day.format(a)} ${clean(monS.format(a))} – ${day.format(b)} ${clean(monS.format(b))}`;
}

// Tiempo que falta, partido en tres cifras: días/horas/min o, el último día, horas/min/seg.
export function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const two = (n) => String(n).padStart(2, '0');
  if (days >= 1) return [[String(days), days === 1 ? 'DÍA' : 'DÍAS'], [two(hours), 'HORAS'], [two(mins), 'MIN']];
  return [[two(hours), 'HORAS'], [two(mins), 'MIN'], [two(secs), 'SEG']];
}
