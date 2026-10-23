// En directo: tiempos de la sesión que se está corriendo (MotoGP, Moto2 o Moto3), cada 5 segundos.
// De momento es una pantalla discreta, a la que se llega desde el punto rojo de Inicio.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fullName, isRace } from '../results.js';
import { loadLive } from '../store.js';
import { Offline, TopBar } from '../ui.jsx';

// Estados de MotoGP vistos en su feed: N sin empezar, S en marcha ("started", con la sesión corriendo),
// C cerrada al acabar. I, R y F por si aparecen: en pista, bandera roja y terminada.
const STATUS = { N: 'Sin empezar', I: 'En pista', S: 'En pista', R: 'Bandera roja', F: 'Terminada', C: 'Terminada' };
// Bandera para el cuadro de estado. MotoGP no da amarillas ni otras banderas por pista, solo el estado de la sesión.
const FLAG = {
  N: { kind: 'grey', text: 'Sesión sin empezar' },
  I: { kind: 'green', text: 'Bandera verde · en pista' },
  S: { kind: 'green', text: 'Bandera verde · en pista' },
  R: { kind: 'red', text: 'Bandera roja · sesión detenida' },
  F: { kind: 'chequered', text: 'Bandera a cuadros · terminada' },
  C: { kind: 'chequered', text: 'Bandera a cuadros · terminada' },
};
const running = (st) => !['N', 'F', 'C'].includes(st);
const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
const secs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
};
// "1:29.874" tal cual; "0.000" es que aún no hay tiempo.
const time = (v) => (!v || Number(v) === 0 ? '' : String(v));
const gap = (v) => (!v || Number(v) === 0 ? '' : `+${v}`);

export default function Live() {
  const [state, setState] = useState({ status: 'loading', data: null, at: 0 });
  // Cuándo cambió por última vez lo que manda MotoGP (su web pública se refresca más o menos una vez por minuto).
  const changed = useRef({ sig: '', at: 0, remaining: 0 });
  const [, setNow] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      clearTimeout(timer);
      try {
        const data = await loadLive();
        if (alive) {
          const sig = JSON.stringify([data.status, data.remaining, data.riders.map((r) => [r.number, r.pos, r.best, r.lap, r.gap_first])]);
          if (sig !== changed.current.sig) changed.current = { sig, at: Date.now(), remaining: Number(data.remaining) || 0 };
          setState({ status: 'ready', data, at: Date.now() });
        }
      } catch {
        if (alive) setState((s) => (s.data ? s : { status: 'error', data: null, at: 0 }));
      }
      if (alive) timer = setTimeout(tick, document.visibilityState === 'visible' ? 5000 : 20000);
    };
    // Al volver a la app (pantalla apagada, otra app…) se pide al momento en vez de esperar al turno.
    const wake = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', wake);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  // Animación al cambiar de posición: se guarda dónde estaba cada tarjeta y, tras pintar la nueva
  // tabla, se la desplaza desde la posición vieja hasta la nueva.
  const listRef = useRef(null);
  const tops = useRef(new Map());
  useLayoutEffect(() => {
    const box = listRef.current;
    if (!box) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map();
    for (const el of box.querySelectorAll('[data-rider]')) {
      const id = el.dataset.rider;
      const top = el.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      if (reduce || before === undefined || before === top) continue;
      const up = top < before;
      el.animate(
        [{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }],
        { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
      // Solo se resalta (en verde) quien sube.
      el.classList.remove('lv-up');
      if (up) {
        void el.offsetWidth;
        el.classList.add('lv-up');
      }
    }
    tops.current = next;
  }, [state.data]);

  const live = state.data;
  const race = live && isRace(live.session);
  const rows = live ? live.riders.filter((r) => r.pos > 0).concat(live.riders.filter((r) => !(r.pos > 0))) : [];
  return (
    <>
      <TopBar title="En directo" back="" who={false} />
      <main className="main has-nav">
        <Offline />
        {state.status === 'loading' ? (
          <p className="muted" style={{ padding: 20 }}>
            Conectando con el directo…
          </p>
        ) : state.status === 'error' ? (
          <p className="err-text" style={{ padding: 20 }}>
            No se han podido cargar los tiempos en directo. Comprueba la conexión.
          </p>
        ) : (
          <>
            <div className="page-head" style={{ paddingBottom: 10, gap: 6 }}>
              <div className="lv-top">
                <span className={`lv-dot ${['N', 'F', 'C'].includes(live.status) ? 'off' : ''}`} aria-hidden="true" />
                <span className="label" style={{ margin: 0 }}>
                  {live.category} · {live.circuit}
                </span>
              </div>
              <h1 className="h1" style={{ fontSize: 24 }}>
                {fullName(live.session) || live.session_name}
              </h1>
            </div>
            <LiveStatus live={live} race={race} changed={changed.current} at={state.at} />
            <div style={{ padding: '0 20px' }} ref={listRef}>
              {rows.map((r, i) => {
                const main = race ? (r.pos === 1 ? time(r.best) || '' : gap(r.gap_first)) : time(r.best);
                const sub = race ? (r.pos > 1 ? gap(r.gap_prev) : '') : r.pos > 1 ? gap(r.gap_first) : '';
                return (
                  <div key={r.number || `x${i}`} data-rider={r.number || `x${i}`} className="rrow lv-row">
                    <div className={`rpos ${r.pos === 1 ? 'first' : ''}`}>{r.pos > 0 ? r.pos : '–'}</div>
                    <span className="plate rp" style={{ background: `#${r.color || '2B2B2F'}`, color: `#${r.ink || 'F5F4F2'}` }}>
                      {r.number}
                    </span>
                    <div className="lv-name">
                      <span>
                        {r.name ? `${r.name.charAt(0)}. ` : ''}
                        {cap(r.surname)}
                      </span>
                      <small>
                        {r.bike}
                        {r.lap ? ` · ${r.lap} ${r.lap === 1 ? 'vuelta' : 'vueltas'}` : ''}
                      </small>
                    </div>
                    {r.pit ? <span className="tag lv-pit">Box</span> : null}
                    <div className="lv-time">
                      <b>{main || '–'}</b>
                      {sub ? <small>{sub}</small> : null}
                    </div>
                  </div>
                );
              })}
              <p className="small muted" style={{ padding: '12px 0 0' }}>
                MotoGP refresca sus tiempos públicos más o menos una vez por minuto; la app los mira cada 5 segundos. {race ? 'Tiempo: diferencia con el 1.º; debajo, con el de delante.' : 'Tiempo: mejor vuelta; debajo, diferencia con el 1.º.'}
              </p>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function LiveStatus({ live, race, changed, at }) {
  const flag = FLAG[live.status] || { kind: 'grey', text: STATUS[live.status] || live.status };
  const now = Date.now();
  // El reloj sigue corriendo entre un dato y el siguiente, desde lo último que dijo MotoGP.
  const left = running(live.status) && changed.remaining > 0 ? Math.max(0, changed.remaining - Math.floor((now - changed.at) / 1000)) : 0;
  const ago = Math.max(0, Math.round((now - changed.at) / 1000));
  return (
    <div className={`lv-flag ${flag.kind}`}>
      <span className="lv-flag-icon" aria-hidden="true" />
      <div className="lv-flag-text">
        <b>{flag.text}</b>
        <small>
          {race && live.laps ? `${live.laps} vueltas · ` : ''}
          {at ? (ago < 5 ? 'Datos nuevos ahora' : `Datos de hace ${ago < 60 ? `${ago} s` : `${Math.floor(ago / 60)} min`}`) : ''}
        </small>
      </div>
      {!race && left ? (
        <div className="lv-clock">
          <small>Quedan</small>
          <b>{secs(left)}</b>
        </div>
      ) : null}
    </div>
  );
}
