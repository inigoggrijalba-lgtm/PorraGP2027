// Nombre corto y orden de los equipos. El nombre largo llega de MotoGP con el patrocinador.
const TEAMS = [
  [/ducati lenovo/i, 'Ducati Lenovo'],
  [/aprilia racing/i, 'Aprilia'],
  [/gresini/i, 'Gresini'],
  [/ktm factory/i, 'KTM'],
  [/vr46/i, 'VR46'],
  [/trackhouse/i, 'Trackhouse'],
  [/tech ?3/i, 'KTM Tech3'],
  [/pramac/i, 'Pramac Yamaha'],
  [/yamaha/i, 'Yamaha'],
  [/hrc/i, 'Honda HRC'],
  [/lcr/i, 'LCR Honda'],
];

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
