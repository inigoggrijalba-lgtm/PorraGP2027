// En directo: tiempos de la sesión que se está corriendo (MotoGP, Moto2 o Moto3), cada 5 segundos.
// De momento es una pantalla discreta, a la que se llega desde el punto rojo de Inicio.
import { useEffect, useState } from 'react';
import { fullName, isRace } from '../results.js';
import { loadLive } from '../store.js';
import { Offline, TopBar } from '../ui.jsx';

// N: sin empezar · S: en marcha (así lo marca MotoGP) · F: terminada.
const STATUS = { N: 'Sin empezar', S: 'En pista', I: 'En pista', F: 'Terminada', R: 'Bandera roja', C: 'Cancelada' };
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
  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      try {
        const data = await loadLive();
        if (alive) setState({ status: 'ready', data, at: Date.now() });
      } catch {
        if (alive) setState((s) => (s.data ? s : { status: 'error', data: null, at: 0 }));
      }
      if (alive) timer = setTimeout(tick, document.visibilityState === 'visible' ? 5000 : 20000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

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
              <div className="small muted">
                {STATUS[live.status] || live.status}
                {race && live.laps ? ` · ${live.laps} vueltas` : ''}
                {!race && !['N', 'F', 'C'].includes(live.status) && secs(live.remaining) ? ` · Quedan ${secs(live.remaining)}` : ''}
              </div>
            </div>
            <div style={{ padding: '0 20px' }}>
              {rows.map((r, i) => {
                const main = race ? (r.pos === 1 ? time(r.best) || '' : gap(r.gap_first)) : time(r.best);
                const sub = race ? (r.pos > 1 ? gap(r.gap_prev) : '') : r.pos > 1 ? gap(r.gap_first) : '';
                return (
                  <div key={`${r.number}-${i}`} className="rrow lv-row">
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
                Se actualiza cada 5 segundos. {race ? 'Tiempo: diferencia con el 1.º; debajo, con el de delante.' : 'Tiempo: mejor vuelta; debajo, diferencia con el 1.º.'}
              </p>
            </div>
          </>
        )}
      </main>
    </>
  );
}
