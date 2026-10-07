// Panel de administrador: votos, cierre, resultados, jugadores y acceso.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { messageFor } from '../api.js';
import { MAX_USES } from '../config.js';
import { sessionsOf } from '../data.js';
import { adminDo, adminLogin, adminLogout, adminRead, loadEvent, now, refresh } from '../store.js';
import { teamShort } from '../teams.js';
import { dayMid, hm, whenText } from '../time.js';
import { GpNav, Icon, Plate, TopBar, useData, useNow } from '../ui.jsx';

const SPRINT_POINTS = [12, 9, 7, 6, 5, 4, 3, 2, 1];
const RACE_POINTS = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const pointsFor = (table, pos) => (pos >= 1 && pos <= table.length ? table[pos - 1] : 0);

// Lanza una acción, bloquea los botones mientras tanto y enseña el resultado en un aviso.
const Actions = createContext({ busy: false, run: async () => {} });
const useActions = () => useContext(Actions);

function Login() {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (busy || !pass) return;
    setBusy(true);
    setError('');
    try {
      await adminLogin(pass);
    } catch (err) {
      setError(messageFor(err.code));
      setBusy(false);
    }
  };
  return (
    <form className="form" style={{ padding: '24px 20px' }} onSubmit={submit} noValidate>
      <div>
        <h1 className="h1 s">Solo el organizador</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Desde aquí se corrigen votos, se cambia el cierre y se meten resultados a mano. La sesión dura 12 horas en este móvil.
        </p>
      </div>
      <div className="field">
        <label htmlFor="adminpass">Contraseña de administrador</label>
        <input id="adminpass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" autoFocus />
      </div>
      {error ? (
        <p className="err-text" role="alert">
          {error}
        </p>
      ) : null}
      <button className="cta" type="submit" disabled={busy || !pass}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

// Para el campo de fecha y hora: "2026-10-10T09:00" en la hora del móvil.
function toLocalInput(ms) {
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;
}

function Voting({ event }) {
  const { busy, run } = useActions();
  const t = useNow(15000);
  const [editing, setEditing] = useState(false);
  const [sure, setSure] = useState(false);
  const [value, setValue] = useState('');
  useEffect(() => {
    setEditing(false);
    setSure(false);
  }, [event.id]);

  const close = Date.parse(event.close_at);
  const finished = event.status === 'finished';
  const open = !finished && close > t;
  // Cierre puesto a mano: no coincide con la Sprint, o hay cierre firme sin que MotoGP haya dado la hora.
  const manual = event.sprint_at ? close !== Date.parse(event.sprint_at) : !event.close_provisional;
  const setClose = (iso, msg) => run(() => adminDo('admin_set_close', { p_event: event.id, p_close: iso }), msg);

  return (
    <section className="adm-state">
      <div className="between">
        <div className="strong" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <span className={`led ${open ? 'on' : ''}`} />
          <span>{finished ? 'Gran Premio terminado' : open ? 'Votación abierta' : 'Votación cerrada'}</span>
        </div>
        <div className="small muted">{manual ? 'Cierre a mano' : 'Cierre automático'}</div>
      </div>
      <div className="muted" style={{ fontSize: 14 }}>
        {open ? 'Se cierra' : 'Se cerró'} el {dayMid(close)} a las {hm(close)}
        {manual ? ', hora puesta por ti.' : event.close_provisional ? ' (provisional: MotoGP aún no ha publicado la hora de la Sprint).' : ', al arrancar la Sprint.'}
      </div>
      {finished ? null : editing ? (
        <div className="field">
          <label htmlFor="closeat">Nueva hora de cierre (hora de este móvil)</label>
          <input id="closeat" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="two" style={{ marginTop: 8 }}>
            <button
              className="btn"
              disabled={busy || !value}
              onClick={async () => {
                const ms = new Date(value).getTime();
                if (Number.isNaN(ms)) return;
                await setClose(new Date(ms).toISOString(), 'Hora de cierre cambiada');
                setEditing(false);
              }}
            >
              Guardar
            </button>
            <button className="btn quiet" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="two" style={{ marginTop: 0 }}>
            {open ? (
              <button
                className={`btn ${sure ? 'danger' : ''}`}
                disabled={busy}
                onClick={async () => {
                  if (!sure) return setSure(true);
                  setSure(false);
                  return setClose(new Date(now()).toISOString(), 'Votación cerrada');
                }}
              >
                {sure ? '¿Seguro? Cerrar' : 'Cerrar ahora'}
              </button>
            ) : (
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setValue(toLocalInput(Date.now() + 3600e3));
                  setEditing(true);
                }}
              >
                Reabrir
              </button>
            )}
            <button
              className="btn quiet"
              disabled={busy}
              onClick={() => {
                setValue(toLocalInput(close));
                setEditing(true);
                setSure(false);
              }}
            >
              Cambiar hora
            </button>
          </div>
          {manual ? (
            <button className="btn quiet wide" style={{ height: 44 }} disabled={busy} onClick={() => setClose(null, 'Cierre automático otra vez')}>
              Volver al cierre automático
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function RiderSheet({ player, event, current, onClose }) {
  const { d } = useData();
  const { busy, run } = useActions();
  const others = [...d.riders.values()].filter((r) => !r.votable).sort((a, b) => a.short_name.localeCompare(b.short_name, 'es'));
  const [all, setAll] = useState(false);
  const pick = async (riderId) => {
    const ok = await run(async () => {
      const r = await adminDo('admin_set_vote', { p_player: player.id, p_event: event.id, p_rider: riderId }, event.id);
      if (r.over_limit) return `Guardado. Ojo: ${player.name} lleva ya ${r.uses_after} usos de ese piloto`;
      return riderId ? `Voto de ${player.name} guardado` : `Voto de ${player.name} quitado`;
    });
    if (ok) onClose();
  };
  const row = (r) => {
    const uses = d.usesOf(player.id, r.id, event.id);
    const isCurrent = current && current.rider_id === r.id;
    return (
      <button key={r.id} className={`arow ${isCurrent ? 'sel' : ''}`} disabled={busy || isCurrent} onClick={() => pick(r.id)}>
        <Plate rider={r} />
        <span className="arow-name">
          <span>{r.short_name}</span>
          <small>{teamShort(r)}</small>
        </span>
        <span className={`small ${uses >= MAX_USES ? 'amber strong' : 'muted'}`}>
          {isCurrent ? 'Voto actual' : uses >= MAX_USES ? `Usado ${uses} de ${MAX_USES}` : uses ? `${uses} de ${MAX_USES}` : ''}
        </span>
      </button>
    );
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Voto de ${player.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-kerb" />
        <div className="sheet-head">
          <div>
            <h2 className="h2">Voto de {player.name}</h2>
            <div className="small muted" style={{ marginTop: 2 }}>
              GP de {event.name} · como administrador no hay límite de cambios
            </div>
          </div>
          <button className="back" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="alist">
          {d.votable.map(row)}
          {all ? others.map(row) : null}
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {!all && others.length ? (
            <button className="btn quiet wide" style={{ height: 44 }} onClick={() => setAll(true)}>
              Ver también sustitutos
            </button>
          ) : null}
          {current ? (
            <button className="btn wide danger" style={{ height: 44 }} disabled={busy} onClick={() => pick(null)}>
              Quitar el voto
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Votes({ event }) {
  const { d } = useData();
  const [editing, setEditing] = useState(null);
  const players = d.activePlayers;
  const voted = players.filter((p) => d.voteOf(p.id, event.id)).length;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h2">Votos del GP</h2>
        <div className="small muted">
          Han votado <span className="num" style={{ color: 'var(--text)' }}>{voted}</span> de {players.length}
        </div>
      </div>
      <div className="rows">
        {players.map((p) => {
          const v = d.voteOf(p.id, event.id);
          const rider = v ? d.riders.get(v.rider_id) : null;
          return (
            <div key={p.id} className="vrow">
              <div className="vrow-name">{p.name}</div>
              <div className="vrow-vote">
                {rider ? (
                  <>
                    <Plate rider={rider} />
                    <span>{rider.short_name}</span>
                  </>
                ) : (
                  <span className="muted">Sin voto</span>
                )}
              </div>
              <button className={`btn faint ${rider ? 'lit' : ''}`} style={{ minWidth: 96 }} onClick={() => setEditing(p)} aria-label={`${rider ? 'Editar el voto de' : 'Poner voto a'} ${p.name}`}>
                {rider ? 'Editar' : 'Poner voto'}
              </button>
            </div>
          );
        })}
      </div>
      {editing ? <RiderSheet player={editing} event={event} current={d.voteOf(editing.id, event.id)} onClose={() => setEditing(null)} /> : null}
    </section>
  );
}

function ManualPoints({ event, data, onDone }) {
  const { d } = useData();
  const { busy, run } = useActions();
  const existing = new Map((data?.rider_points || []).map((p) => [p.rider_id, p]));
  // Primero los pilotos votados en este GP, que son los que reparten puntos.
  const votedIds = new Set(d.activePlayers.map((p) => d.voteOf(p.id, event.id)?.rider_id).filter(Boolean));
  const riders = [...d.riders.values()]
    .filter((r) => r.votable || existing.has(r.id))
    .sort((a, b) => votedIds.has(b.id) - votedIds.has(a.id) || a.short_name.localeCompare(b.short_name, 'es'));
  const [form, setForm] = useState(() => {
    const init = {};
    for (const r of riders) {
      const p = existing.get(r.id);
      init[r.id] = { s: p?.sprint_pos ?? '', r: p?.race_pos ?? '' };
    }
    return init;
  });
  const set = (id, key, value) => setForm((f) => ({ ...f, [id]: { ...f[id], [key]: value.replace(/[^0-9]/g, '').slice(0, 2) } }));
  const toPos = (v) => (v === '' || v == null ? null : Number(v));
  const changed = riders.filter((r) => {
    const p = existing.get(r.id);
    return toPos(form[r.id].s) !== (p?.sprint_pos ?? null) || toPos(form[r.id].r) !== (p?.race_pos ?? null);
  });
  const save = async () => {
    const ok = await run(async () => {
      for (const r of changed) {
        const s = toPos(form[r.id].s);
        const c = toPos(form[r.id].r);
        const res = await adminRead('admin_set_points', {
          p_event: event.id,
          p_rider: r.id,
          p_sprint_pos: s,
          p_sprint_points: pointsFor(SPRINT_POINTS, s),
          p_race_pos: c,
          p_race_points: pointsFor(RACE_POINTS, c),
        });
        if (res && res.ok === false) throw Object.assign(new Error(res.error), { code: res.error });
      }
      await adminDo('admin_recalc', { p_event: event.id }, event.id);
      return `Resultados guardados (${changed.length} ${changed.length === 1 ? 'piloto' : 'pilotos'})`;
    });
    if (ok) onDone();
  };
  return (
    <div className="box" style={{ marginTop: 12, gap: 10 }}>
      <div className="between">
        <span className="label">Posición de cada piloto</span>
        <button className="back" style={{ height: 32 }} onClick={onDone} aria-label="Cerrar">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="small muted">
        Escribe el puesto en la Sprint y en la carrera; los puntos salen solos. Vacío es fuera de los puntos o sin correr. Lo que metas a mano no lo pisa la carga automática.
      </p>
      <div className="mhead">
        <span style={{ flex: 1 }}>Piloto</span>
        <span>Sprint</span>
        <span>Carrera</span>
        <span style={{ width: 34, textAlign: 'right' }}>Pts</span>
      </div>
      {riders.map((r) => {
        const s = toPos(form[r.id].s);
        const c = toPos(form[r.id].r);
        return (
          <div key={r.id} className="mrow">
            <Plate rider={r} />
            <span className="mrow-name">
              {r.short_name}
              {votedIds.has(r.id) ? <i className="vdot" title="Votado en este GP" /> : null}
            </span>
            <input inputMode="numeric" aria-label={`Puesto de ${r.short_name} en la Sprint`} value={form[r.id].s} onChange={(e) => set(r.id, 's', e.target.value)} />
            <input inputMode="numeric" aria-label={`Puesto de ${r.short_name} en la carrera`} value={form[r.id].r} onChange={(e) => set(r.id, 'r', e.target.value)} />
            <span className="num" style={{ width: 34, textAlign: 'right' }}>
              {pointsFor(SPRINT_POINTS, s) + pointsFor(RACE_POINTS, c)}
            </span>
          </div>
        );
      })}
      <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <i className="vdot" /> votado por algún jugador en este GP
      </div>
      <button className="cta m" disabled={busy || !changed.length} onClick={save}>
        {changed.length ? `Guardar ${changed.length} ${changed.length === 1 ? 'cambio' : 'cambios'}` : 'Sin cambios'}
      </button>
    </div>
  );
}

function Results({ event }) {
  const { eventData } = useData();
  const { busy, run } = useActions();
  const [manualOpen, setManualOpen] = useState(false);
  const data = eventData[event.id];
  useEffect(() => {
    setManualOpen(false);
    loadEvent(event.id);
  }, [event.id]);

  const sessions = sessionsOf(data, event, 'MotoGP');
  const points = data?.rider_points || [];
  const manualCount = points.filter((p) => p.manual).length;
  const state = (code, key) => {
    const s = sessions.find((x) => x.code === code);
    const has = points.some((p) => p[key] != null);
    return { when: s ? dayMid(s.starts_at) : null, text: has ? 'Cargada' : 'Pendiente', ok: has };
  };
  const rows = [
    ['Sprint', state('SPR', 'sprint_pos')],
    ['Carrera', state('RAC', 'race_pos')],
  ];
  const finished = event.status === 'finished';

  return (
    <section className="sec">
      <div className="sec-head">
        <h2 className="h2">Resultados</h2>
        <div className="small muted">{manualCount ? `${manualCount} a mano` : 'Automático desde MotoGP'}</div>
      </div>
      <div className="rows">
        {rows.map(([name, s]) => (
          <div key={name} className="kv mid" style={{ minHeight: 52 }}>
            <div>
              <span className="strong">{name}</span>
              {s.when ? <span className="muted"> · {s.when}</span> : null}
            </div>
            <div className={s.ok ? 'green strong' : ''} style={s.ok ? { color: 'var(--green)' } : undefined}>
              {s.text}
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: '12px 0', fontSize: 14 }}>
        Se cargan solos al terminar cada carrera y los puntos se reparten al momento. Si MotoGP tarda o hay una sanción, puedes forzarlo aquí.
      </p>
      {manualOpen ? (
        <ManualPoints event={event} data={data} onDone={() => setManualOpen(false)} />
      ) : (
        <div className="stack">
          <div className="two" style={{ marginTop: 0 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await adminRead('admin_sync_now', { p_event: event.id });
                  // La carga tarda unos segundos en el servidor.
                  await new Promise((r) => setTimeout(r, 9000));
                  await refresh();
                  await loadEvent(event.id);
                  return 'Pedido a MotoGP. Si había algo nuevo, ya está cargado';
                })
              }
            >
              Sincronizar
            </button>
            <button className="btn" disabled={busy} onClick={() => setManualOpen(true)}>
              Meter a mano
            </button>
          </div>
          <button className="btn quiet wide" style={{ height: 44 }} disabled={busy} onClick={() => run(() => adminDo('admin_recalc', { p_event: event.id }, event.id), 'Puntos del GP recalculados')}>
            Recalcular puntos del GP
          </button>
          {manualCount ? (
            <button className="btn quiet wide" style={{ height: 44 }} disabled={busy} onClick={() => run(() => adminDo('admin_auto_points', { p_event: event.id }, event.id), 'Resultados a mano descartados: se vuelven a pedir a MotoGP')}>
              Descartar lo metido a mano
            </button>
          ) : null}
          <button
            className="btn quiet wide"
            style={{ height: 44 }}
            disabled={busy}
            onClick={() => run(() => adminDo('admin_set_finished', { p_event: event.id, p_finished: !finished }, event.id), finished ? 'GP reabierto' : 'GP dado por terminado')}
          >
            {finished ? 'Reabrir este GP' : 'Dar este GP por terminado'}
          </button>
        </div>
      )}
    </section>
  );
}

const LOG_TEXT = {
  voto: (l, n) => (
    <>
      <b>{n.player}</b> votó a {n.rider}
    </>
  ),
  cambio: (l, n) => (
    <>
      <b>{n.player}</b> cambió de {n.prev} a {n.rider}
    </>
  ),
  admin_pone: (l, n) => (
    <>
      Administrador: voto de <b>{n.player}</b> a {n.rider}
      {n.prev ? ` (antes ${n.prev})` : ''}
    </>
  ),
  admin_borra: (l, n) => (
    <>
      Administrador: quitó el voto de <b>{n.player}</b>
      {n.prev ? ` (${n.prev})` : ''}
    </>
  ),
};

function Log({ event, stamp }) {
  const { d } = useData();
  const [rows, setRows] = useState(null);
  const [limit, setLimit] = useState(8);
  useEffect(() => {
    let alive = true;
    setRows(null);
    adminRead('admin_log', { p_event: event.id, p_limit: 200 })
      .then((r) => alive && setRows(r || []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [event.id, stamp]);
  const name = (id, map, key) => (id && map.get(id) ? map.get(id)[key] : null);
  return (
    <section className="sec">
      <h2 className="h2" style={{ marginBottom: 12 }}>
        Historial de cambios
      </h2>
      <div className="rows">
        {rows == null ? (
          <p className="muted" style={{ padding: '12px 0' }}>
            Cargando…
          </p>
        ) : !rows.length ? (
          <p className="muted" style={{ padding: '12px 0' }}>
            Aún no hay votos ni cambios en este GP.
          </p>
        ) : (
          rows.slice(0, limit).map((l, i) => {
            const n = { player: name(l.player_id, d.players, 'name') || 'Jugador', rider: name(l.rider_id, d.riders, 'short_name'), prev: name(l.prev_rider_id, d.riders, 'short_name') };
            const text = (LOG_TEXT[l.action] || LOG_TEXT.voto)(l, n);
            return (
              <div key={i} className="logrow">
                <div>{text}</div>
                <div className="small muted">
                  {whenText(l.at, now())}
                  {l.device_label ? ` · desde un ${l.device_label === 'Ordenador' ? 'ordenador' : l.device_label}` : ''}
                </div>
              </div>
            );
          })
        )}
      </div>
      {rows && rows.length > limit ? (
        <button className="linkrow" onClick={() => setLimit(limit + 30)}>
          <span>Ver más ({rows.length - limit})</span>
          <Icon name="down" size={14} stroke={2.4} />
        </button>
      ) : null}
    </section>
  );
}

function PlayerEditor({ player, onDone }) {
  const { busy, run } = useActions();
  const [name, setName] = useState(player ? player.name : '');
  const [active, setActive] = useState(player ? player.active : true);
  const save = async () => {
    const ok = await run(() => adminDo('admin_save_player', { p_id: player ? player.id : null, p_name: name.trim(), p_active: active }), player ? 'Jugador guardado' : `${name.trim()} añadido a la porra`);
    if (ok) onDone();
  };
  return (
    <div className="box" style={{ gap: 10, margin: '8px 0' }}>
      <div className="field">
        <label htmlFor="pname">{player ? 'Nombre' : 'Nombre del jugador nuevo'}</label>
        <input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="off" />
      </div>
      {player ? (
        <button className="check-row" onClick={() => setActive(!active)} aria-pressed={active}>
          <span className={`tick ${active ? 'on' : ''}`}>{active ? <Icon name="check" size={14} stroke={3} /> : null}</span>
          <span>Juega esta temporada</span>
        </button>
      ) : null}
      <div className="two" style={{ marginTop: 0 }}>
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>
          Guardar
        </button>
        <button className="btn quiet" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function SecretEditor({ kind, onDone }) {
  const { busy, run } = useActions();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const isCode = kind === 'code';
  const save = async () => {
    if (isCode && a.trim().length < 4) return setError(messageFor('CODIGO_CORTO'));
    if (!isCode && a.length < 6) return setError(messageFor('CONTRASENA_CORTA'));
    if (!isCode && a !== b) return setError('Las dos contraseñas no coinciden.');
    setError('');
    const ok = await run(
      () => adminDo('admin_change_secrets', isCode ? { p_code: a.trim() } : { p_admin_password: a }),
      isCode ? 'Código cambiado. Los móviles que ya estaban dentro siguen dentro' : 'Contraseña de administrador cambiada',
    );
    if (ok) onDone();
    return null;
  };
  return (
    <div className="box" style={{ gap: 10, margin: '8px 0' }}>
      <div className="field">
        <label htmlFor="sec-a">{isCode ? 'Código nuevo de la porra' : 'Contraseña nueva'}</label>
        <input id="sec-a" type={isCode ? 'text' : 'password'} value={a} onChange={(e) => setA(e.target.value)} autoComplete={isCode ? 'off' : 'new-password'} autoCapitalize="none" />
        <span className="hint">{isCode ? 'Mínimo 4 caracteres. Solo hace falta para móviles nuevos.' : 'Mínimo 6 caracteres.'}</span>
      </div>
      {isCode ? null : (
        <div className="field">
          <label htmlFor="sec-b">Repite la contraseña</label>
          <input id="sec-b" type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
        </div>
      )}
      {error ? (
        <p className="err-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="two" style={{ marginTop: 0 }}>
        <button className="btn" disabled={busy || !a} onClick={save}>
          Guardar
        </button>
        <button className="btn quiet" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Riders() {
  const { d } = useData();
  const { busy, run } = useActions();
  const list = [...d.riders.values()].sort((a, b) => b.votable - a.votable || a.short_name.localeCompare(b.short_name, 'es'));
  return (
    <div className="box" style={{ gap: 0, margin: '8px 0', padding: '4px 12px' }}>
      {list.map((r) => (
        <button
          key={r.id}
          className="check-row"
          disabled={busy}
          aria-pressed={r.votable}
          onClick={() => run(() => adminDo('admin_save_rider', { p_id: r.id, p_short_name: r.short_name, p_votable: !r.votable }), r.votable ? `${r.short_name} ya no se puede votar` : `${r.short_name} ya se puede votar`)}
        >
          <span className={`tick ${r.votable ? 'on' : ''}`}>{r.votable ? <Icon name="check" size={14} stroke={3} /> : null}</span>
          <Plate rider={r} />
          <span style={{ flex: 1, minWidth: 0 }}>{r.short_name}</span>
          <span className="small muted">{teamShort(r)}</span>
        </button>
      ))}
    </div>
  );
}

function Access() {
  const { boot } = useData();
  const { busy, run } = useActions();
  const [open, setOpen] = useState(null); // 'add' | 'code' | 'pass' | 'list' | id de jugador
  const [status, setStatus] = useState(null);
  useEffect(() => {
    adminRead('admin_status')
      .then(setStatus)
      .catch(() => {});
  }, []);
  const players = boot.players;
  const activeCount = players.filter((p) => p.active).length;
  const editing = players.find((p) => p.id === open);
  return (
    <section className="sec">
      <h2 className="h2" style={{ marginBottom: 12 }}>
        Jugadores y acceso
      </h2>
      <div className="rows">
        <div className="kv mid">
          <div>
            <span className="num">{activeCount}</span> jugadores
            {players.length > activeCount ? <span className="muted"> · {players.length - activeCount} de baja</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn faint lit" onClick={() => setOpen(open === 'list' ? null : 'list')}>
              {open === 'list' || editing ? 'Ocultar' : 'Editar'}
            </button>
            <button className="btn faint lit" onClick={() => setOpen('add')}>
              Añadir
            </button>
          </div>
        </div>
        {open === 'add' ? <PlayerEditor onDone={() => setOpen(null)} /> : null}
        {open === 'list' || editing
          ? players.map((p) =>
              editing && editing.id === p.id ? (
                <PlayerEditor key={p.id} player={p} onDone={() => setOpen('list')} />
              ) : (
                <div key={p.id} className="kv mid" style={{ minHeight: 48 }}>
                  <div className={p.active ? '' : 'muted'}>
                    {p.name}
                    {p.active ? '' : ' · de baja'}
                  </div>
                  <button className="btn faint lit" onClick={() => setOpen(p.id)} aria-label={`Editar a ${p.name}`}>
                    Editar
                  </button>
                </div>
              ),
            )
          : null}
        <div className="kv mid">
          <div>
            <span className="num">{boot.riders.filter((r) => r.votable).length}</span> pilotos que se pueden votar
          </div>
          <button className="btn faint lit" onClick={() => setOpen(open === 'riders' ? null : 'riders')}>
            {open === 'riders' ? 'Ocultar' : 'Editar'}
          </button>
        </div>
        {open === 'riders' ? <Riders /> : null}
        <div className="kv mid">
          <div>
            Código de la porra
            <div className="small muted">Se pide una vez en cada móvil nuevo</div>
          </div>
          <button className="btn faint lit" onClick={() => setOpen(open === 'code' ? null : 'code')}>
            Cambiar
          </button>
        </div>
        {open === 'code' ? <SecretEditor kind="code" onDone={() => setOpen(null)} /> : null}
        <div className="kv mid">
          <div>Contraseña de administrador</div>
          <button className="btn faint lit" onClick={() => setOpen(open === 'pass' ? null : 'pass')}>
            Cambiar
          </button>
        </div>
        {open === 'pass' ? <SecretEditor kind="pass" onDone={() => setOpen(null)} /> : null}
        {status ? (
          <>
            <div className="kv mid" style={{ minHeight: 48 }}>
              <div>Móviles dados de alta</div>
              <div className="num" style={{ color: 'var(--text)' }}>
                {status.devices}
              </div>
            </div>
            <div className="kv mid" style={{ minHeight: 48 }}>
              <div>Última carga desde MotoGP</div>
              <div>{status.last_sync ? `${whenText(status.last_sync.at, now())} · ${status.last_sync.ok ? 'correcta' : 'con errores'}` : 'Sin datos'}</div>
            </div>
          </>
        ) : null}
      </div>
      <button className="linkrow" style={{ marginTop: 20 }} disabled={busy} onClick={() => run(() => adminLogout(), 'Has salido del modo administrador')}>
        Salir del modo administrador
      </button>
    </section>
  );
}

function Panel() {
  const { boot, d } = useData();
  const events = boot.events;
  const start = d.events.get(boot.current_event_id) || d.events.get(boot.voting_event_id) || d.lastFinished || events[0];
  const [index, setIndex] = useState(() => Math.max(0, events.findIndex((e) => e.id === start?.id)));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [stamp, setStamp] = useState(0);
  const timer = useRef(null);
  const flash = useCallback((text, bad = false) => {
    clearTimeout(timer.current);
    setToast({ text, bad });
    timer.current = setTimeout(() => setToast(null), bad ? 5000 : 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Devuelve true si la acción ha salido bien. El mensaje puede venir fijo o de la propia acción.
  const run = useCallback(
    async (fn, okText) => {
      setBusy(true);
      try {
        const out = await fn();
        flash(typeof out === 'string' ? out : okText || 'Hecho');
        setStamp((s) => s + 1);
        return true;
      } catch (e) {
        flash(messageFor(e.code), true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [flash],
  );

  const event = events[Math.min(index, events.length - 1)];
  if (!event) return null;
  return (
    <Actions.Provider value={{ busy, run }}>
      <GpNav event={event} canPrev={index > 0} canNext={index < events.length - 1} onMove={(step) => setIndex((i) => Math.min(events.length - 1, Math.max(0, i + step)))} />
      <Voting event={event} />
      <Votes event={event} />
      <Results event={event} />
      <Log event={event} stamp={stamp} />
      <Access />
      {toast ? (
        <div className={`toast ${toast.bad ? 'bad' : ''}`} role="status">
          {toast.text}
        </div>
      ) : null}
    </Actions.Provider>
  );
}

export default function Admin() {
  const { boot } = useData();
  return (
    <>
      <TopBar title="Administrador" back="mas" who={false} />
      <main className="main has-nav">{boot.is_admin ? <Panel /> : <Login />}</main>
    </>
  );
}
