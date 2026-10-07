// Histórico: nombres en castellano, orden de las categorías y lectura de las clasificaciones antiguas.
import { lapTime, rowTime } from './results.js';

// MotoGP identifica cada gran premio con unas siglas que no cambian de un año a otro.
const GP = {
  ALR: 'Algarve', AME: 'Las Américas', ANC: 'Andalucía', ARA: 'Aragón', ARG: 'Argentina', AUS: 'Australia', AUT: 'Austria',
  BAW: 'Baden-Wurtemberg', BEL: 'Bélgica', BRA: 'Brasil', CAN: 'Canadá', CAT: 'Cataluña', CHN: 'China', CZE: 'República Checa',
  DOH: 'Doha', EGER: 'Alemania Or.', EMI: 'Emilia-Romaña', EUR: 'Europa', FIM: 'FIM', FIN: 'Finlandia', FRA: 'Francia',
  GBR: 'Gran Bretaña', GER: 'Alemania', HUN: 'Hungría', IMO: 'Imola', INA: 'Indonesia', IND: 'India', INP: 'Indianápolis',
  ITA: 'Italia', JPN: 'Japón', JUG: 'Yugoslavia', MAD: 'Madrid', MAL: 'Malasia', NAT: 'Naciones', NED: 'Países Bajos',
  PAC: 'Pacífico', POR: 'Portugal', QAT: 'Qatar', RIO: 'Río', RSA: 'Sudáfrica', RSM: 'San Marino', SLD: 'Solidaridad',
  SPA: 'España', STY: 'Estiria', SWE: 'Suecia', SWI: 'Suiza', TCH: 'Checoslovaquia', TER: 'Teruel', THA: 'Tailandia',
  TT: 'Tourist Trophy', TUR: 'Turquía', ULST: 'Ulster', USA: 'Estados Unidos', VAL: 'Valencia', VDU: 'Vitesse du Mans',
  VEN: 'Venezuela', WGER: 'Alemania Occ.',
};
// Títulos que no son "GP de" + el nombre corto.
const TITLE = {
  ALR: 'GP del Algarve', AME: 'GP de las Américas', CZE: 'GP de la República Checa', EGER: 'GP de Alemania Oriental', FIM: 'GP FIM',
  IND: 'GP de la India', NAT: 'GP de las Naciones', NED: 'GP de los Países Bajos', PAC: 'GP del Pacífico',
  SLD: 'GP Solidario de Barcelona', TT: 'Tourist Trophy', VAL: 'GP de la Comunidad Valenciana', VDU: 'GP Vitesse du Mans',
  WGER: 'GP de Alemania Occidental',
};

let regions = null;
function country(iso) {
  try {
    regions = regions || new Intl.DisplayNames(['es'], { type: 'region' });
    return iso && iso.length === 2 ? regions.of(iso) : '';
  } catch {
    return '';
  }
}
// "WEST GERMANY GRAND PRIX" -> "West Germany", por si aparece un gran premio que no está en la lista.
const tidy = (name) =>
  String(name || '')
    .replace(/\b(MOTORCYCLE |MOTORRAD )?(GRAND PRIX|GRAN PREMIO|GRAN PREMI|GRANDE PR[EÉ]MIO)\b( OF| DE| DI| D'| VON| DO)?( THE| LA)?/gi, '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

export function gpLabel(event, year) {
  if (event.short === 'CZE' && year >= 2025) return 'Chequia';
  return GP[event.short] || country(event.iso) || tidy(event.name) || event.short || '';
}
export function gpTitle(event, year) {
  if (event.short === 'CZE' && year >= 2025) return 'GP de Chequia';
  return TITLE[event.short] || `GP de ${gpLabel(event, year)}`;
}

// De la categoría reina a la más pequeña. 500cc y MotoGP ocupan el mismo puesto, igual que 250cc y Moto2.
const RANK = { motogp: 0, '500cc': 0, '350cc': 1, moto2: 2, '250cc': 2, moto3: 3, '125cc': 3, '80cc': 4, '50cc': 5, motoe: 6 };
export const catName = (c) => String((c && c.name) || '').replace(/[™®]/g, '').trim();
export const catSlug = (c) => catName(c).toLowerCase().replace(/\s+/g, '');
export const slugRank = (slug) => (slug in RANK ? RANK[slug] : null);
export const catRank = (c) => RANK[catSlug(c)] ?? 9;
export const sortCats = (list) => [...(list || [])].sort((a, b) => catRank(a) - catRank(b) || catName(a).localeCompare(catName(b)));

// Las fechas del histórico llegan sin zona: se leen tal cual, sin pasarlas a hora peninsular.
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function oldDate(value) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return '';
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

const OUT = {
  OUTSTND: 'No terminó',
  NOTFINISHFIRST: 'No terminó',
  NOTSTARTED: 'No salió',
  NOTONRESTARTGRID: 'No salió',
  DISQUALIFIED: 'Descalificado',
  OUTOFLAPS: 'Sin clasificar',
  OUTOFTIME: 'Fuera de tiempo',
};
// 114.8 s -> "1:54.800"
function gapText(seconds) {
  if (seconds < 60) return seconds.toFixed(3);
  const m = Math.floor(seconds / 60);
  return `${m}:${(seconds - m * 60).toFixed(3).padStart(6, '0')}`;
}
// De muchas carreras antiguas solo se guardó el tiempo de los primeros: el resto se queda en blanco.
export function oldTime(row, race) {
  if (!race) return rowTime(row, false);
  if (row.pos == null) return OUT[row.status] || 'No terminó';
  if (row.pos === 1) return lapTime(row.time);
  const laps = Number(row.gap_lap || 0);
  if (laps > 0) return `+${laps} ${laps === 1 ? 'vuelta' : 'vueltas'}`;
  const gap = Number(row.gap || 0);
  return gap > 0 ? `+${gapText(gap)}` : '';
}

// En el histórico no se usan los colores de los equipos de hoy: un piloto de 2019 no corría donde corre ahora.
export function oldRider(row) {
  const words = String(row.full_name || '').trim().split(/\s+/);
  return {
    short: words.length > 1 ? `${words[0].charAt(0)}. ${words.slice(1).join(' ')}` : words[0] || '',
    full: row.full_name || '',
    number: row.number ?? '',
    moto: typeof row.constructor === 'string' ? row.constructor : '',
    color: '#2B2B2F',
    ink: '#F5F4F2',
  };
}
