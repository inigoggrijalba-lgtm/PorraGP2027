// Ficha rápida del piloto al votar: últimos 3 GP, Mundial, el año pasado en este circuito y quién más lo lleva.
// Se puede cerrar; cerrada queda en una línea. El móvil recuerda si la quieres abierta o cerrada.
import { useEffect, useState } from 'react';
import { catSlug } from './history.js';
import { loadEvent, loadHistory, loadRiders } from './store.js';
import { useData } from './ui.jsx';

const KEY = 'porragp.ficha';
function readOpen() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}
const ord = (n) => (n ? `${n}.º` : '–');

// El año pasado en este GP (MotoGP): posición de cada piloto en la Sprint y en la carrera.
// Se pide al histórico una sola vez por GP y se recuerda mientras la app esté abierta.
const lastYearAsked = new Map();
function lastYear(season, short) {
  const key = `${season}|${short}`;
  if (!lastYearAsked.has(key)) {
    const p = (async () => {
      const all = await loadHistory();
      const s = (all.seasons || []).find((x) => x.year === season - 1);
      if (!s) return null;
      const sea = await loadHistory(s.id);
      const ev = (sea.events || []).find((e) => e.short === short);
      const cat = (sea.categories || []).find((c) => catSlug(c) === 'motogp');
      if (!ev || !cat) return null;
      const ses = await loadHistory(s.id, ev.id, cat.id);
      const out = new Map();
      for (const code of ['SPR', 'RAC']) {
        const one = (ses.sessions || []).find((x) => x.code === code);
        if (!one) continue;
        const res = await loadHistory(s.id, ev.id, cat.id, one.id);
        for (const r of res.result.rows || []) {
          if (!r.rider_uuid) continue;
          const row = out.get(r.rider_uuid) || {};
          row[code] = r.pos || null;
          out.set(r.rider_uuid, row);
        }
      }
      return out;
    })();
    p.catch(() => lastYearAsked.delete(key));
    lastYearAsked.set(key, p);
  }
  return lastYearAsked.get(key);
}

const X = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const UP = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export function QuickCard({ event, rider }) {
  const { boot, d, eventData, active } = useData();
  const [open, setOpen] = useState(readOpen);
  const [world, setWorld] = useState(null);
  const [past, setPast] = useState(undefined); // undefined: cargando; null: no hay datos

  const last3 = boot.events
    .filter((e) => e.status === 'finished')
    .sort((a, b) => a.round - b.round)
    .slice(-3);

  // Puntos de cada piloto en los últimos GP: se piden los que aún no estén cargados.
  useEffect(() => {
    for (const e of last3) if (!eventData[e.id]) loadEvent(e.id);
  }, [last3.map((e) => e.id).join()]);
  useEffect(() => {
    let alive = true;
    loadRiders()
      .then((list) => alive && setWorld(list))
      .catch(() => null);
    lastYear(boot.season, event.short_name)
      .then((m) => alive && setPast(m))
      .catch(() => alive && setPast(null));
    return () => {
      alive = false;
    };
  }, [event.id]);

  const toggle = (v) => {
    setOpen(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      // sin almacenamiento, vale para esta visita
    }
  };

  const gp = world ? world.find((r) => r.category === 'MotoGP' && r.id === rider.api_uuid) : null;
  const ly = past ? past.get(rider.api_uuid) || {} : null;
  const lyText = past === undefined ? '…' : !ly || (!ly.SPR && !ly.RAC) ? 'No corrió' : null;
  const form = last3.map((e) => {
    const p = (eventData[e.id]?.rider_points || []).find((x) => x.rider_id === rider.id);
    return { e, s: p?.sprint_points || 0, c: p?.race_points || 0, known: !!eventData[e.id] };
  });
  const others = d.activePlayers.filter((p) => p.id !== active && d.voteOf(p.id, event.id)?.rider_id === rider.id).map((p) => p.name);
  const uses = d.usesOf(active, rider.id, event.id);

  if (!open) {
    return (
      <button className="fq-mini" onClick={() => toggle(true)} aria-label="Abrir la ficha del piloto">
        <span>Mundial</span>
        <b>{gp ? ord(gp.pos) : '…'}</b>
        <span className="dot">·</span>
        <span>{boot.season - 1}</span>
        {lyText ? (
          <b>{lyText}</b>
        ) : (
          <>
            <b>S: {ord(ly.SPR)}</b>
            <span className="dot">·</span>
            <b>D: {ord(ly.RAC)}</b>
          </>
        )}
        <span className="up">{UP}</span>
      </button>
    );
  }
  return (
    <div className="fq">
      <div className="fq-head">
        <span>Ficha del piloto</span>
        <button className="fq-x" onClick={() => toggle(false)} aria-label="Cerrar la ficha del piloto">
          {X}
        </button>
      </div>
      <div className="fq-row">
        <div className="fq-box">
          <div className="fq-k">Últimos {form.length} GP</div>
          <div className="fq-form" aria-label={form.map((f) => `${f.e.short_name}: ${f.s + f.c} puntos`).join(', ')}>
            {form.map((f) => (
              <div key={f.e.id} className="fq-bar">
                <b>{f.known ? f.s + f.c : '…'}</b>
                <span style={{ height: `${Math.max(2, Math.round(((f.s + f.c) / 37) * 36))}px` }}>
                  <i style={{ flex: f.c || 0.0001 }} />
                  <i className="s" style={{ flex: f.s || 0.0001 }} />
                </span>
              </div>
            ))}
          </div>
          <div className="fq-lbl" aria-hidden="true">
            {form.map((f) => (
              <span key={f.e.id}>{f.e.short_name}</span>
            ))}
          </div>
        </div>
        <div className="fq-box fq-side">
          <div>
            <div className="fq-k">Mundial</div>
            <div className="fq-v">
              {gp ? (
                <>
                  {ord(gp.pos)} <small>· {String(gp.points ?? 0).replace('.', ',')} pts</small>
                </>
              ) : (
                '…'
              )}
            </div>
          </div>
          <div>
            <div className="fq-k">El año pasado</div>
            <div className="fq-v">
              {lyText ? (
                <small>{lyText === '…' ? '…' : 'No corrió aquí'}</small>
              ) : (
                <>
                  {ord(ly.SPR)} <small>Sprint</small> · {ord(ly.RAC)} <small>Carrera</small>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="fq-box fq-who">
        {others.length ? (
          <>
            <b>Lo llevan {others.length}:</b> {others.length > 1 ? `${others.slice(0, -1).join(', ')} y ${others[others.length - 1]}` : others[0]}
          </>
        ) : (
          <b>Nadie más lo lleva</b>
        )}
        {' · '}
        {uses ? `Ya lo has votado ${uses} ${uses === 1 ? 'vez' : 'veces'}` : 'Aún no lo has votado'}
      </div>
    </div>
  );
}
