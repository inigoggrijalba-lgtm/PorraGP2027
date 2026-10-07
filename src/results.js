// Cómo se nombran y se leen las sesiones y sus clasificaciones.
import { teamColors } from './teams.js';

const NAMES = {
  // [ficha corta, título, nombre completo, título grande de la imagen]
  FP: ['FP', 'Libres', 'Entrenamientos libres', 'FP'],
  PR: ['Práctica', 'Práctica', 'Práctica', 'Práctica'],
  Q: ['Q', 'Clasificación Q', 'Clasificación Q', 'Q'],
  SPR: ['Sprint', 'Sprint', 'Carrera Sprint', 'Sprint'],
  WUP: ['Warm up', 'Warm up', 'Warm up', 'Warm up'],
  RAC: ['Carrera', 'Carrera', 'Carrera', 'Carrera'],
};

function named(code, which) {
  const m = /^([A-Z]+?)(\d*)$/.exec(code || '');
  if (!m || !NAMES[m[1]]) return code || '';
  const base = NAMES[m[1]][which];
  if (!m[2]) return base;
  // FP1 y Q2 van pegados; "Libres 1" y "Carrera 2", separados.
  const glued = base === 'FP' || base.endsWith('Q');
  return glued ? `${base}${m[2]}` : `${base} ${m[2]}`;
}
export const chipName = (code) => named(code, 0);
export const titleName = (code) => named(code, 1);
export const fullName = (code) => named(code, 2);
export const bigName = (code) => named(code, 3);
export const isRace = (code) => /^(SPR|RAC)/.test(code || '');

const FILES = {
  classification: 'Clasificación',
  grid: 'Parrilla',
  analysis: 'Análisis',
  session: 'Sesión',
  best_partial_time: 'Mejores parciales',
  maximum_speed: 'Velocidad punta',
  average_speed: 'Velocidad media',
  fast_lap_sequence: 'Vueltas rápidas',
  fast_lap_rider: 'Vuelta rápida por piloto',
  combined_practice: 'Libres combinados',
  combined_classification: 'Clasificación combinada',
  lap_chart: 'Vuelta a vuelta',
  analysis_by_lap: 'Análisis por vuelta',
  world_standing: 'Mundial',
};
// PDF de la sesión, en orden de interés, sin el que ya tiene botón propio.
export function fileList(files, except) {
  const have = files || {};
  const known = Object.keys(FILES)
    .filter((k) => have[k] && k !== except)
    .map((k) => ({ key: k, label: FILES[k], url: have[k] }));
  const extra = Object.keys(have)
    .filter((k) => !FILES[k] && k !== except)
    .map((k) => ({ key: k, label: k.replace(/_/g, ' '), url: have[k] }));
  return [...known, ...extra];
}

// "Pista seca · Aire 18° · Asfalto 23°"
export function conditionText(cond) {
  if (!cond) return '';
  const parts = [];
  const track = String(cond.track || '').toLowerCase();
  if (track === 'dry') parts.push('Pista seca');
  else if (track === 'wet') parts.push('Pista mojada');
  const deg = (v) => (/\d/.test(v || '') ? `${String(v).replace(/[^\d.,-]/g, '')}°` : null);
  if (deg(cond.air)) parts.push(`Aire ${deg(cond.air)}`);
  if (deg(cond.ground)) parts.push(`Asfalto ${deg(cond.ground)}`);
  return parts.join(' · ');
}

// "01:44.073" -> "1:44.073"
export const lapTime = (t) => String(t || '').replace(/^0(\d:)/, '$1');

const OUT = {
  OUTSTND: 'No terminó',
  NOTFINISHFIRST: 'No terminó',
  NOTSTARTED: 'No salió',
  NOTONRESTARTGRID: 'No salió',
  DISQUALIFIED: 'Descalificado',
  OUTOFLAPS: 'Sin clasificar',
  OUTOFTIME: 'Fuera de tiempo',
};

// Lo que va en la columna de tiempo: el tiempo del primero y la diferencia de los demás.
export function rowTime(row, race) {
  if (race) {
    if (row.pos == null) return OUT[row.status] || 'No terminó';
    if (row.pos === 1) return lapTime(row.time);
    const laps = Number(row.gap_lap || 0);
    if (laps > 0) return `+${laps} ${laps === 1 ? 'vuelta' : 'vueltas'}`;
    return row.gap ? `+${row.gap}` : lapTime(row.time);
  }
  if (!row.time) return 'Sin tiempo';
  if (row.pos === 1 || !row.gap || Number(row.gap) === 0) return lapTime(row.time);
  return `+${row.gap}`;
}

// Nombre, moto y colores de una fila. Los pilotos de MotoGP de la porra salen con su nombre de siempre.
export function rowRider(row, d, category) {
  const known = category === 'MotoGP' && row.rider_uuid ? d.byApi.get(row.rider_uuid) : null;
  const words = String(row.full_name || '').trim().split(/\s+/);
  const initialed = words.length > 1 ? `${words[0].charAt(0)}. ${words.slice(1).join(' ')}` : words[0] || '';
  const team = row.team || (known ? known.team_name : '');
  const colors = known && known.team_color ? [known.team_color, known.text_color || '#0A0A0B'] : teamColors(category === 'MotoGP' ? team : '');
  const brand = (r) => (r && typeof r.constructor === 'string' ? r.constructor : '');
  return {
    short: known && known.votable ? known.short_name : initialed,
    full: known && known.votable ? known.full_name : row.full_name || '',
    number: row.number ?? (known ? known.number : ''),
    moto: brand(row) || brand(known),
    color: colors[0],
    ink: colors[1],
  };
}
