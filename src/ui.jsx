// Piezas que se repiten en todas las pantallas.
import { createContext, useContext, useEffect, useState } from 'react';
import { indexOf } from './data.js';
import { now, setActive, useStore } from './store.js';
import { teamShort } from './teams.js';

const PATHS = {
  back: <path d="M15 6l-6 6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  next: <path d="M9 6l6 6-6 6" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 13v6h14v-6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4.5L18 13H5" />
    </>
  ),
  podium: (
    <>
      <path d="M4 20V11h4v9" />
      <path d="M10 20V4h4v16" />
      <path d="M16 20v-6h4v6" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-6" />
      <path d="M3 20h18" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  news: (
    <>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <path d="M7.5 9h6" />
      <path d="M7.5 12.5h6" />
      <path d="M7.5 16h3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5h4" />
    </>
  ),
  rules: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9.5 8.5h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 15.5h3" />
    </>
  ),
  install: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="1.5" />
      <path d="M12 8v6" />
      <path d="M9.5 11.5L12 14l2.5-2.5" />
      <path d="M10.5 17.5h3" />
    </>
  ),
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M5 12.5a10 10 0 0 1 3-2" />
      <path d="M12 9a10 10 0 0 1 7 3.5" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
    </>
  ),
};

export function Icon({ name, size = 16, stroke = 2.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// Navegación por la parte de la dirección que va detrás de #.
const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
let previous = [];
// Pantalla desde la que se ha llegado a la actual, para que "volver" vuelva de verdad.
export const cameFrom = () => previous[0] || '';
export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    let last = read();
    const on = () => {
      previous = last;
      last = read();
      setRoute(last);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
export const go = (path) => {
  window.location.hash = `#/${path}`;
};

// Hora del servidor, refrescada cada cierto tiempo para las cuentas atrás.
export function useNow(every = 1000) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), every);
    return () => clearInterval(id);
  }, [every]);
  return t;
}

export const SheetContext = createContext(() => {});

export function useData() {
  const s = useStore();
  const d = indexOf(s.boot);
  return { ...s, d, me: d.players.get(s.active) || null };
}

export const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

export function Avatar({ name, on, size = '' }) {
  return <span className={`avatar ${size} ${on ? 'on' : ''}`}>{initial(name)}</span>;
}

function Who({ compact }) {
  const { me } = useData();
  const open = useContext(SheetContext);
  if (!me) return null;
  return (
    <button className="who" onClick={open} aria-label={`Cambiar de jugador. Ahora votas como ${me.name}`}>
      <Avatar name={me.name} on />
      {compact ? (
        <span className="who-name">{me.name}</span>
      ) : (
        <span className="who-text">
          <span className="who-label">Votas como</span>
          <span className="who-name">{me.name}</span>
        </span>
      )}
      <span className="muted">
        <Icon name="down" />
      </span>
    </button>
  );
}

export function TopBar({ title, back, who = true }) {
  return (
    <header className="top">
      <div className={`top-row ${back != null ? 'with-back' : ''}`}>
        {back != null ? (
          <div className="top-left">
            <a className="back" href={`#/${back}`} aria-label="Volver">
              <Icon name="back" size={22} />
            </a>
            <div className="top-title">{title}</div>
          </div>
        ) : (
          <div className="brand">
            Porra<span>GP</span>
          </div>
        )}
        {who ? (
          <Who compact={back != null} />
        ) : back != null ? (
          <div className="brand small-brand">
            Porra<span>GP</span>
          </div>
        ) : null}
      </div>
      <div className="kerb" />
    </header>
  );
}

const TABS = [
  ['', 'Inicio', 'home'],
  ['votar', 'Votar', 'flag'],
  ['porra', 'Porra', 'podium'],
  ['motogp', 'MotoGP', 'gauge'],
  ['mas', 'Más', 'menu'],
];

export function BottomNav({ current, voteDot }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {TABS.map(([path, label, icon]) => (
        <a key={path} href={`#/${path}`} aria-current={current === path ? 'page' : undefined}>
          <Icon name={icon} size={22} stroke={1.9} />
          <span>{label}</span>
          {path === 'votar' && voteDot ? <i className="dot" aria-label="Te falta votar" /> : null}
        </a>
      ))}
    </nav>
  );
}

export function Plate({ rider, size = '' }) {
  return (
    <span className={`plate ${size}`} style={{ background: rider.team_color || '#2B2B2F', color: rider.text_color || '#F5F4F2' }}>
      {rider.number}
    </span>
  );
}

// Las fotos de MotoGP son de cuerpo entero, 1920 px de ancho y varios megas. Se piden recortadas
// (cabeza y torso) y reducidas a través de un servicio de imágenes: unos 16 KB cada una.
export function thumb(url, width) {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\//, '').replace(/\/{2,}/g, '/');
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&cx=460&cy=30&cw=1000&ch=1250&precrop&w=${width}&output=webp&q=80`;
}

// Hueco de la foto sobre el color del equipo. Si no hay foto o no carga, una silueta.
export function Photo({ rider, size = 's', children }) {
  const dims = { s: [50, 55], m: [58, 64], xm: [80, 88], l: [100, 110] }[size];
  const [failed, setFailed] = useState(false);
  const src = failed ? null : thumb(rider.photo_url, size === 'l' || size === 'xm' ? 400 : 240);
  return (
    <span className={`photo ${size}`} style={{ background: rider.team_color || '#2B2B2F', color: rider.text_color || '#F5F4F2' }}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <svg width={dims[0]} height={dims[1]} viewBox="0 0 64 70" fill="currentColor" fillOpacity="0.38" aria-hidden="true">
          <circle cx="32" cy="24" r="13" />
          <path d="M6 70c0-15 11-25 26-25s26 10 26 25z" />
        </svg>
      )}
      {children}
    </span>
  );
}

export function PickCard({ rider, sub, size = 'l' }) {
  return (
    <div className={`pick ${size}`}>
      <div className="pick-info">
        <Plate rider={rider} size={size === 'l' ? 'l' : 'm'} />
        <span>
          <span className="pick-name" style={{ display: 'block' }}>
            {rider.short_name}
          </span>
          <span className="small muted">{sub || teamShort(rider)}</span>
        </span>
      </div>
      <Photo rider={rider} size={size === 'l' ? 'l' : 'xm'} />
    </div>
  );
}

// Lista de jugadores del móvil para cambiar con quién se vota.
export function PlayerSheet({ onClose }) {
  const { boot, d, active } = useData();
  const ev = d.events.get(boot.voting_event_id);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Cambiar de jugador" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-kerb" />
        <div className="sheet-head">
          <h2 className="h2">¿Quién vota ahora?</h2>
          <button className="back" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="stack">
          {boot.my_players.map((id) => {
            const p = d.players.get(id);
            if (!p) return null;
            const v = ev ? d.voteOf(id, ev.id) : null;
            const rider = v ? d.riders.get(v.rider_id) : null;
            return (
              <button
                key={id}
                className={`prow ${id === active ? 'active' : ''}`}
                onClick={() => {
                  setActive(id);
                  onClose();
                }}
              >
                <Avatar name={p.name} on={id === active} size="m" />
                <span className="prow-text">
                  <span>{p.name}</span>
                  {ev ? <VoteStatus rider={rider} /> : null}
                </span>
                {id === active ? <span className="tag solid">Activo</span> : null}
              </button>
            );
          })}
          <a className="btn dashed" href="#/mas/jugadores" onClick={onClose}>
            <Icon name="plus" />
            <span>Añadir o quitar jugadores</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function VoteStatus({ rider }) {
  return rider ? (
    <span className="prow-sub ok">
      <Icon name="check" size={13} stroke={3} />
      <span>Ha votado · {rider.short_name}</span>
    </span>
  ) : (
    <span className="prow-sub wait">
      <Icon name="clock" size={13} stroke={2.4} />
      <span>Pendiente de votar</span>
    </span>
  );
}

export function Offline() {
  const { offline } = useStore();
  if (!offline) return null;
  return (
    <div className="notice" role="status">
      <Icon name="offline" />
      <span>Sin conexión. Estás viendo los últimos datos guardados.</span>
    </div>
  );
}
