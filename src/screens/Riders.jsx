// Pilotos de MotoGP, Moto2 y Moto3: lista por equipos y ficha con el palmarés.
import { useEffect, useState } from 'react';
import { MAX_USES } from '../config.js';
import { loadRider, loadRiders } from '../store.js';
import { teamColors, teamIndex, teamShort } from '../teams.js';
import { Icon, Offline, Photo, TopBar, useData } from '../ui.jsx';
import { Tabs } from './MotoGP.jsx';

const CLASSES = ['MotoGP', 'Moto2', 'Moto3'];
const regions = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['es'], { type: 'region' }) : null;
function country(iso) {
  try {
    return (iso && regions && regions.of(iso)) || '';
  } catch {
    return '';
  }
}
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function useLoaded(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null });
    load()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch(() => alive && setState({ status: 'error', data: null }));
    return () => {
      alive = false;
    };
  }, deps);
  return state;
}

// Cómo se enseña un piloto: los de la porra, con su nombre de siempre (con acentos) y el color de su equipo.
function shown(r, d) {
  const known = r.category === 'MotoGP' ? d.byApi.get(r.id) : null;
  const colors = known && known.team_color ? [known.team_color, known.text_color || '#0A0A0B'] : teamColors(r.category === 'MotoGP' ? r.team : '');
  let first = r.name || '';
  let last = r.surname || '';
  if (known && known.votable && known.full_name) {
    const words = known.full_name.trim().split(/\s+/);
    first = words[0];
    last = words.slice(1).join(' ') || words[0];
  }
  return {
    known,
    first,
    last,
    short: known && known.votable ? known.short_name : last,
    asRider: { number: r.number ?? '', team_color: colors[0], text_color: colors[1], photo_url: r.photo_url },
  };
}

function Card({ r }) {
  const { d } = useData();
  const s = shown(r, d);
  return (
    <a className="rcard" href={`#/motogp/piloto/${r.id}`} aria-label={`${s.first} ${s.last}, dorsal ${r.number ?? ''}`}>
      <span className="rcard-info">
        <span className="rider-top">
          <span className="plate" style={{ background: s.asRider.team_color, color: s.asRider.text_color }}>
            {r.number}
          </span>
          {r.points != null ? <span className="rcard-pts">{r.points} pts</span> : null}
        </span>
        <span className={`rider-name ${s.short.length > 10 ? 'long' : ''}`}>{s.short}</span>
      </span>
      <Photo rider={s.asRider} size="s" />
    </a>
  );
}

// Clasificación del Mundial de pilotos, de la categoría elegida.
const pts = (n) => (n == null ? '0' : String(n).replace('.', ','));
export function Standings() {
  const { d } = useData();
  const [category, setCategory] = useState('MotoGP');
  const { status, data } = useLoaded(loadRiders, []);
  const list = (data || []).filter((r) => r.category === category && r.pos != null).sort((a, b) => a.pos - b.pos);
  const lead = list.length ? Number(list[0].points) || 0 : 0;
  let body;
  if (status === 'loading') body = <p className="muted" style={{ padding: '16px 0' }}>Cargando la clasificación…</p>;
  else if (status === 'error') body = <p className="err-text" style={{ padding: '16px 0' }}>No se ha podido cargar la clasificación. Comprueba la conexión.</p>;
  else if (!list.length) body = <p className="muted" style={{ padding: '16px 0' }}>Todavía no hay clasificación del Mundial de {category} esta temporada.</p>;
  else
    body = (
      <div className="wtable">
        {list.map((r, i) => {
          const s = shown(r, d);
          const gap = lead - (Number(r.points) || 0);
          const extra = [r.wins ? `${r.wins} ${r.wins === 1 ? 'victoria' : 'victorias'}` : '', r.podiums ? `${r.podiums} ${r.podiums === 1 ? 'podio' : 'podios'}` : ''].filter(Boolean).join(' · ');
          return (
            <a key={r.id} className={`wrow ${i < 3 ? 'top' : ''}`} href={`#/motogp/piloto/${r.id}`}>
              <span className={`wpos ${r.pos === 1 ? 'first' : ''}`}>{r.pos}</span>
              <span className="plate rp" style={{ background: s.asRider.team_color, color: s.asRider.text_color }}>
                {r.number}
              </span>
              <span className="wname">
                <span>{`${s.first ? s.first.charAt(0) + '. ' : ''}${s.last}`}</span>
                <small>{[category === 'MotoGP' ? teamShort({ team_name: r.team, constructor: r.constructor }) : r.constructor || r.team, extra].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="wpts">
                <b>{pts(r.points)}</b>
                <small>{i === 0 ? 'Líder' : `−${pts(gap)}`}</small>
              </span>
            </a>
          );
        })}
      </div>
    );
  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <Tabs current="mundial" />
        <div style={{ padding: '12px 20px 4px' }}>
          <div className="seg" role="group" aria-label="Categoría">
            {CLASSES.map((c) => (
              <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '0 20px' }}>
          {body}
          {list.length ? <p className="small muted" style={{ padding: '12px 0 0' }}>Clasificación oficial de MotoGP. Toca un piloto para ver su ficha.</p> : null}
        </div>
      </main>
    </>
  );
}

export function RidersList() {
  const { d } = useData();
  const [category, setCategory] = useState('MotoGP');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const { status, data } = useLoaded(loadRiders, []);
  const all = data || [];

  const q = plain(query.trim());
  let body;
  if (status === 'loading') {
    body = <p className="muted" style={{ padding: '16px 20px' }}>Cargando los pilotos…</p>;
  } else if (status === 'error') {
    body = <p className="err-text" style={{ padding: '16px 20px' }}>No se han podido cargar los pilotos. Comprueba la conexión.</p>;
  } else if (!all.length) {
    body = <p className="muted" style={{ padding: '16px 20px' }}>MotoGP todavía no ha publicado los pilotos de esta temporada.</p>;
  } else if (searching && q) {
    const found = all.filter((r) => plain(`${r.name} ${r.surname} ${r.number ?? ''} ${r.team}`).includes(q)).slice(0, 40);
    body = found.length ? (
      CLASSES.map((c) => {
        const list = found.filter((r) => r.category === c);
        return list.length ? (
          <div key={c} className="rteam">
            <div className="rteam-head">
              <span>{c}</span>
            </div>
            <div className="rgrid2">
              {list.map((r) => (
                <Card key={r.id} r={r} />
              ))}
            </div>
          </div>
        ) : null;
      })
    ) : (
      <p className="muted" style={{ padding: '16px 0' }}>Ningún piloto coincide con "{query.trim()}".</p>
    );
  } else {
    const list = all.filter((r) => r.category === category);
    const regular = list.filter((r) => r.kind === 'Official' || !r.kind);
    const extras = list.filter((r) => r.kind && r.kind !== 'Official');
    // En MotoGP los dos pilotos de un equipo pueden llegar con patrocinador distinto (los dos LCR): se juntan.
    const teams = new Map();
    for (const r of regular) {
      const key = category === 'MotoGP' && teamShort({ team_name: r.team }) !== r.team ? teamShort({ team_name: r.team }) : r.team;
      if (!teams.has(key)) teams.set(key, []);
      teams.get(key).push(r);
    }
    // MotoGP, en el orden de siempre; Moto2 y Moto3, por el mejor clasificado del equipo.
    const best = (rs) => Math.min(...rs.map((r) => r.pos ?? 999));
    const ordered = [...teams.entries()].sort((a, b) => (category === 'MotoGP' ? teamIndex(a[1][0].team) - teamIndex(b[1][0].team) : 0) || best(a[1]) - best(b[1]) || String(a[0]).localeCompare(String(b[0])));
    body = (
      <>
        {ordered.map(([team, rs]) => {
          const color = shown(rs[0], d).asRider.team_color;
          return (
            <div key={team} className="rteam">
              <div className="rteam-head">
                <i style={{ background: color }} />
                <span>{rs.every((r) => r.team === rs[0].team) ? rs[0].team : team}</span>
              </div>
              <div className="rgrid2">
                {rs.sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999) || (a.number ?? 0) - (b.number ?? 0)).map((r) => (
                  <Card key={r.id} r={r} />
                ))}
              </div>
            </div>
          );
        })}
        {extras.length ? (
          <div className="rteam">
            <div className="rteam-head">
              <span>Sustitutos e invitados</span>
            </div>
            <div className="rgrid2">
              {extras.sort((a, b) => String(a.surname).localeCompare(String(b.surname))).map((r) => (
                <Card key={r.id} r={r} />
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="main has-nav">
        <Offline />
        <Tabs current="pilotos" />
        <div style={{ padding: '12px 20px 4px', display: 'flex', gap: 8 }}>
          {searching ? (
            <div className="field" style={{ flex: 1 }}>
              <input
                aria-label="Buscar piloto por nombre, dorsal o equipo"
                placeholder="Nombre, dorsal o equipo"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                autoComplete="off"
                style={{ height: 44, fontSize: 16 }}
              />
            </div>
          ) : (
            <div className="seg" role="group" aria-label="Categoría" style={{ flex: 1 }}>
              {CLASSES.map((c) => (
                <button key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <button
            className="sq"
            aria-label={searching ? 'Cerrar la búsqueda' : 'Buscar piloto'}
            onClick={() => {
              setSearching(!searching);
              setQuery('');
            }}
          >
            <Icon name={searching ? 'close' : 'search'} size={20} />
          </button>
        </div>
        <div style={{ padding: '0 20px' }}>{body}</div>
      </main>
    </>
  );
}

function Tile({ label, value }) {
  const cats = (value && value.cats) || [];
  return (
    <div className="ktile">
      <div className="label" style={{ fontSize: 12, letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div className="ktile-n">{value ? value.total : '–'}</div>
      <div className="ktile-sub">{cats.length ? cats.map(([c, n]) => `${c} ${n}`).join(' · ') : ' '}</div>
    </div>
  );
}

const moment = (m, withCat = true) => (m ? `${country(m.iso) || m.gp || ''} ${m.season}${withCat && m.cat ? ` · ${m.cat}` : ''}`.trim() : null);

function Line({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="kv mid" style={{ minHeight: 48 }}>
      <div className="muted">{label}</div>
      <div className="strong" style={{ color: 'var(--text)' }}>
        {children}
      </div>
    </div>
  );
}

// Tamaño del apellido para que la palabra más larga quepa en una línea junto a la foto.
function lastSize(last) {
  const longest = Math.max(...String(last).split(/\s+/).map((w) => w.length), 1);
  return Math.max(24, Math.min(44, Math.floor(168 / (longest * 0.5))));
}

function birthText(r) {
  if (!r.birth_date) return null;
  const born = new Date(`${r.birth_date}T12:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age -= 1;
  const date = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(born).replace('.', '');
  return `${date} · ${age} años`;
}

export function RiderDetail({ id }) {
  const { boot, d, active } = useData();
  const { status, data: r } = useLoaded(() => loadRider(id), [id]);

  let body;
  if (status === 'loading') {
    body = <p className="muted" style={{ padding: 20 }}>Cargando la ficha…</p>;
  } else if (status === 'error' || !r) {
    body = <p className="err-text" style={{ padding: 20 }}>{status === 'error' ? 'No se ha podido cargar la ficha. Comprueba la conexión.' : 'No hay ficha de este piloto.'}</p>;
  } else {
    const s = shown(r, d);
    const st = r.stats;
    const stand = r.standing;
    const votable = s.known && s.known.votable ? s.known : null;
    // Veces que se le ha votado esta temporada y qué puesto ocupa entre los más votados.
    let votes = 0;
    let rank = 0;
    let uses = 0;
    if (votable) {
      const count = new Map();
      for (const v of boot.votes) count.set(v.rider_id, (count.get(v.rider_id) || 0) + 1);
      votes = count.get(votable.id) || 0;
      rank = 1 + [...count.values()].filter((n) => n > votes).length;
      uses = d.usesOf(active, votable.id, null);
    }
    const ord = (n) => `${n}.º`;
    body = (
      <>
        <section className="rhero">
          <div className="rhero-info">
            <div className="rhero-num">{r.number ?? ''}</div>
            <div>
              <div className="rhero-first">{s.first}</div>
              <h1 className="rhero-last" style={{ '--fs': `${lastSize(s.last)}px` }}>
                {s.last}
              </h1>
              <div className="small muted" style={{ marginTop: 8 }}>
                {[r.team, country(r.country)].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <Photo rider={s.asRider} size="xl" />
        </section>

        {st ? (
          <div className="ktiles">
            <Tile label="Títulos mundiales" value={st.titles} />
            <Tile label="Victorias" value={st.wins} />
            <Tile label="Podios" value={st.podiums} />
            <Tile label="Poles" value={st.poles} />
          </div>
        ) : (
          <p className="muted" style={{ padding: '20px 20px 0' }}>
            {r.stats_at ? 'MotoGP no tiene estadísticas de este piloto.' : 'Las estadísticas de este piloto se están cargando. Vuelve en unos minutos.'}
          </p>
        )}

        {stand ? (
          <section className="sec">
            <h2 className="h2" style={{ marginBottom: 12 }}>
              Mundial {r.season} · {r.category}
            </h2>
            <div className="rows">
              <Line label="Posición">{stand.pos != null ? ord(stand.pos) : null}</Line>
              <Line label="Puntos">{stand.points}</Line>
              <Line label="Victorias en carrera">{stand.race_wins}</Line>
              {r.category === 'MotoGP' ? <Line label="Victorias en Sprint">{stand.sprint_wins}</Line> : null}
              <Line label="Podios">{stand.podiums}</Line>
            </div>
          </section>
        ) : null}

        <section className="sec">
          <h2 className="h2" style={{ marginBottom: 12 }}>
            Trayectoria
          </h2>
          <div className="rows">
            {st ? (
              <>
                <Line label="Carreras disputadas">{st.races ? st.races.total : null}</Line>
                <Line label="Vueltas rápidas en carrera">{st.fastest_laps ? st.fastest_laps.total : null}</Line>
                <Line label="Primer Gran Premio">{moment(st.first_gp)}</Line>
                <Line label="Primera victoria">{moment(st.first_win)}</Line>
                {st.first_win_motogp && st.first_win && st.first_win.cat !== 'MotoGP' ? <Line label="Primera en MotoGP">{moment(st.first_win_motogp, false)}</Line> : null}
                <Line label="Última victoria">{moment(st.last_win)}</Line>
              </>
            ) : null}
            <Line label="Nacimiento">{birthText(r)}</Line>
            <Line label="Lugar">{r.birth_city}</Line>
            <Line label="Moto">{r.constructor}</Line>
          </div>
        </section>

        {votable ? (
          <section className="sec">
            <h2 className="h2" style={{ marginBottom: 12 }}>
              En la porra
            </h2>
            <div className="rows">
              <div className="kv mid" style={{ minHeight: 48 }}>
                <div className="muted">Votos esta temporada</div>
                <div>
                  <span className="num" style={{ color: 'var(--text)' }}>{votes}</span>
                  {votes ? <span className="small muted"> · {rank === 1 ? 'el más votado' : `${ord(rank)} más votado`}</span> : null}
                </div>
              </div>
              <div className="kv mid" style={{ minHeight: 48 }}>
                <div className="muted">Tus usos</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="pips">
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={`pip ${uses >= n ? 'on' : ''}`} />
                    ))}
                  </span>
                  <span className="strong" style={{ color: 'var(--text)' }}>
                    {uses >= MAX_USES ? 'Agotado' : uses === 0 ? 'Sin usar' : `Te ${MAX_USES - uses === 1 ? 'queda 1' : `quedan ${MAX_USES - uses}`}`}
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <TopBar title="Piloto" back="motogp/pilotos" />
      <main className="main has-nav">
        <Offline />
        {body}
      </main>
    </>
  );
}
