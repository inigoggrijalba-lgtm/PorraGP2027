// Nombre corto y orden de los equipos. El nombre largo llega de MotoGP con el patrocinador.
const TEAMS = [
  [/ducati lenovo/i, 'Ducati Lenovo', '#D40000', '#FFFFFF'],
  [/aprilia racing/i, 'Aprilia', '#00A651', '#0A0A0B'],
  [/gresini/i, 'Gresini', '#75C9D9', '#0A0A0B'],
  [/ktm factory/i, 'KTM', '#FF6600', '#0A0A0B'],
  [/vr46/i, 'VR46', '#FDEE00', '#0A0A0B'],
  [/trackhouse/i, 'Trackhouse', '#0B3FA8', '#FFFFFF'],
  [/tech ?3/i, 'KTM Tech3', '#FF6600', '#0A0A0B'],
  [/pramac/i, 'Pramac Yamaha', '#8A2BE2', '#FFFFFF'],
  [/yamaha/i, 'Yamaha', '#0033A0', '#FFFFFF'],
  [/hrc/i, 'Honda HRC', '#F58025', '#0A0A0B'],
  [/lcr/i, 'LCR Honda', '#FFFFFF', '#0A0A0B'],
];

// Color de la placa del dorsal según el nombre del equipo; gris si no es un equipo de MotoGP.
export function teamColors(teamName) {
  const t = TEAMS.find(([re]) => re.test(teamName || ''));
  return t ? [t[2], t[3]] : ['#3A3A3F', '#F5F4F2'];
}

function teamIndex(name) {
  const i = TEAMS.findIndex(([re]) => re.test(name || ''));
  return i < 0 ? TEAMS.length : i;
}

export function teamShort(rider) {
  const i = teamIndex(rider.team_name);
  if (i < TEAMS.length) return TEAMS[i][1];
  // 'constructor' es el nombre de la marca tal como llega de la base de datos
  const brand = typeof rider.constructor === 'string' ? rider.constructor : '';
  return brand || rider.team_name || '';
}

export function sortRiders(list) {
  return [...list].sort(
    (a, b) => teamIndex(a.team_name) - teamIndex(b.team_name) || (a.team_name || '').localeCompare(b.team_name || '') || a.number - b.number,
  );
}

const SESSION_NAMES = {
  FP1: 'Libres 1',
  PR: 'Práctica',
  FP2: 'Libres 2',
  Q1: 'Clasificación Q1',
  Q2: 'Clasificación Q2',
  SPR: 'Sprint',
  WUP: 'Warm up',
  RAC: 'Carrera',
};
export const sessionName = (code) => SESSION_NAMES[code] || code;
