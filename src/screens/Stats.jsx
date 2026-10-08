// Porra › Estadísticas: la temporada de un jugador frente al resto, GP a GP.
import { useEffect, useRef, useState } from 'react';
import { ordinal } from '../data.js';
import { now } from '../store.js';
import { Icon, useData } from '../ui.jsx';

const MAX_GP = 37; // 12 del Sprint + 25 de la carrera
const dec = (n) => n.toFixed(1).replace('.', ',');
const pts = (n) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

// "Italia", "Italia y Hungría", "Italia y 2 más"
function someNames(list) {
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} y ${list[1]}`;
  return `${list[0]} y ${list.length - 1} más`;
}

// Ancho real del hueco, para dibujar el gráfico a su tamaño y que la letra no encoja.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function Evolution({ events, series, me, other, sel, onSel }) {
  const [ref, width] = useWidth();
  const W = width || 350;
  const H = 240;
  const X0 = 30;
  const X1 = W - 56;
  const Y0 = 216;
  const TOP = 14;
  const n = events.length;
  const top = Math.max(10, ...series.map((s) => s.cum[n - 1])) * 1.04;
  const step = [5, 10, 20, 25, 50, 100, 200, 500, 1000].find((s) => top / s <= 4.5) || 1000;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const x = (i) => (n > 1 ? X0 + (i * (X1 - X0)) / (n - 1) : X0);
  const y = (v) => Y0 - (v / top) * (Y0 - TOP);
  const path = (s) => s.cum.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const rest = series.filter((s) => s !== me && s !== other);

  // Nombres de GP en el eje: unos pocos, sin pisarse, y siempre el último.
  const every = Math.ceil(n / 6);
  const marks = [];
  for (let i = 0; i < n; i += every) if (x(n - 1) - x(i) >= 30 || i === n - 1) marks.push(i);
  if (marks[marks.length - 1] !== n - 1) marks.push(n - 1);

  // Etiquetas al final de las dos líneas destacadas; si se pisan, se separan.
  const last = n - 1;
  const at = { me: y(me.cum[last]), other: other ? y(other.cum[last]) : null };
  if (other && Math.abs(at.me - at.other) < 30) {
    const mid = (at.me + at.other) / 2;
    const meUp = me.cum[last] >= other.cum[last];
    at.me = mid + (meUp ? -15 : 15);
    at.other = mid + (meUp ? 15 : -15);
  }
  const shift = Math.max(0, 12 - Math.min(at.me, at.other ?? at.me)) - Math.max(0, Math.max(at.me, at.other ?? at.me) + 16 - (H - 4));
  const clip = (name) => (name.length > 8 ? `${name.slice(0, 7)}…` : name);

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = n > 1 ? Math.round(((e.clientX - box.left - X0) / (X1 - X0)) * (n - 1)) : 0;
    onSel(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') onSel(Math.max(0, sel - 1));
    else if (e.key === 'ArrowRight') onSel(Math.min(n - 1, sel + 1));
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref}>
      <svg
        className="evo"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`Puntos acumulados por Gran Premio: ${me.name} llega a ${me.cum[last]}${other ? ` y ${other.name}, a ${other.cum[last]}` : ''}. Con las flechas se recorre cada Gran Premio.`}
        onPointerDown={pick}
        onPointerMove={pick}
        onKeyDown={onKey}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X0} y1={y(v)} x2={X1} y2={y(v)} stroke={v ? '#2B2B2F' : '#55555A'} strokeWidth="1" />
            <text x={X0 - 6} y={y(v) + 4} fill="#B4B3AF" fontSize="11" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {marks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fill="#B4B3AF" fontSize="11" textAnchor="middle">
            {events[i].short_name}
          </text>
        ))}
        <line x1={x(sel)} y1={TOP - 4} x2={x(sel)} y2={Y0} stroke="#8E8D89" strokeWidth="1" strokeDasharray="3 3" />
        {n > 1 ? (
          <>
            <path d={rest.map(path).join(' ')} fill="none" stroke="#55555A" strokeWidth="1.5" strokeLinejoin="round" />
            {other ? <path d={path(other)} fill="none" stroke="#F5F4F2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
            <path d={path(me)} fill="none" stroke="#FF4B3A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          rest.map((s) => <circle key={s.id} cx={x(0)} cy={y(s.cum[0])} r="3" fill="#55555A" />)
        )}
        {sel !== last ? (
          <>
            {other ? <circle cx={x(sel)} cy={y(other.cum[sel])} r="4" fill="#F5F4F2" stroke="#0A0A0B" strokeWidth="2" /> : null}
            <circle cx={x(sel)} cy={y(me.cum[sel])} r="4" fill="#FF4B3A" stroke="#0A0A0B" strokeWidth="2" />
          </>
        ) : null}
        {other ? <circle cx={x(last)} cy={y(other.cum[last])} r="5" fill="#F5F4F2" stroke="#0A0A0B" strokeWidth="2" /> : null}
        <circle cx={x(last)} cy={y(me.cum[last])} r="5" fill="#FF4B3A" stroke="#0A0A0B" strokeWidth="2" />
        {other ? (
          <>
            <text x={X1 + 10} y={at.other + shift + 1} fill="#F5F4F2" fontSize="12" fontWeight="600">
              {clip(other.name)}
            </text>
            <text x={X1 + 10} y={at.other + shift + 15} fill="#B4B3AF" fontSize="12">
              {other.cum[last]}
            </text>
          </>
        ) : null}
        <text x={X1 + 10} y={at.me + shift + 1} fill="#F5F4F2" fontSize="12" fontWeight="600">
          {clip(me.name)}
        </text>
        <text x={X1 + 10} y={at.me + shift + 15} fill="#B4B3AF" fontSize="12">
          {me.cum[last]}
        </text>
      </svg>
    </div>
  );
}

function PickSheet({ series, current, mine, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ver las estadísticas de otro jugador" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-kerb" />
        <div className="sheet-head">
          <h2 className="h2">¿De quién?</h2>
          <button className="back" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="pick-list">
          {series.map((s) => (
            <button key={s.id} aria-pressed={s.id === current} onClick={() => onPick(s.id)}>
              <span className="num">{s.rank}</span>
              <span className="who-n">
                {s.name}
                {s.id === mine ? <span className="tag you">Tú</span> : null}
              </span>
              <span className="tot">{s.total}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Stats() {
  const { boot, d, standings, active } = useData();
  const [picked, setPicked] = useState(null);
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [scope, setScope] = useState('porra');
  const events = boot.events.filter((e) => e.status === 'finished');
  const list = standings.filter((s) => s.active);
  const n = events.length;
  if (!n || !list.length) {
    return (
      <div className="page-head">
        <h1 className="h1" style={{ fontSize: 24 }}>
          Estadísticas
        </h1>
        <p className="muted">Aparecerán aquí cuando termine el primer Gran Premio de la temporada.</p>
      </div>
    );
  }

  const series = list.map((s, i) => {
    let sum = 0;
    const per = events.map((e) => d.scoreOf(s.player_id, e.id)?.total ?? 0);
    return { id: s.player_id, name: s.name, rank: i + 1, total: s.total, per, cum: per.map((p) => (sum += p)) };
  });
  const me = series.find((s) => s.id === picked) || series.find((s) => s.id === active) || series[0];
  const mine = me.id === active;
  const leader = series[0];
  const other = me === leader ? series[1] || null : leader;
  const otherRole = other === leader ? 'Líder' : '2.º';
  const sel = chosen == null || chosen >= n ? n - 1 : chosen;
  const event = events[sel];

  const best = Math.max(...me.per);
  const bestAt = events.filter((e, i) => me.per[i] === best).map((e) => e.name);
  const zeroAt = events.filter((e, i) => me.per[i] === 0).map((e) => e.name);
  const place = 1 + series.filter((s) => s.cum[sel] > me.cum[sel]).length;
  const vote = d.voteOf(me.id, event.id);
  const rider = vote ? d.riders.get(vote.rider_id) : null;
  const score = d.scoreOf(me.id, event.id);

  // Votos de toda la porra en los GP ya cerrados.
  const closed = new Set(boot.events.filter((e) => e.status === 'finished' || Date.parse(e.close_at) <= now()).map((e) => e.id));
  const count = new Map();
  const onlyMe = scope === 'jugador';
  for (const v of boot.votes) {
    if (!closed.has(v.event_id) || (onlyMe && v.player_id !== me.id)) continue;
    count.set(v.rider_id, (count.get(v.rider_id) || 0) + 1);
  }
  const voted = [...count]
    .map(([id, times]) => ({ rider: d.riders.get(id), times }))
    .filter((v) => v.rider)
    .sort((a, b) => b.times - a.times || a.rider.short_name.localeCompare(b.rider.short_name, 'es'))
    .slice(0, onlyMe ? 22 : 8);
  const mostVotes = voted.length ? voted[0].times : 1;

  return (
    <>
      <div className="stat-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="h1" style={{ fontSize: 24 }}>
            {mine ? 'Tu temporada' : me.name}
          </h1>
          <div className="small muted" style={{ marginTop: 4 }}>
            {mine ? `${me.name} · ` : ''}
            {ordinal(me.rank)} con {pts(me.total)}
          </div>
        </div>
        {series.length > 1 ? (
          <button className="btn faint lit" onClick={() => setChoosing(true)}>
            <span>Ver otro jugador</span>
            <Icon name="down" size={14} stroke={2.4} />
          </button>
        ) : null}
      </div>

      <div className="stiles">
        <div className="stile">
          <div className="label">Media por GP</div>
          <b>{dec(me.cum[n - 1] / n)}</b>
          <small>{other ? `${otherRole}: ${dec(other.cum[n - 1] / n)}` : ' '}</small>
        </div>
        <div className="stile">
          <div className="label">Mejor GP</div>
          <b>{best}</b>
          <small>{best ? someNames(bestAt) : 'Aún sin puntos'}</small>
        </div>
        <div className="stile">
          <div className="label">GP a cero</div>
          <b>{zeroAt.length}</b>
          <small>{zeroAt.length ? someNames(zeroAt) : 'Ninguno'}</small>
        </div>
      </div>

      <section className="sec">
        <div className="sec-head" style={{ marginBottom: 10 }}>
          <h2 className="h2">Evolución</h2>
          <div className="small muted">Puntos acumulados</div>
        </div>
        <div className="slegend">
          <span>
            <i style={{ height: 3, background: '#FF4B3A' }} />
            {mine ? 'Tú' : me.name}
          </span>
          {other ? (
            <span>
              <i style={{ height: 3, background: '#F5F4F2' }} />
              {otherRole}
            </span>
          ) : null}
          {series.length > 2 ? (
            <span>
              <i style={{ height: 2, background: '#55555A' }} />
              Resto de jugadores
            </span>
          ) : null}
        </div>
        <Evolution events={events} series={series} me={me} other={other} sel={sel} onSel={setChosen} />
        <div className="readout" aria-live="polite">
          <b>
            GP de {event.name} · ronda {event.round}
          </b>
          <span>
            {mine ? 'Tú' : me.name}: {me.cum[sel]}, {ordinal(place)}
            {other ? ` · ${other.name}: ${other.cum[sel]}` : ''}
          </span>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="h2">{mine ? 'Tus puntos por GP' : 'Puntos por GP'}</h2>
          <div className="small muted">Máximo posible: {MAX_GP}</div>
        </div>
        <div className="sbars" role="group" aria-label="Puntos en cada Gran Premio">
          {events.map((e, i) => {
            const p = me.per[i];
            return (
              <button key={e.id} aria-pressed={i === sel} aria-label={`Ronda ${e.round}, ${e.name}: ${pts(p)}`} onClick={() => setChosen(i)}>
                <span>{p === best || p === 0 || i === sel ? p : ''}</span>
                <i style={{ height: Math.max(2, Math.round((p / MAX_GP) * 100)) }} />
              </button>
            );
          })}
        </div>
        <div className="sbars-x" aria-hidden="true">
          {events.map((e, i) => (
            <span key={e.id} className={i === sel ? 'on' : ''}>
              {e.round}
            </span>
          ))}
        </div>
        <div className="readout" aria-live="polite">
          <b>
            GP de {event.name}: {pts(me.per[sel])}
          </b>
          <span>{rider ? `${rider.short_name}${score ? ` · Sprint ${score.sprint_points ?? 0} · Carrera ${score.race_points ?? 0}` : ''}` : 'Sin voto'}</span>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head" style={{ marginBottom: 10 }}>
          <h2 className="h2">Pilotos más votados</h2>
        </div>
        <div className="seg s" role="group" aria-label="De quién son los votos" style={{ marginBottom: 12 }}>
          <button aria-pressed={!onlyMe} onClick={() => setScope('porra')}>
            Toda la porra
          </button>
          <button aria-pressed={onlyMe} onClick={() => setScope('jugador')}>
            <span className="seg-name">{mine ? 'Tus votos' : me.name}</span>
          </button>
        </div>
        {voted.length ? (
          <div className="voted">
            {voted.map((v) => (
              <div key={v.rider.id}>
                <span className="vn">{v.rider.short_name}</span>
                <span className="vb">
                  <i style={{ width: `${Math.max(2, Math.round((v.times / mostVotes) * 100))}%` }} />
                </span>
                <b>{v.times}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">{onlyMe ? `${mine ? 'No has votado' : `${me.name} no ha votado`} en ningún Gran Premio cerrado.` : 'Aún no hay votos de Grandes Premios cerrados.'}</p>
        )}
        {onlyMe && voted.length ? (
          <p className="small muted" style={{ marginTop: 10 }}>
            Cada piloto se puede votar como mucho 3 veces por temporada.
          </p>
        ) : null}
      </section>

      {choosing ? (
        <PickSheet
          series={series}
          current={me.id}
          mine={active}
          onPick={(id) => {
            setPicked(id);
            setChoosing(false);
          }}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}
