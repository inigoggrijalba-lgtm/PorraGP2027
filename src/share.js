// Imágenes para compartir en el grupo: clasificación, parrilla y horario.
// Se pintan en la propia app, a 1080 px de ancho, con los colores y tipografías de la porra.
import { bigName, conditionText, fullName, isRace, rowRider, rowTimes, titleName } from './results.js';
import { oldRider } from './history.js';
import { dateRange, dayKey, hm } from './time.js';

const W = 1080;
const PAD = 56;
const C = { bg: '#0A0A0B', line: '#2B2B2F', text: '#F5F4F2', text2: '#B4B3AF', red: '#E10600', redText: '#FF4B3A' };
const DISPLAY = "Orbitron, 'Arial Black', sans-serif";
const COND = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const BODY = "Barlow, 'Segoe UI', sans-serif";

const upper = (s) => String(s || '').toLocaleUpperCase('es');
const TZ = 'Europe/Madrid';
const fmt = (opts) => new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts });
const weekday = (v) => fmt({ weekday: 'long' }).format(new Date(v));
const dayNum = (v) => fmt({ day: 'numeric' }).format(new Date(v));
const longDate = (v) => `${weekday(v)} ${dayNum(v)} ${fmt({ month: 'short' }).format(new Date(v)).replace('.', '')} ${fmt({ year: 'numeric' }).format(new Date(v))}`;

// Las tipografías tienen que estar cargadas antes de pintar; si no, el lienzo usa otra.
async function fonts() {
  if (!document.fonts || !document.fonts.load) return;
  const wanted = ['900 100px Orbitron', '800 40px Orbitron', '700 30px Orbitron', '500 30px Orbitron', '700 40px "Barlow Condensed"', '600 40px "Barlow Condensed"', '500 40px "Barlow Condensed"', '400 28px Barlow'];
  await Promise.all(wanted.map((f) => document.fonts.load(f).catch(() => null)));
}

function canvasOf(height) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

// Texto con tamaño, color, alineación y separación entre letras. Devuelve el ancho pintado.
function text(ctx, str, x, y, { font, color = C.text, align = 'left', spacing = 0, maxWidth = 0 }) {
  let size = font.size;
  const set = () => {
    ctx.font = `${font.weight} ${size}px ${font.family}`;
  };
  const measure = () => ctx.measureText(str).width + spacing * Math.max(0, str.length - 1);
  set();
  // Si no cabe, se encoge la letra antes que cortar el texto.
  while (maxWidth && measure() > maxWidth && size > 12) {
    size -= 1;
    set();
  }
  const width = measure();
  ctx.fillStyle = color;
  let start = x;
  if (align === 'right') start = x - width;
  else if (align === 'center') start = x - width / 2;
  ctx.textAlign = 'left';
  if (!spacing) {
    ctx.fillText(str, start, y);
    return width;
  }
  let cx = start;
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return width;
}

const F = (weight, size, family) => ({ weight, size, family });

function kerb(ctx, y, height = 14) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD, y, W - 2 * PAD, height);
  ctx.clip();
  ctx.fillStyle = '#F5F4F2';
  ctx.fillRect(PAD, y, W - 2 * PAD, height);
  ctx.fillStyle = C.red;
  // Franjas inclinadas a 45°, 32 px de rojo y 32 de blanco.
  const step = 64 * Math.SQRT2;
  for (let x = PAD - height - step; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + height, y);
    ctx.lineTo(x + height + step / 2, y);
    ctx.lineTo(x + step / 2, y + height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function plate(ctx, x, y, w, h, slant, color, ink, label, size) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  text(ctx, String(label ?? ''), x + w / 2, y + h / 2 + size * 0.36, { font: F(800, size, DISPLAY), color: ink, align: 'center' });
}

function hline(ctx, y, color = C.line, width = 2, x0 = PAD, x1 = W - PAD) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, x1 - x0, width);
}

// Cabecera común: a la izquierda qué es, a la derecha de qué GP. Devuelve dónde acaba.
function header(ctx, { label, title, titleSize, sub, rightTop, rightSub }) {
  const rightW = 400;
  text(ctx, upper(label), PAD, 86, { font: F(600, 30, COND), color: C.text2, spacing: 4, maxWidth: W - 2 * PAD - 180 });
  text(ctx, upper(title), PAD, 86 + titleSize * 0.92, { font: F(900, titleSize, DISPLAY), spacing: 1, maxWidth: W - 2 * PAD - rightW - 32 });
  const bottom = 86 + titleSize * 0.92 + (sub ? 46 : 12);
  if (sub) text(ctx, sub, PAD, bottom - 4, { font: F(400, 28, BODY), color: C.text2, maxWidth: W - 2 * PAD - rightW - 32 });

  const rx = W - PAD;
  text(ctx, rightSub, rx, bottom - 4, { font: F(400, 28, BODY), color: C.text2, align: 'right', maxWidth: rightW });
  text(ctx, upper(rightTop), rx, bottom - 44, { font: F(600, 46, COND), align: 'right', maxWidth: rightW });
  // "PorraGP" con las dos últimas letras en rojo
  ctx.font = `800 40px ${DISPLAY}`;
  const gp = ctx.measureText('GP').width;
  text(ctx, 'GP', rx, bottom - 100, { font: F(800, 40, DISPLAY), color: C.redText, align: 'right' });
  text(ctx, 'Porra', rx - gp, bottom - 100, { font: F(800, 40, DISPLAY), align: 'right' });
  return bottom;
}

function footer(ctx, height, left, right = 'Datos oficiales de MotoGP') {
  if (left) text(ctx, left, PAD, height - 46, { font: F(400, 24, BODY), color: C.text2, maxWidth: W - 2 * PAD - 310 });
  text(ctx, right, W - PAD, height - 46, { font: F(400, 24, BODY), color: C.text2, align: 'right' });
}

// Clasificación de una sesión.
export async function resultImage({ event, session, rows, d, old = false }) {
  await fonts();
  const race = isRace(session.code);
  // En el histórico no hay equipos de hoy ni dorsales antiguos, y los puntos solo salen si los hubo.
  const riderOf = (row) => (old ? oldRider(row) : rowRider(row, d, session.category));
  const withPoints = race && (!old || rows.some((r) => r.points > 0));
  const withPlates = !old || rows.some((r) => r.number != null && r.number !== '');
  // Cada fila lleva dos líneas de tiempo: el del piloto y, debajo, sus dos diferencias.
  const rowH = 64;
  const top = 302;
  const { canvas, ctx } = canvasOf(top + rows.length * rowH + 82);
  const bottom = header(ctx, {
    label: `${session.category} · ${fullName(session.code)}`,
    title: bigName(session.code),
    titleSize: 112,
    sub: conditionText(session.condition) || ' ',
    rightTop: event.title || `GP de ${event.name}`,
    rightSub: `${event.circuit} · ${session.when || longDate(session.starts_at)}`,
  });
  kerb(ctx, bottom + 24);
  let y = bottom + 24 + 14 + 16;
  const nameX = withPlates ? PAD + 186 : PAD + 84;
  rows.forEach((row, i) => {
    const r = riderOf(row);
    const t = rowTimes(rows, i, race);
    const mid = y + 31;
    const first = row.pos === 1;
    text(ctx, row.pos == null ? '–' : String(row.pos), PAD + 58, mid + 11, { font: F(800, 30, DISPLAY), color: first ? C.redText : C.text, align: 'right' });
    if (withPlates && r.number !== '' && r.number != null) plate(ctx, PAD + 80, mid - 19, 84, 38, 10, r.color, r.ink, r.number, 24);
    text(ctx, r.full, nameX, mid + 13, { font: F(600, 38, COND), maxWidth: 626 - nameX });
    text(ctx, r.moto, 642, mid + 9, { font: F(400, 26, BODY), color: C.text2, maxWidth: withPoints ? 118 : 150 });
    // En Sprint y carrera, a la derecha del todo, los puntos que da cada piloto en la porra.
    const timeRight = withPoints ? W - PAD - 78 : W - PAD;
    const timeWidth = withPoints ? 196 : 222;
    text(ctx, t.main, timeRight, t.sub ? mid - 1 : mid + 10, { font: F(700, 29, DISPLAY), color: first || t.sub ? C.text : C.text2, align: 'right', maxWidth: timeWidth });
    if (t.sub) text(ctx, t.sub, timeRight, mid + 24, { font: F(500, 20, DISPLAY), color: C.text2, align: 'right', maxWidth: timeWidth });
    if (withPoints) text(ctx, row.points ? String(row.points) : '', W - PAD, mid + 10, { font: F(800, 29, DISPLAY), color: C.redText, align: 'right', maxWidth: 62 });
    hline(ctx, y + rowH - 2);
    y += rowH;
  });
  const below = 'Debajo: diferencia con el 1.º / con el de delante';
  footer(ctx, canvas.height, !race ? `Mejor vuelta · ${below[0].toLowerCase()}${below.slice(1)}` : withPoints ? `${below} · en rojo, los puntos` : below);
  return canvas;
}

// Parrilla en filas de tres, escalonada como en la pista.
export async function gridImage({ event, category, rows, d, when }) {
  await fonts();
  const colGap = 28;
  const cellW = (W - 2 * PAD - 2 * colGap) / 3;
  const pitch = 142;
  const lines = Math.ceil(rows.length / 3);
  const { canvas, ctx } = canvasOf(322 + lines * pitch - 22 + 110);
  const bottom = header(ctx, {
    label: `${category} · ${category === 'MotoGP' ? 'Sprint y carrera' : 'Carrera'}`,
    title: 'Parrilla',
    titleSize: 104,
    sub: '',
    rightTop: `GP de ${event.name}`,
    rightSub: `${event.circuit} · ${when ? longDate(when) : dateRange(event.date_start, event.date_end)}`,
  });
  kerb(ctx, bottom + 28);
  const top = bottom + 28 + 14 + 32;
  rows.forEach((row, i) => {
    const col = i % 3;
    const x = PAD + col * (cellW + colGap);
    const y = top + Math.floor(i / 3) * pitch + col * 18;
    const r = rowRider(row, d, category);
    // El cajón de salida: una línea arriba con los dos laterales.
    ctx.fillStyle = C.text;
    ctx.fillRect(x, y, cellW, 4);
    ctx.fillRect(x, y, 4, 14);
    ctx.fillRect(x + cellW - 4, y, 4, 14);
    const base = y + 22;
    text(ctx, String(row.pos ?? i + 1), x + 4 + 38, base + 46, { font: F(900, 50, DISPLAY), color: i === 0 ? C.redText : C.text, align: 'center', maxWidth: 76 });
    const tx = x + 4 + 76 + 10;
    text(ctx, r.short, tx, base + 27, { font: F(600, 32, COND), maxWidth: cellW - 98 });
    plate(ctx, tx, base + 37, 52, 24, 6, r.color, r.ink, r.number, 15);
    text(ctx, row.time ? String(row.time).replace(/^0(\d:)/, '$1') : 'Sin tiempo', tx + 62, base + 56, { font: F(500, 21, DISPLAY), color: C.text2, maxWidth: cellW - 98 - 62 });
  });
  footer(ctx, canvas.height, 'Tiempos de clasificación (Q1 y Q2)');
  return canvas;
}

// Horario de MotoGP del GP, con el recordatorio de voto.
export async function scheduleImage({ event, sessions, rounds, voteOpen }) {
  await fonts();
  const days = [];
  for (const s of sessions) {
    const key = dayKey(s.starts_at);
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, at: s.starts_at, list: [] });
    days[days.length - 1].list.push(s);
  }
  const rowH = 72;
  const bodyH = days.reduce((sum, day, i) => sum + (i === 0 ? 72 : 84) + day.list.length * rowH, 0);
  const banner = voteOpen && !event.close_provisional;
  const start = 298;
  const { canvas, ctx } = canvasOf(start + bodyH + (banner ? 36 + 104 : 0) + 112);
  const bottom = header(ctx, {
    label: 'Horario MotoGP · Hora peninsular',
    title: event.name,
    titleSize: 92,
    sub: '',
    rightTop: event.circuit,
    rightSub: `${dateRange(event.date_start, event.date_end)} de ${fmt({ year: 'numeric' }).format(new Date(`${event.date_start}T12:00:00Z`))}`,
  });
  kerb(ctx, bottom + 28);
  let y = bottom + 28 + 14 + 8;
  days.forEach((day, i) => {
    const headH = i === 0 ? 72 : 84;
    text(ctx, upper(`${weekday(day.at)} ${dayNum(day.at)}`), PAD, y + headH - 16, { font: F(700, 30, DISPLAY), spacing: 2.4 });
    hline(ctx, y + headH - 3, C.text, 3);
    y += headH;
    for (const s of day.list) {
      const big = isRace(s.code);
      const mid = y + rowH / 2;
      if (big) {
        text(ctx, upper(titleName(s.code)), PAD, mid + 15, { font: F(700, 44, COND) });
        text(ctx, hm(s.starts_at), W - PAD, mid + 15, { font: F(900, 42, DISPLAY), color: C.redText, align: 'right' });
      } else {
        text(ctx, titleName(s.code), PAD, mid + 14, { font: F(500, 40, COND) });
        text(ctx, hm(s.starts_at), W - PAD, mid + 14, { font: F(700, 38, DISPLAY), align: 'right' });
      }
      hline(ctx, y + rowH - 2);
      y += rowH;
    }
  });
  if (banner) {
    y += 36;
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(PAD + 28, y);
    ctx.lineTo(W - PAD, y);
    ctx.lineTo(W - PAD - 28, y + 104);
    ctx.lineTo(PAD, y + 104);
    ctx.closePath();
    ctx.fill();
    const used = text(ctx, 'VOTA EN LA PORRA', PAD + 48, y + 64, { font: F(800, 34, DISPLAY), color: '#FFFFFF', spacing: 2 });
    text(ctx, `antes del ${weekday(event.close_at)} a las ${hm(event.close_at)}`, W - PAD - 48, y + 65, { font: F(600, 38, COND), color: '#FFFFFF', align: 'right', maxWidth: W - 2 * PAD - 96 - used - 24 });
  }
  footer(ctx, canvas.height, `Ronda ${event.round} de ${rounds}`);
  return canvas;
}

export function toBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png'));
}

export function canShareFile(file) {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
