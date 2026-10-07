// Tipografías de prueba: el organizador puede ver la app con otras fuentes antes de decidir.
// Lo elegido se guarda solo en este móvil; los demás siguen viendo la de siempre.
export const FONTS = [
  { id: 'actual', name: 'La actual', detail: 'Orbitron en títulos · Barlow en el resto' },
  { id: 'saira', name: 'Saira', detail: 'Una sola familia, de trazo cuadrado' },
  { id: 'archivo', name: 'Archivo', detail: 'Títulos anchos y gruesos, texto neutro' },
  { id: 'exo', name: 'Exo 2 + Titillium Web', detail: 'Títulos técnicos, texto clásico de carreras' },
  { id: 'saira-stencil', name: 'Saira Stencil + Saira', detail: 'Títulos con cortes, de la misma familia que el resto' },
  { id: 'bigshoulders', name: 'Big Shoulders Stencil + Saira', detail: 'Títulos con cortes, estrechos y altos' },
  { id: 'blackops', name: 'Black Ops One + Saira', detail: 'Títulos con cortes, anchos y muy gruesos' },
];
const KEY = 'porragp.fuente';
const valid = (id) => FONTS.some((f) => f.id === id);

export function currentFont() {
  return document.documentElement.dataset.font || 'actual';
}

export function applyFont(id, remember = true) {
  const font = valid(id) ? id : 'actual';
  if (font === 'actual') delete document.documentElement.dataset.font;
  else document.documentElement.dataset.font = font;
  if (remember) {
    try {
      if (font === 'actual') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, font);
    } catch {
      // sin almacenamiento, vale solo para esta visita
    }
  }
}

// Al abrir: lo que diga la dirección (?fuente=saira) o, si no, lo último elegido en este móvil.
export function restoreFont() {
  let wanted = null;
  try {
    wanted = new URLSearchParams(window.location.search).get('fuente') || localStorage.getItem(KEY);
  } catch {
    wanted = null;
  }
  if (wanted) applyFont(wanted, valid(wanted));
}

// Familias en uso, para pintar con ellas las imágenes que se comparten.
export function families() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const display = read('--display', "Orbitron, 'Arial Black', sans-serif");
  const title = read('--title', display);
  return {
    // Sin fuente propia de titulares, --title llega sin resolver: vale la de los números.
    title: /^var\(/.test(title) ? display : title,
    display,
    cond: read('--cond', "'Barlow Condensed', 'Arial Narrow', sans-serif"),
    body: read('--body', "Barlow, 'Segoe UI', sans-serif"),
  };
}
