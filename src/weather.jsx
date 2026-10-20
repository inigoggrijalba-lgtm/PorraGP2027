// Tiempo del fin de semana en el circuito: una fila con viernes, sábado y domingo.
// Datos de Open-Meteo (los pide el servidor). Iconos en blanco, solo de trazo.

const STROKE = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
// La nube que tapa al sol se rellena con el fondo de la tarjeta para que no se crucen las líneas.
const MASK = 'var(--bg)';

const ICONS = {
  despejado: (
    <>
      <circle cx="18" cy="16" r="5.5" />
      <path d="M26.5 16H29.5M24 22l2.1 2.1M18 24.5v3M12 22l-2.1 2.1M9.5 16H6.5M12 10L9.9 7.9M18 7.5v-3M24 10l2.1-2.1" />
    </>
  ),
  claros: (
    <>
      <circle cx="13" cy="11" r="4" />
      <path d="M8.4 15.6l-1.6 1.6M6.5 11H4.3M8.4 6.4L6.8 4.8M13 4.5V2.3M17.6 6.4l1.6-1.6" />
      <path d="M11 27h14.5a5 5 0 0 0 .5-9.97A7 7 0 0 0 12.6 18.8 4.2 4.2 0 0 0 11 27z" style={{ fill: MASK }} />
    </>
  ),
  nublado: <path d="M8 26h16a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 9.6 17 4.5 4.5 0 0 0 8 26z" />,
  niebla: (
    <>
      <path d="M8 20h16a5 5 0 0 0 .5-9.97A7 7 0 0 0 9.8 12.5 4 4 0 0 0 8 20z" />
      <path d="M8 25h20M11 29h14" />
    </>
  ),
  lluvia: (
    <>
      <path d="M8 20h16a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 9.6 11 4.5 4.5 0 0 0 8 20z" />
      <path d="M12 24l-1.5 4M18 24l-1.5 4M24 24l-1.5 4" />
    </>
  ),
  chubascos: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M12 2.5v1.3M5.5 9h1.3M7.4 4.4l.9.9M16.6 4.4l-.9.9" />
      <path d="M10 21h14.5a5 5 0 0 0 .5-9.97A7 7 0 0 0 11.6 12.8 4.2 4.2 0 0 0 10 21z" style={{ fill: MASK }} />
      <path d="M14 25l-1.3 3.5M20 25l-1.3 3.5" />
    </>
  ),
  tormenta: (
    <>
      <path d="M8 19h16a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 9.6 10 4.5 4.5 0 0 0 8 19z" />
      <path d="M17.5 21l-3 5h4l-3 5" />
    </>
  ),
  nieve: (
    <>
      <path d="M8 19h16a5.5 5.5 0 0 0 .6-10.97A7.5 7.5 0 0 0 9.6 10 4.5 4.5 0 0 0 8 19z" />
      <path d="M12 24v4M10.3 25l3.4 2M10.3 27l3.4-2M21 24v4M19.3 25l3.4 2M19.3 27l3.4-2" />
    </>
  ),
};

// Códigos WMO de Open-Meteo → icono y nombre (para quien usa lector de pantalla).
function kind(code) {
  if (code <= 1) return ['despejado', 'despejado'];
  if (code === 2) return ['claros', 'nubes y claros'];
  if (code === 3) return ['nublado', 'nublado'];
  if (code === 45 || code === 48) return ['niebla', 'niebla'];
  if (code >= 95) return ['tormenta', 'tormenta'];
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['nieve', 'nieve'];
  if (code >= 80 && code <= 82) return ['chubascos', 'chubascos'];
  if (code >= 51 && code <= 67) return ['lluvia', 'lluvia'];
  return ['nublado', 'nublado'];
}

const LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function Weather({ days, raceDate }) {
  if (!days || !days.length) return null;
  const list = days.slice(-3);
  return (
    <div className="wx" title="Previsión del tiempo en el circuito (Open-Meteo)">
      {list.map((w) => {
        const wd = new Date(`${w.date}T12:00:00Z`).getUTCDay();
        const [icon, label] = kind(w.code);
        const race = w.date === raceDate;
        return (
          <div key={w.date} className={`wx-day ${race ? 'race' : ''}`} aria-label={`${NAME[wd]}: ${label}, de ${w.tmin} a ${w.tmax} grados, ${w.rain ?? 0} % de lluvia`}>
            <span className="wx-d" aria-hidden="true">
              {LETTER[wd]}
            </span>
            <svg className="wx-ic" viewBox="0 0 36 32" aria-hidden="true" {...STROKE}>
              {ICONS[icon]}
            </svg>
            <span className="wx-v" aria-hidden="true">
              <span className="wx-t">
                {w.tmin}°<span>–</span>
                {w.tmax}°
              </span>
              <span className={`wx-r ${(w.rain ?? 0) < 30 ? 'dry' : ''}`}>
                <svg viewBox="0 0 10 12">
                  <path d="M5 1C3.2 4 1.5 6.2 1.5 8a3.5 3.5 0 0 0 7 0C8.5 6.2 6.8 4 5 1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                {w.rain ?? 0}%
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
