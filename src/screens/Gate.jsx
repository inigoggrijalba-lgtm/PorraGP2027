// Pantallas de entrada: primera configuración, código de la porra y elección de jugadores.
import { useState } from 'react';
import { messageFor } from '../api.js';
import { init, join, setPlayers, setup, useStore } from '../store.js';
import { Avatar, Icon } from '../ui.jsx';

function Shell({ children }) {
  return (
    <div className="gate">
      <div className="gate-brand">
        Porra<span>GP</span>
      </div>
      <div className="gate-kerb" />
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="center-fill" role="status" aria-label="Cargando">
      <div className="gate-brand">
        Porra<span>GP</span>
      </div>
      <div className="pulse" />
    </div>
  );
}

export function ErrorScreen() {
  const { error } = useStore();
  return (
    <Shell>
      <h1 className="gate-title">No se ha podido cargar</h1>
      <p className="muted">{messageFor(error)}</p>
      <button className="cta" onClick={() => init()}>
        Reintentar
      </button>
    </Shell>
  );
}

function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(messageFor(err.code));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function Setup() {
  const [code, setCode] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const { busy, error, setError, run } = useSubmit(() => setup(code.trim(), pass));
  const submit = (e) => {
    e.preventDefault();
    if (code.trim().length < 4) return setError(messageFor('CODIGO_CORTO'));
    if (pass.length < 6) return setError(messageFor('CONTRASENA_CORTA'));
    if (pass !== pass2) return setError('Las dos contraseñas no coinciden.');
    return run();
  };
  return (
    <Shell>
      <div>
        <h1 className="gate-title">Primera configuración</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Solo se hace una vez. Elige el código que darás a los jugadores y tu contraseña de administrador.
        </p>
      </div>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="code">Código de la porra</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" inputMode="text" />
          <span className="hint">Mínimo 4 caracteres. Se pide una vez en cada móvil.</span>
        </div>
        <div className="field">
          <label htmlFor="pass">Contraseña de administrador</label>
          <input id="pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
          <span className="hint">Mínimo 6 caracteres. Es solo para ti.</span>
        </div>
        <div className="field">
          <label htmlFor="pass2">Repite la contraseña</label>
          <input id="pass2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        </div>
        {error ? (
          <p className="err-text" role="alert">
            {error}
          </p>
        ) : null}
        <button className="cta" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </Shell>
  );
}

export function Join() {
  const [code, setCode] = useState('');
  const { busy, error, run } = useSubmit(() => join(code.trim()));
  return (
    <Shell>
      <div>
        <h1 className="gate-title">Entra en la porra</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Escribe el código que te ha pasado el organizador. Solo se pide una vez en este móvil.
        </p>
      </div>
      <form className="form" onSubmit={run} noValidate>
        <div className="field">
          <label htmlFor="code">Código de la porra</label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck="false" autoFocus />
        </div>
        {error ? (
          <p className="err-text" role="alert">
            {error}
          </p>
        ) : null}
        <button className="cta" type="submit" disabled={busy || code.trim().length < 4}>
          {busy ? 'Entrando…' : 'Entrar'}
          {busy ? null : <Icon name="arrow" size={18} stroke={2.4} />}
        </button>
      </form>
    </Shell>
  );
}

export function PickPlayers() {
  const { boot } = useStore();
  const [picked, setPicked] = useState([]);
  const { busy, error, run } = useSubmit(() => setPlayers(picked, true));
  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const players = boot.players.filter((p) => p.active);
  return (
    <Shell>
      <div>
        <h1 className="gate-title">¿Quién vota desde este móvil?</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Marca tu nombre. Si desde este móvil votáis varios, marcadlos todos: luego se cambia de uno a otro con un toque.
        </p>
      </div>
      <div className="names">
        {players.map((p) => {
          const on = picked.includes(p.id);
          return (
            <button key={p.id} aria-pressed={on} onClick={() => toggle(p.id)}>
              <Avatar name={p.name} on={on} />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="err-text" role="alert">
          {error}
        </p>
      ) : null}
      <button className="cta" onClick={run} disabled={busy || !picked.length} style={{ marginTop: 'auto' }}>
        {busy ? 'Guardando…' : picked.length > 1 ? `Entrar con ${picked.length} jugadores` : 'Entrar'}
      </button>
    </Shell>
  );
}
