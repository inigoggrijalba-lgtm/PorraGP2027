// Avisos al móvil: recordatorios de voto, puntos del GP y resultados.
import { useEffect, useState } from 'react';
import { messageFor } from '../api.js';
import { disablePush, enablePush, pushStatus, savePrefs, testPush } from '../push.js';
import { Icon, TopBar, useData } from '../ui.jsx';

function Switch({ label, sub, on, onChange, disabled }) {
  return (
    <div className="swrow">
      <div className="swtext">
        <span>{label}</span>
        <small>{sub}</small>
      </div>
      <button role="switch" aria-checked={on} aria-label={label} className="sw" disabled={disabled} onClick={() => onChange(!on)}>
        <span className={`sw-track ${on ? 'on' : ''}`}>
          <span className="sw-dot" />
        </span>
      </button>
    </div>
  );
}

const HELP = {
  'sin-soporte': ['Este navegador no admite avisos', 'Abre la porra en Chrome (Android) o instálala en la pantalla de inicio para poder recibirlos.'],
  instalar: ['Primero instala la app', 'En iPhone los avisos solo llegan con la porra instalada en la pantalla de inicio. Instálala y vuelve a esta pantalla desde el icono.'],
  bloqueados: ['Avisos bloqueados', 'Has bloqueado los avisos de la porra en este navegador. Actívalos en los ajustes del sitio (el candado junto a la dirección) y vuelve aquí.'],
};

export default function Notices() {
  const { boot } = useData();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { text, bad }
  useEffect(() => {
    let alive = true;
    pushStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (fn, okText) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await fn();
      if (okText) setNote({ text: okText });
    } catch (e) {
      setNote({ text: messageFor(e.code), bad: true });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (key) => (value) => {
    const next = { ...status.prefs, [key]: value };
    setStatus({ ...status, prefs: next });
    run(async () => {
      try {
        const saved = await savePrefs({ [key]: value });
        setStatus((s) => ({ ...s, prefs: saved }));
      } catch (e) {
        setStatus((s) => ({ ...s, prefs: { ...s.prefs, [key]: !value } }));
        throw e;
      }
    });
  };

  const state = status && status.state;
  return (
    <>
      <TopBar title="Avisos" back="mas" who={false} />
      <main className="main has-nav">
        {!status ? (
          <p className="muted" style={{ padding: 20 }}>
            Comprobando los avisos de este móvil…
          </p>
        ) : state === 'activos' ? (
          <>
            <section className="sec" style={{ paddingTop: 20 }}>
              <h2 className="h2" style={{ marginBottom: 8 }}>
                La porra
              </h2>
              <div className="rows">
                <Switch label="Recordatorio de voto" sub="La víspera del cierre, si falta alguien por votar" on={status.prefs.r24} onChange={toggle('r24')} disabled={busy} />
                <Switch label="Último aviso" sub="2 horas antes del cierre, si sigue faltando alguien" on={status.prefs.r2} onChange={toggle('r2')} disabled={busy} />
                <Switch label="Puntos del Gran Premio" sub="Al terminar la carrera del domingo" on={status.prefs.res} onChange={toggle('res')} disabled={busy} />
              </div>
            </section>
            <section className="sec">
              <h2 className="h2" style={{ marginBottom: 8 }}>
                MotoGP
              </h2>
              <div className="rows">
                <Switch label="Resultados de cada sesión" sub="Libres, clasificación, Sprint y carrera" on={status.prefs.ses} onChange={toggle('ses')} disabled={busy} />
              </div>
            </section>
            {boot.is_admin || status.prefs.sch ? (
              <section className="sec">
                <h2 className="h2" style={{ marginBottom: 8 }}>
                  Solo administrador
                </h2>
                <div className="rows">
                  <Switch label="Horario listo para compartir" sub="Los martes de la semana de carrera, a las 10:00" on={status.prefs.sch} onChange={toggle('sch')} disabled={busy || !boot.is_admin} />
                </div>
                {boot.is_admin ? null : <p className="small muted" style={{ marginTop: 8 }}>Para cambiarlo, entra antes como administrador.</p>}
              </section>
            ) : null}
            <section className="sec">
              <p className="small muted">
                Los avisos llegan a este móvil. Si aquí votan varios jugadores, el aviso dice quién falta. De madrugada no se manda nada: si el cierre es muy temprano, el último aviso llega la víspera a las 21:30.
              </p>
              <div className="stack" style={{ marginTop: 14 }}>
                <button className="btn wide" disabled={busy} onClick={() => run(() => testPush(status.endpoint), 'Aviso de prueba enviado. Debería llegar en unos segundos.')}>
                  <Icon name="bell" />
                  <span>Enviar aviso de prueba</span>
                </button>
                <button
                  className="btn quiet wide"
                  style={{ height: 44 }}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await disablePush();
                      setStatus({ state: 'apagados' });
                    }, 'Avisos desactivados en este móvil.')
                  }
                >
                  Desactivar los avisos en este móvil
                </button>
              </div>
            </section>
          </>
        ) : state === 'apagados' ? (
          <section className="sec" style={{ paddingTop: 24 }}>
            <h1 className="h1 s">Que no se te pase votar</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              La porra te avisa en este móvil la víspera del cierre y 2 horas antes si falta alguien por votar, y te dice los puntos al terminar la carrera. Luego puedes elegir qué avisos quieres.
            </p>
            <button
              className="cta"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setStatus(await enablePush());
                }, 'Avisos activados en este móvil.')
              }
            >
              {busy ? 'Activando…' : 'Activar avisos'}
            </button>
            <p className="small muted" style={{ marginTop: 12 }}>
              El móvil te pedirá permiso para mostrar notificaciones: pulsa Permitir.
            </p>
          </section>
        ) : (
          <section className="sec" style={{ paddingTop: 24 }}>
            <h1 className="h1 s">{HELP[state][0]}</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              {HELP[state][1]}
            </p>
            {state === 'instalar' ? (
              <a className="btn wide" style={{ marginTop: 20 }} href="#/mas/instalar">
                <span>Cómo instalarla</span>
                <Icon name="next" size={14} stroke={2.4} />
              </a>
            ) : null}
          </section>
        )}
        {note ? (
          <p className={note.bad ? 'err-text' : 'small green'} role="status" style={{ padding: '14px 20px 0' }}>
            {note.text}
          </p>
        ) : null}
      </main>
    </>
  );
}
