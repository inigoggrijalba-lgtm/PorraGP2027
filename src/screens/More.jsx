// Pestaña Más: jugadores de este móvil, histórico, noticias, avisos, reglas e instalación.
import { useEffect, useState } from 'react';
import { messageFor } from '../api.js';
import { setActive, setPlayers } from '../store.js';
import { Avatar, Icon, Offline, TopBar, useData } from '../ui.jsx';

const ITEMS = [
  ['history', 'Histórico', 'Resultados de todas las temporadas desde 1949', 'mas/historico'],
  ['news', 'Noticias', 'Medios especializados en MotoGP', 'mas/noticias'],
  ['bell', 'Avisos', 'Recordatorios de voto y resultados', 'mas/avisos'],
  ['rules', 'Reglas de la porra', 'Cómo se vota y cómo se puntúa', 'mas/reglas'],
  ['install', 'Instalar la app', 'Pasos para Android y iPhone', 'mas/instalar'],
  ['lock', 'Administrador', 'Entra con contraseña', 'mas/admin'],
];

export function More() {
  const { boot, me } = useData();
  const n = boot.my_players.length;
  return (
    <>
      <TopBar who={false} />
      <main className="main has-nav">
        <Offline />
        <a className="me-card" href="#/mas/jugadores">
          <Avatar name={me?.name} on size="l" />
          <span className="txt">
            <span className="who-label label" style={{ fontSize: 12, fontWeight: 500 }}>
              Votas como
            </span>
            <span className="strong" style={{ fontSize: 20 }}>
              {me?.name}
            </span>
            <span className="small muted">
              {n} {n === 1 ? 'jugador' : 'jugadores'} en este móvil
            </span>
          </span>
          <span className="btn">Cambiar</span>
        </a>
        <div className="menu">
          {ITEMS.map(([icon, title, sub, path]) => {
            const body = (
              <>
                <Icon name={icon} size={24} stroke={1.9} />
                <span className="txt">
                  <b>{title}</b>
                  <small>{path === 'mas/admin' && boot.is_admin ? 'Sesión abierta en este móvil' : sub}</small>
                </span>
                {path ? (
                  <span className="muted">
                    <Icon name="next" />
                  </span>
                ) : (
                  <span className="tag quiet" style={{ borderColor: 'var(--text3)', color: 'var(--text3)' }}>
                    Pronto
                  </span>
                )}
              </>
            );
            return path ? (
              <a key={title} className="mitem" href={`#/${path}`}>
                {body}
              </a>
            ) : (
              <div key={title} className="mitem off" aria-disabled="true">
                {body}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}

export function Players() {
  const { boot, d, standings, active } = useData();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mine = boot.my_players.map((id) => d.players.get(id)).filter(Boolean);
  const others = d.activePlayers.filter((p) => !boot.my_players.includes(p.id));
  const ranked = standings.filter((s) => s.active);
  const place = (id) => {
    const i = ranked.findIndex((s) => s.player_id === id);
    return i < 0 ? '' : `${i + 1}.º · ${ranked[i].total} puntos`;
  };
  const change = async (id, on) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setPlayers([id], on);
    } catch (e) {
      setError(messageFor(e.code));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <TopBar title="Jugadores" back="mas" who={false} />
      <main className="main has-nav">
        <Offline />
        <section className="sec" style={{ paddingTop: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h1 className="h1 s">En este móvil</h1>
            <div className="small muted" style={{ marginTop: 4 }}>
              Elige con qué jugador votas y ves la app
            </div>
          </div>
          <div className="stack">
            {mine.map((p) => {
              const isActive = p.id === active;
              return (
                <div key={p.id} className={`prow ${isActive ? 'active' : ''}`}>
                  <Avatar name={p.name} on={isActive} size="m" />
                  <span className="prow-text">
                    <span>{p.name}</span>
                    <span className="prow-sub">{place(p.id)}</span>
                  </span>
                  {removing ? (
                    <button className="btn faint" disabled={busy} onClick={() => change(p.id, false)} aria-label={`Quitar a ${p.name} de este móvil`}>
                      Quitar
                    </button>
                  ) : isActive ? (
                    <span className="tag solid">Activo</span>
                  ) : (
                    <button className="btn" onClick={() => setActive(p.id)} aria-label={`Cambiar a ${p.name}`}>
                      Cambiar
                    </button>
                  )}
                </div>
              );
            })}
            {adding ? (
              <div className="box" style={{ gap: 10 }}>
                <div className="between">
                  <span className="label">¿A quién añades?</span>
                  <button className="back" style={{ height: 32 }} onClick={() => setAdding(false)} aria-label="Cerrar">
                    <Icon name="close" size={18} />
                  </button>
                </div>
                {others.length ? (
                  <div className="names">
                    {others.map((p) => (
                      <button key={p.id} disabled={busy} onClick={() => change(p.id, true)}>
                        <Avatar name={p.name} />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted small">Ya están todos los jugadores en este móvil.</p>
                )}
              </div>
            ) : (
              <button
                className="btn dashed"
                onClick={() => {
                  setAdding(true);
                  setRemoving(false);
                }}
              >
                <Icon name="plus" />
                <span>Añadir otro jugador</span>
              </button>
            )}
            {error ? (
              <p className="err-text" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
        <section className="sec">
          <h2 className="h2" style={{ marginBottom: 8 }}>
            Este móvil
          </h2>
          <div className="rows">
            <div className="kv mid">
              <div>Código de la porra</div>
              <div className="green strong" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="check" size={14} stroke={3} />
                <span style={{ color: 'var(--green)' }}>Introducido</span>
              </div>
            </div>
            <div className="kv mid">
              <div>Quitar un jugador de este móvil</div>
              <button
                className="btn faint"
                style={{ color: 'var(--text)' }}
                onClick={() => {
                  setRemoving(!removing);
                  setAdding(false);
                }}
              >
                {removing ? 'Hecho' : 'Elegir'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const RULES = [
  ['Un piloto por Gran Premio', 'Vota a un piloto de MotoGP antes de que arranque la Sprint del sábado.'],
  ['Un cambio, antes de la Sprint', 'Puedes cambiar tu voto una vez. Cuando empieza la Sprint, el voto queda cerrado.'],
  ['Cada piloto, tres veces', 'Solo puedes votar al mismo piloto 3 veces por temporada. Cuenta el piloto con el que te quedas, no el que descartas al cambiar.'],
  ['Sumas lo que sume tu piloto', 'Te llevas sus puntos de la Sprint y de la carrera del domingo. El máximo en un Gran Premio es 37.'],
];
const CASES = [
  ['Si no votas', '0 puntos en ese Gran Premio'],
  ['Si tu piloto no corre', 'Mala suerte: 0 puntos'],
  ['Los votos', 'Son públicos desde que se emiten'],
  ['Empate final', 'Gana quien tenga más victorias de domingo; si sigue el empate, más victorias de sábado'],
];

export function Rules() {
  return (
    <>
      <TopBar title="Reglas" back="mas" who={false} />
      <main className="main has-nav">
        <div style={{ padding: '12px 20px 0' }}>
          {RULES.map(([title, text], i) => (
            <div key={title} className="rule">
              <div className="rule-n">{i + 1}</div>
              <div>
                <b className="t">{title}</b>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <section className="sec" style={{ paddingTop: 24 }}>
          <h2 className="h2" style={{ marginBottom: 12 }}>
            Puntos
          </h2>
          <div className="label">Sprint · del 1.º al 9.º</div>
          <div className="num" style={{ marginTop: 4, fontSize: 14 }}>
            12 · 9 · 7 · 6 · 5 · 4 · 3 · 2 · 1
          </div>
          <div className="label" style={{ marginTop: 10 }}>
            Carrera · del 1.º al 15.º
          </div>
          <div className="num" style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>
            25 · 20 · 16 · 13 · 11 · 10 · 9 · 8 · 7 · 6 · 5 · 4 · 3 · 2 · 1
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 24 }}>
          <h2 className="h2" style={{ marginBottom: 12 }}>
            Casos
          </h2>
          <div className="rows">
            {CASES.map(([k, v]) => (
              <div key={k} className="kv">
                <div>{k}</div>
                <div>{v}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

const STEPS = {
  Android: [
    <>Abre la porra en <b>Chrome</b>.</>,
    <>Pulsa los <b>tres puntos</b> de arriba a la derecha.</>,
    <>Elige <b>Añadir a pantalla de inicio</b>.</>,
    <>Pulsa <b>Instalar</b>. La porra queda como una app más.</>,
  ],
  iPhone: [
    <>Abre la porra en <b>Safari</b>.</>,
    <>Pulsa el botón <b>Compartir</b>, el cuadrado con la flecha hacia arriba.</>,
    <>Elige <b>Añadir a pantalla de inicio</b>.</>,
    <>Pulsa <b>Añadir</b>. La porra queda como una app más.</>,
  ],
};

let installEvent = null;
const installSubs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installSubs.forEach((fn) => fn());
  });
}

export function Install() {
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  const [os, setOs] = useState(isApple ? 'iPhone' : 'Android');
  const [canInstall, setCanInstall] = useState(!!installEvent);
  const [note, setNote] = useState('');
  const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  useEffect(() => {
    const fn = () => setCanInstall(!!installEvent);
    installSubs.add(fn);
    return () => installSubs.delete(fn);
  }, []);
  const url = window.location.href.split('#')[0];
  const share = async () => {
    const text = 'PorraGP: entra, instálala y vota antes de la Sprint.';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PorraGP', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNote('Enlace copiado. Pégalo en el grupo.');
      }
    } catch {
      // el jugador ha cerrado el menú de compartir
    }
  };
  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    installEvent = null;
    setCanInstall(false);
  };
  return (
    <>
      <TopBar title="Instalar" back="mas" who={false} />
      <main className="main has-nav">
        {installed ? (
          <div className="notice" role="status">
            <span className="green">
              <Icon name="check" stroke={3} />
            </span>
            <span>Ya tienes la porra instalada en este móvil.</span>
          </div>
        ) : null}
        <div style={{ padding: '12px 20px 0' }}>
          <div className="seg" role="group" aria-label="Tipo de móvil">
            {['Android', 'iPhone'].map((o) => (
              <button key={o} aria-pressed={os === o} onClick={() => setOs(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '8px 20px 0' }}>
          {STEPS[os].map((step, i) => (
            <div key={i} className="rule center">
              <div className="rule-n">{i + 1}</div>
              <div style={{ fontSize: 16 }} className="step">
                {step}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '20px 20px 0' }} className="stack">
          {canInstall && os === 'Android' && !installed ? (
            <button className="cta m" onClick={install}>
              <Icon name="install" size={18} />
              <span>Instalar ahora</span>
            </button>
          ) : null}
          <button className="btn wide" onClick={share}>
            <Icon name="share" />
            <span>Enviar el enlace a un jugador</span>
          </button>
          {note ? (
            <p className="small muted" role="status">
              {note}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
